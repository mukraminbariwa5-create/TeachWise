<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A one-time code that lets a teacher or admin join a specific school,
 * e.g. "TW-7K3Q-9XPA". Teachers never pick their school themselves: they are invited.
 */
class Invite extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'role', 'department_id', 'name', 'email', 'id_number', 'code', 'expires_at', 'used_at', 'used_by', 'created_by'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    public static function generateCode(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        do {
            $part = fn () => collect(range(1, 4))->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])->implode('');
            $code = 'TW-'.$part().'-'.$part();
        } while (static::withoutGlobalScopes()->where('code', $code)->exists());

        return $code;
    }

    public static function findUsable(string $code): ?self
    {
        $invite = static::withoutGlobalScopes()->where('code', Str::upper(trim($code)))->first();

        return $invite && $invite->isUsable() ? $invite : null;
    }

    public function isUsable(): bool
    {
        return ! $this->used_at && (! $this->expires_at || $this->expires_at->isFuture());
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
