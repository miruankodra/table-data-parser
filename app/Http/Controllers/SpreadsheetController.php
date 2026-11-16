<?php

namespace App\Http\Controllers;

use App\Exceptions\SheetsException;
use App\Http\Requests\StoreSpreadsheetRequest;
use App\Models\Spreadsheet;
use App\Services\GoogleSheetsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Target;
use App\Services\SchemaManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SpreadsheetController extends Controller
{
    private const PREVIEW_ROWS = 10;
    
    public function __construct(private GoogleSheetsService $google) {}

    public function index()
    {
        return Inertia::render('spreadsheets/index', [
            'spreadsheets' => Spreadsheet::withCount('tabs')
                ->latest()
                ->get(['id', 'name', 'google_spreadsheet_id', 'is_active']),

            // Only evaluated when the page asks for it (dialog opened)
            'available' => Inertia::optional(function () {
                try {
                    return ['error' => null, 'files' => $this->google->listSpreadsheets()];
                } catch (SheetsException $e) {
                    return ['error' => $e->getMessage(), 'files' => []];
                }
            }),
        ]);
    }

    public function store(StoreSpreadsheetRequest $request)
    {
        $spreadsheet = Spreadsheet::create($request->validated());
        return to_route('spreadsheets.show', $spreadsheet);
    }

    public function update(Request $request, Spreadsheet $spreadsheet)
    {
        $spreadsheet->update($request->validate(['is_active' => ['required', 'boolean']]));

        return back();
    }

    public function destroy(Spreadsheet $spreadsheet)
    {
        $spreadsheet->delete(); // tabs, targets, and mappings cascade; imported data tables stay

        return back();
    }

    public function show(Spreadsheet $spreadsheet)
    {
        $spreadsheet->load(['tabs.targets' => fn ($q) => $q->withCount('mappings')]);

        return Inertia::render('spreadsheets/show', [
            'spreadsheet' => [
                'id'                    => $spreadsheet->id,
                'name'                  => $spreadsheet->name,
                'google_spreadsheet_id' => $spreadsheet->google_spreadsheet_id,
                'is_active'             => $spreadsheet->is_active,
                'tabs' => $spreadsheet->tabs->sortBy('name')->values()->map(fn ($t) => [
                    'id'         => $t->id,
                    'name'       => $t->name,
                    'header_row' => $t->header_row,
                    'is_active'  => $t->is_active,
                    'targets'    => $t->targets->map(fn ($g) => [
                        'id'             => $g->id,
                        'table_name'     => $g->table_name,
                        'write_mode'     => $g->write_mode,
                        'is_active'      => $g->is_active,
                        'mappings_count' => $g->mappings_count,
                    ]),
                ]),
            ],

            'googleTabs' => Inertia::defer(function () use ($spreadsheet) {
                try {
                    return ['error' => null, 'names' => $this->google->getTabs($spreadsheet->google_spreadsheet_id)];
                } catch (SheetsException $e) {
                    return ['error' => $e->getMessage(), 'names' => []];
                }
            }),

            'dataPreview' => Inertia::defer(fn () => $this->dataPreview($spreadsheet), 'data'),
        ]);
    }

    private function dataPreview(Spreadsheet $spreadsheet): array
    {
        $names = Target::whereHas('sheetTab', fn ($q) => $q->where('spreadsheet_id', $spreadsheet->id))
            ->distinct()
            ->orderBy('table_name')
            ->pluck('table_name')
            ->filter(fn ($n) => SchemaManager::isValidIdentifier($n)
                && ! in_array($n, SchemaManager::PROTECTED_TABLES, true));

        return $names->map(function (string $name) use ($spreadsheet) {
            // true when a target of another spreadsheet also writes here
            $shared = Target::where('table_name', $name)
                ->whereDoesntHave('sheetTab', fn ($q) => $q->where('spreadsheet_id', $spreadsheet->id))
                ->exists();

            if (! Schema::hasTable($name)) {
                return ['name' => $name, 'exists' => false, 'shared' => $shared, 'total' => 0, 'columns' => [], 'rows' => []];
            }

            $all     = Schema::getColumnListing($name);
            $columns = array_values(array_diff($all, [SchemaManager::PK_COLUMN]));

            $query = DB::table($name)->select($columns);
            $query->orderBy(in_array(SchemaManager::PK_COLUMN, $all, true) ? SchemaManager::PK_COLUMN : $columns[0]);

            return [
                'name'    => $name,
                'exists'  => true,
                'shared'  => $shared,
                'total'   => DB::table($name)->count(),
                'columns' => $columns,
                'rows'    => $query->limit(self::PREVIEW_ROWS)->get()->map(fn ($r) => (array) $r)->all(),
            ];
        })->values()->all();
    }
}