<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SheetTab extends Model
{
    use HasUuids;
    

    protected $fillable = [
        'name',
        'sheet_id',
        'spreadsheet_id',
        'header_row',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function spreadsheet()
    {
        return $this->belongsTo(Spreadsheet::class);
    }

    public function targets()
    {
        return $this->hasMany(Target::class);
    }
}
