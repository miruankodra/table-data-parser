<?php

namespace App\Services;

use App\Models\ColumnMapping;
use App\Models\Target;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class SchemaManager {
    public const PK_COLUMN = 'internal_id';

    public const PROTECTED_TABLES = [
        'users', 'migrations', 'failed_jobs', 'sessions', 'cache', 'cache_locks',
        'jobs', 'job_batches', 'password_reset_tokens', 'spreadsheets', 'sheet_tabs',
        'targets', 'column_mappings', 'import_runs',
    ];

    public const IDENTIFIER_PATTERN = '/^[a-z_][a-z0-9_]{0,63}$/';

    /** Index names used by earlier versions of this app (one fixed name for every table) */
    private const LEGACY_INDEXES = ['uniq_import_key', 'unique_import_key'];

    /** Makes the DB table match the config. Returns ['notes' => [...], 'warnings' => [...]] */
    public function sync(Target $target): array
    {
        $tableName = $target->table_name;
        $mappings = $target->mappings;
        $keys = $mappings->where('is_key', true)->pluck('db_column')->all();

        $this->assertSafe($target, $mappings, $keys);

        $notes = [];
        $warnings = [];

        // 1. Table missing: create it
        if (! Schema::hasTable($tableName)) {
            if (! $target->auto_create_table) {
                throw new RuntimeException("Table {$tableName} does not exist and auto_create_table is off.");
            }

            Schema::create($tableName, function (Blueprint $t) use ($mappings, $keys, $target, $tableName) {
                if ($target->add_primary_key) {
                    $t->uuid(self::PK_COLUMN)->primary();
                }

                foreach ($mappings as $mapping) {
                    $this->addColumn($t, $mapping);
                }

                if ($target->write_mode === 'upsert') {
                    $t->unique($keys, $this->importIndexName($tableName));
                }
            });

            return ['notes' => ["Created table {$tableName}."], 'warnings' => []];
        }

        // 2. Table exists: add the mapped columns it lacks
        $existingColumns = Schema::getColumnListing($tableName);
        $missingColumns = $mappings->reject(fn ($m) => in_array($m->db_column, $existingColumns, true));

        if ($missingColumns->isNotEmpty()) {
            Schema::table($tableName, function (Blueprint $t) use ($missingColumns) {
                foreach ($missingColumns as $mapping) {
                    $this->addColumn($t, $mapping);
                }
            });

            $notes[] = 'Added columns to `' . $tableName . '`: ' . $missingColumns->pluck('db_column')->implode(', ');
        }

        // 3. Existing tables are never altered to get a primary key, only flagged
        if ($target->add_primary_key && ! $this->hasPrimaryKey($tableName)) {
            $warnings[] = "Table {$tableName} has no primary key. The app only adds one to tables it creates.";
        }

        // 4. Upsert needs a unique index on exactly the key columns
        if ($target->write_mode === 'upsert' && ! $this->hasUniqueIndex($tableName, $keys)) {
            $name = $this->importIndexName($tableName);

            try {
                // Drop the app's own earlier index (key columns changed, or a legacy name), then recreate it
                foreach ([$name, ...self::LEGACY_INDEXES] as $old) {
                    if ($this->hasIndexNamed($tableName, $old)) {
                        Schema::table($tableName, fn (Blueprint $t) => $t->dropUnique($old));
                    }
                }

                Schema::table($tableName, fn (Blueprint $t) => $t->unique($keys, $name));
                $notes[] = 'Created unique index on (' . implode(', ', $keys) . ').';
            } catch (\Throwable $e) {
                throw new RuntimeException('Cannot create the unique key (duplicate data already in the table?): ' . $e->getMessage());
            }
        }

        return ['notes' => $notes, 'warnings' => $warnings];
    }

    /** One index name per table: SQLite index names are global, so a fixed name collides across tables */
    private function importIndexName(string $table): string
    {
        return 'uniq_import_' . substr(md5($table), 0, 12);
    }

    private function addColumn(Blueprint $t, ColumnMapping $m): void
    {
        $name = $m->db_column;

        $column = match ($m->data_type) {
            'string'   => $t->string($name, 191),
            'integer'  => $t->bigInteger($name),
            'decimal'  => $t->decimal($name, 15, 4),
            'date'     => $t->date($name),
            'datetime' => $t->dateTime($name),
            'boolean'  => $t->boolean($name),
            default    => $t->text($name),
        };

        $column->nullable();
    }

    private function hasPrimaryKey(string $table): bool
    {
        foreach (Schema::getIndexes($table) as $index) {
            if (! empty($index['primary'])) {
                return true;
            }
        }

        return false;
    }

    private function hasIndexNamed(string $table, string $name): bool
    {
        foreach (Schema::getIndexes($table) as $index) {
            if ($index['name'] === $name) {
                return true;
            }
        }

        return false;
    }

    private function hasUniqueIndex(string $table, array $keys): bool
    {
        sort($keys);

        foreach (Schema::getIndexes($table) as $index) {
            $cols = $index['columns'];
            sort($cols);
            if ($index['unique'] && $cols === $keys) {
                return true;
            }
        }

        return false;
    }

    public function assertSafe(Target $target, Collection $mappings, array $keys): void
    {
        if (! self::isValidIdentifier($target->table_name) || in_array($target->table_name, self::PROTECTED_TABLES, true)) {
            throw new RuntimeException("Unsafe table name: {$target->table_name}");
        }

        if ($mappings->isEmpty()) {
            throw new RuntimeException('Target has no column mappings.');
        }

        foreach ($mappings as $mapping) {
            if (! self::isValidIdentifier($mapping->db_column)) {
                throw new RuntimeException("Unsafe column name: {$mapping->db_column}");
            }

            if ($mapping->db_column === self::PK_COLUMN) {
                throw new RuntimeException(self::PK_COLUMN . ' is reserved for the generated primary key.');
            }

            if ($mapping->is_key && ! in_array($mapping->data_type, ColumnMapping::KEY_TYPES, true)) {
                throw new RuntimeException("Key column {$mapping->db_column} must be string, integer, date, or datetime.");
            }
        }

        if ($target->write_mode === 'upsert' && empty($keys)) {
            throw new RuntimeException('Upsert mode requires at least one key column.');
        }
    }

    public static function isValidIdentifier(mixed $value): bool
    {
        return is_string($value) && preg_match(self::IDENTIFIER_PATTERN, $value) === 1;
    }
}