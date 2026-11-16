<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ColumnMapping extends Model
{
    use HasUuids;

    protected $fillable = [
        'target_id',
        'source_column',
        'db_column',
        'data_type',
        'is_key',
    ];

    protected $casts = [
        'is_key' => 'boolean',
    ];

    public const TYPES = ['text', 'string', 'integer', 'decimal', 'date', 'datetime', 'boolean'];
    public const KEY_TYPES = ['string', 'integer', 'date', 'datetime'];   // text can't be a unique key

    public function target()
    {
        return $this->belongsTo(Target::class);
    }
}
