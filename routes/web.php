<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DataController;
use App\Http\Controllers\ImportRunController;
use App\Http\Controllers\SpreadsheetController;
use App\Http\Controllers\SheetTabController;
use App\Http\Controllers\TargetController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::resource('spreadsheets', SpreadsheetController::class)
    ->only(['index', 'create', 'store', 'update', 'destroy', 'show']);

    Route::post('spreadsheets/{spreadsheet}/tabs', [SheetTabController::class, 'store'])->name('tabs.store');
    Route::patch('tabs/{tab}', [SheetTabController::class, 'update'])->name('tabs.update');
    Route::delete('tabs/{tab}', [SheetTabController::class, 'destroy'])->name('tabs.destroy');

    Route::post('tabs/{tab}/targets', [TargetController::class, 'store'])->name('targets.store');
    Route::delete('targets/{target}', [TargetController::class, 'destroy'])->name('targets.destroy');

    Route::get('targets/{target}/edit', [TargetController::class, 'edit'])->name('targets.edit');
    Route::put('targets/{target}', [TargetController::class, 'update'])->name('targets.update');

    Route::resource('import-runs', ImportRunController::class)->only(['index', 'store']);

    Route::get('data', [DataController::class, 'index'])->name('data.index');
    Route::get('data/{table}', [DataController::class, 'show'])->name('data.show');
});

require __DIR__.'/settings.php';
