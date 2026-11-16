<?php

namespace App\Http\Controllers;

use App\Models\ImportRun;
use App\Services\ImportService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ImportRunController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');

        $runs = ImportRun::with('target.sheetTab.spreadsheet')
            ->when(
                in_array($status, ['running', 'success', 'partial', 'failed'], true),
                fn ($q) => $q->where('status', $status)
            )
            ->latest('started_at')
            ->paginate(20)
            ->withQueryString()
            ->through(fn ($r) => [
                'id'           => $r->id,
                'status'       => $r->status,
                'spreadsheet'  => $r->target?->sheetTab?->spreadsheet?->name,
                'tab'          => $r->target?->sheetTab?->name,
                'table'        => $r->target?->table_name,
                'rows_read'    => $r->rows_read,
                'rows_written' => $r->rows_written,
                'message'      => $r->message,
                'started_at'   => $r->started_at?->toIso8601String(),
                'seconds'      => ($r->started_at && $r->finished_at)
                    ? (int) round(abs($r->started_at->diffInSeconds($r->finished_at)))
                    : null,
            ]);

        return Inertia::render('import-runs/index', [
            'runs'   => $runs,
            'status' => $status,
        ]);
    }

    public function store(Request $request)
    {
        $targetId = $request->validate([
            'target_id' => ['nullable', 'uuid', 'exists:targets,id'],
        ])['target_id'] ?? null;

        if ($this->isRunning($targetId)) {
            return back()->with('error', $targetId ? 'This target is already importing.' : 'An import is already running.');
        }

        dispatch(function () use ($targetId) {
            set_time_limit(0);
            app(ImportService::class)->runAll($targetId);
        })->afterResponse();

        return back()->with('success', 'Import started. Follow it on the Import runs page.');
    }

    private function isRunning(?string $targetId = null): bool
    {
        return ImportRun::where('status', 'running')
            ->where('started_at', '>=', now()->subMinutes(15))
            ->when($targetId, fn ($q) => $q->where('target_id', $targetId))
            ->exists();
    }
}