<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subject extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'department_id', 'code', 'name', 'year_level', 'units'];

    protected function casts(): array
    {
        return ['year_level' => 'integer', 'units' => 'integer'];
    }

    public function offerings(): HasMany
    {
        return $this->hasMany(ClassOffering::class);
    }

    public function department(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
