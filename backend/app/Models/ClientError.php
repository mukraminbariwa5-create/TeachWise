<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;

/** A crash or error reported by the app, so problems reach the admin with details. */
class ClientError extends Model
{
    use BelongsToSchool;
    public const UPDATED_AT = null;

    protected $fillable = ['school_id', 'user_id', 'message', 'stack', 'screen', 'platform', 'app_version'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
