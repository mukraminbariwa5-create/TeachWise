<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EvaluationPeriod extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'semester_id', 'name', 'type', 'opens_at', 'closes_at', 'announced_at', 'reminded_at'];

    protected $appends = ['is_open'];

    protected function casts(): array
    {
        return [
            'opens_at' => 'datetime',
            'closes_at' => 'datetime',
            'announced_at' => 'datetime',
            'reminded_at' => 'datetime',
        ];
    }

    /** The period of the given type that is open right now, if any. */
    public static function openNow(string $type = 'student'): ?self
    {
        return static::query()
            ->where('type', $type)
            ->where('opens_at', '<=', now())
            ->where('closes_at', '>=', now())
            ->orderBy('closes_at')
            ->first();
    }

    /** The open period, or else the next upcoming one, for showing on dashboards. */
    public static function currentOrNext(string $type = 'student'): ?self
    {
        return static::openNow($type)
            ?? static::query()->where('type', $type)->where('opens_at', '>', now())->orderBy('opens_at')->first();
    }

    public function getIsOpenAttribute(): bool
    {
        return $this->opens_at <= now() && $this->closes_at >= now();
    }

    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(Evaluation::class);
    }
}
