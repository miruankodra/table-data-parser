<?php

namespace App\Console\Commands;

use App\Services\ImportService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sheets:import {--target= : Only import this target ID}')]
#[Description('Import configured Google Sheets into the database')]
class ImportSheets extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(ImportService $service): int
    {
        $service->runAll($this->option('target'));
        $this->info('Import finished. See import_runs for details.');
        return self::SUCCESS;
    }
}
