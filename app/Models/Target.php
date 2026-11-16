<?php

namespace App\Models;

use App\Services\SchemaManager;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class Target extends Model
{
    use HasUuids;

    protected $fillable = [
        'sheet_tab_id',
        'table_name',
        'write_mode',
        'auto_create_table',
        'is_active',
        'add_primary_key',
    ];

    protected $casts = [
        'auto_create_table' => 'boolean',
        'is_active' => 'boolean',
        'add_primary_key'   => 'boolean',
    ];

    public static function importTableNames(): Collection
    {
        return static::query()
            ->distinct()
            ->orderBy('table_name')
            ->pluck('table_name')
            ->filter(fn ($name) => SchemaManager::isValidIdentifier($name)
                && ! in_array($name, SchemaManager::PROTECTED_TABLES, true))
            ->values();
    }

    public function sheetTab()
    {
        return $this->belongsTo(SheetTab::class);
    }

    public function mappings()
    {
        return $this->hasMany(ColumnMapping::class);
    }

    public function importRuns()
    {
        return $this->hasMany(ImportRun::class);
    }
}
