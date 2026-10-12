<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** An Expo push token for one phone. */
class PushToken extends Model
{
    protected $fillable = ['user_id', 'token', 'platform', 'last_used_at'];

    protected function casts(): array
    {
        return ['last_used_at' => 'datetime'];
    }
}
