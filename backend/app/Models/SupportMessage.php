<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** "Contact the admin" and "Report a problem" messages from the Help screen. */
class SupportMessage extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'user_id', 'kind', 'message', 'meta', 'status'];

    protected function casts(): array
    {
        return ['meta' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
