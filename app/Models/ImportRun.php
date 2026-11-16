<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ImportRun extends Model
{
    use HasUuids;

    protected $fillable = [
        'target_id',
        'status',
        'rows_read',
        'rows_written',
        'message',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function target()
    {
        return $this->belongsTo(Target::class);
    }
}
