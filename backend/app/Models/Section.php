<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Section extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'program_id', 'course', 'year_level', 'name'];

    protected $appends = ['label'];

    protected function casts(): array
    {
        return ['year_level' => 'integer'];
    }

    /** e.g. "BSIT 4-A" */
    public function getLabelAttribute(): string
    {
        return "{$this->course} {$this->year_level}-{$this->name}";
    }

    protected static function booted(): void
    {
        // The course part of the label follows the program's code (e.g. "BSIT").
        static::saving(function (Section $section) {
            if ($section->program_id && $section->isDirty('program_id')) {
                $section->course = Program::find($section->program_id)?->code ?? $section->course;
            }
        });
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function students(): HasMany
    {
        return $this->hasMany(StudentProfile::class);
    }

    public function offerings(): HasMany
    {
        return $this->hasMany(ClassOffering::class);
    }
}
