<?php

namespace App\Http\Controllers;

use App\Models\Target;
use App\Services\SchemaManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class DataController extends Controller
{
    private const PER_PAGE = 25;

    public function index()
    {
        $tables = Target::importTableNames()->map(function (string $name) {
            $exists = Schema::hasTable($name);

            return [
                'name'    => $name,
                'exists'  => $exists,
                'rows'    => $exists ? DB::table($name)->count() : null,
                'columns' => $exists ? count(array_diff(Schema::getColumnListing($name), [SchemaManager::PK_COLUMN])) : null,
            ];
        })->values();

        return Inertia::render('data/index', ['tables' => $tables]);
    }

    public function show(Request $request, string $table)
    {
        $names = Target::importTableNames();

        abort_unless($names->contains($table), 404);

        $search    = trim((string) $request->query('search', ''));
        $direction = $request->query('direction') === 'desc' ? 'desc' : 'asc';

        $sources = Target::where('table_name', $table)
            ->with('sheetTab.spreadsheet')
            ->get()
            ->map(fn (Target $t) => [
                'spreadsheet' => $t->sheetTab->spreadsheet->name,
                'tab'         => $t->sheetTab->name,
            ])
            ->values();

        
        if (! Schema::hasTable($table)) {
            return Inertia::render('data/show', [
                'table'   => $table,
                'tables'  => $names,
                'sources' => $sources,
                'exists'  => false,
                'columns' => [],
                'rows'    => null,
                'filters' => ['search' => $search, 'sort' => null, 'direction' => $direction],
            ]);
        }

        $all     = Schema::getColumnListing($table);
        $visible = array_values(array_diff($all, [SchemaManager::PK_COLUMN]));
        $sort    = in_array($request->query('sort'), $visible, true) ? $request->query('sort') : null;

        $query = DB::table($table)->select($visible);

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($visible, $like) {
                foreach ($visible as $column) {
                    $q->orWhere($column, 'like', $like);
                }
            });
        }

        if ($sort) {
            $query->orderBy($sort, $direction);
        } elseif (in_array(SchemaManager::PK_COLUMN, $all, true)) {
            $query->orderBy(SchemaManager::PK_COLUMN);
        } else {
            $query->orderBy($visible[0]);
        }

        $rows = $query->paginate(self::PER_PAGE)->withQueryString();
        $rows->through(fn ($row) => (array) $row);

        $meta = collect(Schema::getColumns($table))->keyBy('name');

        return Inertia::render('data/show', [
            'table'   => $table,
            'tables'  => $names,
            'sources' => $sources,
            'exists'  => true,
            'columns' => collect($visible)->map(fn ($name) => [
                'name' => $name,
                'kind' => $this->kind($meta[$name]['type'] ?? '', $meta[$name]['type_name'] ?? ''),
            ])->values(),
            'rows'    => $rows,
            'filters' => ['search' => $search, 'sort' => $sort, 'direction' => $direction],
        ]);
    }

    private function kind(string $type, string $typeName): string
    {
        $type = strtolower($type);
        $typeName = strtolower($typeName);

        if (str_starts_with($type, 'tinyint(1)')) {
            return 'boolean';
        }

        return match (true) {
            in_array($typeName, ['int', 'integer', 'tinyint', 'smallint', 'mediumint', 'bigint', 'decimal', 'numeric', 'float', 'double'], true) => 'number',
            in_array($typeName, ['date', 'datetime', 'timestamp'], true) => 'date',
            default => 'text',
        };
    }
}