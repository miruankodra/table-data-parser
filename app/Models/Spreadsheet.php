<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Spreadsheet extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'google_spreadsheet_id',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function tabs()
    {
        return $this->hasMany(SheetTab::class);
    }
}
