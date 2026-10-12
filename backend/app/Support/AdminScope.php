<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * What an admin may manage. School admins: the whole school. Department admins (deans,
 * chairpersons): only their department's teachers, programs, sections, subjects and classes.
 * Every method leaves the query untouched for school admins.
 */
class AdminScope
{
    /** The department the signed-in admin is limited to, or null for the whole school. */
    public static function departmentId(): ?int
    {
        $user = auth()->user();

        return $user instanceof User && $user->isDepartmentAdmin() ? $user->department_id : null;
    }

    public static function limited(): bool
    {
        return self::departmentId() !== null;
    }

    /** Staff in the department, and students whose section's program is in it. */
    public static function users(Builder $query): Builder
    {
        $dept = self::departmentId();

        return $dept === null ? $query : $query->where(fn ($w) => $w
            ->where(fn ($s) => $s->whereIn('role', [User::ROLE_TEACHER, User::ROLE_ADMIN])->where('department_id', $dept))
            ->orWhere(fn ($s) => $s->where('role', User::ROLE_STUDENT)->whereHas('studentProfile.section.program', fn ($p) => $p->where('department_id', $dept))));
    }

    public static function sections(Builder $query): Builder
    {
        $dept = self::departmentId();

        return $dept === null ? $query : $query->whereHas('program', fn ($p) => $p->where('department_id', $dept));
    }

    public static function subjects(Builder $query): Builder
    {
        $dept = self::departmentId();

        return $dept === null ? $query : $query->where('department_id', $dept);
    }

    public static function programs(Builder $query): Builder
    {
        $dept = self::departmentId();

        return $dept === null ? $query : $query->where('department_id', $dept);
    }

    /** Classes taught to the department's sections or by its teachers. */
    public static function offerings(Builder $query): Builder
    {
        $dept = self::departmentId();

        return $dept === null ? $query : $query->where(fn ($w) => $w
            ->whereHas('section.program', fn ($p) => $p->where('department_id', $dept))
            ->orWhereHas('teacher', fn ($t) => $t->where('department_id', $dept)));
    }

    /** Stops department admins from something only the school admin may do. */
    public static function requireSchoolAdmin(): void
    {
        abort_if(self::limited(), 403, Say::it('Only your school admin can change this.', 'Ang admin lang ng paaralan ang puwedeng magbago nito.'));
    }

    /** 404 when a record is outside the admin's department (as if it didn't exist). */
    public static function check(bool $inside): void
    {
        abort_unless($inside, 404);
    }
}
