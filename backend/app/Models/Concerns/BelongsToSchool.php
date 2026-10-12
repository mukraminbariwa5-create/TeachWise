<?php

namespace App\Models\Concerns;

use App\Models\School;
use App\Support\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Keeps each school's data separate.
 *
 * While a school is active (Tenant::id()), every query on the model only sees that school's rows,
 * and new rows are saved under it. With no active school (sign-in, the platform console,
 * console commands) the filter is off, so that code must pick the school explicitly.
 */
trait BelongsToSchool
{
    public static function bootBelongsToSchool(): void
    {
        static::addGlobalScope('school', function (Builder $query) {
            if (Tenant::id() !== null) {
                $query->where($query->getModel()->qualifyColumn('school_id'), Tenant::id());
            }
        });

        static::creating(function ($model) {
            if (empty($model->school_id) && Tenant::id() !== null) {
                $model->school_id = Tenant::id();
            }
        });
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }
}
