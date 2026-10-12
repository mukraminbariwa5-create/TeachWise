<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Evaluation extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'school_id',
        'evaluation_period_id',
        'class_offering_id',
        'teacher_id',
        'evaluator_id',
        'evaluator_role',
        'overall_rating',
        'comment',
        'submitted_at',
    ];

    /** Never serialize who wrote an evaluation. */
    protected $hidden = ['evaluator_id'];

    protected function casts(): array
    {
        return [
            'overall_rating' => 'float',
            'submitted_at' => 'datetime',
        ];
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(EvaluationPeriod::class, 'evaluation_period_id');
    }

    public function offering(): BelongsTo
    {
        return $this->belongsTo(ClassOffering::class, 'class_offering_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(EvaluationAnswer::class);
    }
}
