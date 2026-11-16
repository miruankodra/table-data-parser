<?php

namespace App\Services;

use App\Exceptions\SheetsException;
use App\Models\ImportRun;
use App\Models\SheetTab;
use App\Models\Spreadsheet;
use App\Models\Target;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ImportService
{
    public function __construct(
        private GoogleSheetsService $google,
        private SchemaManager $schema,
        private ValueCaster $caster,
    ) {}

    public function runAll(?string $onlyTargetId = null): void
    {
        Spreadsheet::where('is_active', true)->with('tabs.targets.mappings')->each(function (Spreadsheet $sheet) use ($onlyTargetId) {
            foreach ($sheet->tabs->where('is_active', true) as $tab) {
                $this->importTab($sheet, $tab, $onlyTargetId);
            }
        });
    }

    private function importTab(Spreadsheet $sheet, SheetTab $tab, ?string $onlyTargetId): void
    {
        $targets = $tab->targets->where('is_active', true)
            ->when($onlyTargetId, fn ($c) => $c->where('id', $onlyTargetId));

        if ($targets->isEmpty()) {
            return;
        }

        // Read the tab ONCE, then reuse the result for every target
        try {
            $data = $this->google->readTab($sheet->google_spreadsheet_id, $tab->name, $tab->header_row);
        } catch (SheetsException $e) {
            foreach ($targets as $target) {
                $this->logRun($target, 'failed', 0, 0, $e->getMessage());
            }
            return;
        }

        foreach ($targets as $target) {
            $this->importTarget($target, $data['rows'], $data['headers'], $data['warnings']);
        }
    }

    private function importTarget(Target $target, array $rows, array $headers, array $tabWarnings = []): void
    {
        $run = ImportRun::create([
            'target_id'  => $target->id,
            'status'     => 'running',
            'started_at' => now(),
            'rows_read'  => count($rows),
        ]);

        $notes = [];
        $warnings = $tabWarnings;

        try {
            $result = $this->schema->sync($target);
            $notes = $result['notes'];
            $warnings = array_merge($warnings, $result['warnings']);

            $lookup = [];
            foreach ($headers as $h) {
                $lookup[$this->normalize($h)] = $h;
            }

            $active = [];
            foreach ($target->mappings as $m) {
                $actual = $lookup[$this->normalize($m->source_column)] ?? null;
                if ($actual === null) {
                    $warnings[] = "Header `{$m->source_column}` not found, column `{$m->db_column}` skipped.";
                    continue;
                }
                $active[] = ['mapping' => $m, 'header' => $actual];
            }

            $keyColumns = $target->mappings->where('is_key', true)->pluck('db_column')->all();
            $activeColumns = collect($active)->pluck('mapping.db_column')->all();

            if ($target->write_mode === 'upsert' && array_diff($keyColumns, $activeColumns)) {
                throw new \RuntimeException('A key column is missing from the sheet, import aborted to avoid bad data.');
            }

            $this->caster->resetFailures();
            $skippedNoKey = 0;

            $records = [];
            foreach ($rows as $row) {
                $record = [];
                foreach ($active as $a) {
                    $record[$a['mapping']->db_column] = $this->caster->cast(
                        $row[$a['header']] ?? null,
                        $a['mapping']->data_type,
                        $a['mapping']->db_column
                    );
                }

                if (count(array_filter($record, fn ($v) => $v !== null)) === 0) {
                    continue;
                }
                if ($target->write_mode === 'upsert' && $this->hasNullKey($record, $keyColumns)) {
                    $skippedNoKey++;
                    continue;
                }
                $records[] = $record;
            }

            foreach ($this->caster->failures() as $column => $count) {
                $warnings[] = "{$count} value(s) in `{$column}` could not be converted and were stored as NULL.";
            }
            if ($skippedNoKey > 0) {
                $warnings[] = "{$skippedNoKey} row(s) skipped because a key column was empty or invalid.";
            }

            $written = $this->write($target, $records, $keyColumns);

            $this->finish($run, $warnings ? 'partial' : 'success', $written, $notes, $warnings);
        } catch (\Throwable $e) {
            $this->finish($run, 'failed', 0, $notes, $warnings, $e->getMessage());
        }
    }

    private function write(Target $target, array $records, array $keyColumns): int
    {
        $table = $target->table_name;
        $chunks = array_chunk($records, config('sheets.chunk_size', 500));

        // `DB::table()` doesn't generate UUIDs like Eloquent does, so the import supplies them
        $withPk = Schema::hasColumn($table, SchemaManager::PK_COLUMN);

        $insertChunks = function () use ($chunks, $table, $target, $keyColumns, $withPk) {
            foreach ($chunks as $chunk) {
                if ($withPk) {
                    $chunk = array_map(
                        fn ($row) => [SchemaManager::PK_COLUMN => (string) Str::orderedUuid()] + $row,
                        $chunk
                    );
                }

                if ($target->write_mode === 'upsert') {
                    // The PK is never updated, so existing rows keep their original internal_id
                    $update = array_values(array_diff(
                        array_keys($chunk[0]),
                        [...$keyColumns, SchemaManager::PK_COLUMN]
                    ));

                    $update
                        ? DB::table($table)->upsert($chunk, $keyColumns, $update)
                        : DB::table($table)->insertOrIgnore($chunk);
                } else {
                    DB::table($table)->insert($chunk);
                }
            }
        };

        if ($target->write_mode === 'replace') {
            // delete + insert in one transaction (TRUNCATE would auto-commit in MySQL)
            DB::transaction(function () use ($table, $insertChunks) {
                DB::table($table)->delete();
                $insertChunks();
            });
        } else {
            $insertChunks();
        }

        return count($records);
    }

    private function hasNullKey(array $record, array $keys): bool
    {
        foreach ($keys as $k) {
            if (($record[$k] ?? null) === null) {
                return true;
            }
        }
        return false;
    }

    private function normalize(string $header): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', $header)));
    }

    private function finish(ImportRun $run, string $status, int $written, array $notes, array $warnings, ?string $error = null): void
    {
        $lines = [
            ...array_map(fn ($m) => "info: {$m}", $notes),
            ...array_map(fn ($m) => "warning: {$m}", $warnings),
            ...($error ? ["error: {$error}"] : []),
        ];

        $run->update([
            'status'       => $status,
            'rows_written' => $written,
            'message'      => $lines ? implode("\n", $lines) : null,
            'finished_at'  => now(),
        ]);
    }

    private function logRun(Target $target, string $status, int $read, int $written, string $message): void
    {
        ImportRun::create([
            'target_id' => $target->id, 'status' => $status, 'rows_read' => $read,
            'rows_written' => $written, 'message' => "error: {$message}",
            'started_at' => now(), 'finished_at' => now(),
        ]);
    }
}