<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A college or department inside a school, e.g. "College of Computer Studies" (CCS). */
class Department extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'name', 'code'];

    protected static function booted(): void
    {
        // People show the department's name, so keep it current when it's renamed.
        static::updated(function (Department $department) {
            if ($department->wasChanged('name')) {
                User::withoutGlobalScopes()->where('department_id', $department->id)->update(['department' => $department->name]);
            }
        });
    }

    public function programs(): HasMany
    {
        return $this->hasMany(Program::class);
    }

    public function teachers(): HasMany
    {
        return $this->hasMany(User::class)->where('role', User::ROLE_TEACHER);
    }
}
