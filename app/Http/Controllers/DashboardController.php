<?php

namespace App\Http\Controllers;

use App\Models\ImportRun;
use App\Models\Spreadsheet;
use App\Models\Target;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function __invoke()
    {
        return Inertia::render('dashboard', [
            'stats' => [
                'spreadsheets' => Spreadsheet::where('is_active', true)->count(),
                'targets'      => Target::where('is_active', true)->count(),
                'failed_24h'   => ImportRun::where('status', 'failed')
                                    ->where('started_at', '>=', now()->subDay())->count(),
            ],
            'recentRuns' => ImportRun::with('target.sheetTab.spreadsheet')
                ->latest('started_at')
                ->limit(10)
                ->get()
                ->map(fn ($r) => [
                    'id'           => $r->id,
                    'status'       => $r->status,
                    'spreadsheet'  => $r->target?->sheetTab?->spreadsheet?->name,
                    'tab'          => $r->target?->sheetTab?->name,
                    'table'        => $r->target?->table_name,
                    'rows_read'    => $r->rows_read,
                    'rows_written' => $r->rows_written,
                    'message'      => $r->message,
                    'started_at'   => $r->started_at?->toIso8601String(),
                ]),
        ]);
    }
}