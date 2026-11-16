<?php

namespace App\Http\Controllers;

use App\Exceptions\SheetsException;
use App\Http\Requests\SaveTargetRequest;
use App\Http\Requests\StoreTargetRequest;
use App\Models\ColumnMapping;
use App\Models\SheetTab;
use App\Models\Target;
use App\Services\GoogleSheetsService;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TargetController extends Controller
{
    public function __construct(private GoogleSheetsService $google) {}

    public function store(StoreTargetRequest $request, SheetTab $tab)
    {
        $target = $tab->targets()->create($request->validated() + ['is_active' => true]);

        return to_route('targets.edit', $target);
    }

    public function edit(Target $target)
    {
        $target->load(['mappings', 'sheetTab.spreadsheet']);
        $tab = $target->sheetTab;
        $sheet = $tab->spreadsheet;

        return Inertia::render('targets/edit', [
            'target' => [
                'id'                => $target->id,
                'table_name'        => $target->table_name,
                'write_mode'        => $target->write_mode,
                'auto_create_table' => $target->auto_create_table,
                'add_primary_key'   => $target->add_primary_key,
                'mappings'          => $target->mappings->map(fn ($m) => [
                    'source_column' => $m->source_column,
                    'db_column'     => $m->db_column,
                    'data_type'     => $m->data_type,
                    'is_key'        => $m->is_key,
                ])->values(),
            ],
            'context' => [
                'spreadsheet_id'   => $sheet->id,
                'spreadsheet_name' => $sheet->name,
                'tab_name'         => $tab->name,
            ],
            'types'    => ColumnMapping::TYPES,
            'keyTypes' => ColumnMapping::KEY_TYPES,

            // Deferred: the page opens instantly and Google fills the dropdowns afterward
            'headers' => Inertia::defer(function () use ($sheet, $tab) {
                try {
                    $names = $this->google->getHeaders($sheet->google_spreadsheet_id, $tab->name, $tab->header_row);

                    return ['error' => null, 'names' => array_values(array_unique($names))];
                } catch (SheetsException $e) {
                    return ['error' => $e->getMessage(), 'names' => []];
                }
            }),
        ]);
    }

    public function update(SaveTargetRequest $request, Target $target)
    {
        DB::transaction(function () use ($request, $target) {
            $target->update($request->safe()->only(['table_name', 'write_mode', 'auto_create_table', 'add_primary_key']));
            $target->mappings()->delete();
            $target->mappings()->createMany($request->validated('mappings'));
        });

        return to_route('spreadsheets.show', $target->sheetTab->spreadsheet_id);
    }

    public function destroy(Target $target)
    {
        $target->delete();

        return back();
    }
}