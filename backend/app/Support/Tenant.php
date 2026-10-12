<?php

namespace App\Support;

use App\Models\School;
use Closure;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Rules\Unique;

/**
 * The school the current request (or command) works inside.
 *
 * Every school-owned model (see BelongsToSchool) is automatically limited to this school,
 * and new records get it filled in. It is set from the signed-in user by the SetTenant
 * middleware, or explicitly for sign-up, invites and scheduled jobs.
 */
class Tenant
{
    private static ?int $id = null;

    private static ?School $school = null;

    public static function set(?int $schoolId): void
    {
        if (self::$id !== $schoolId) {
            self::$school = null;
        }
        self::$id = $schoolId;
    }

    public static function id(): ?int
    {
        return self::$id;
    }

    public static function school(): ?School
    {
        if (self::$id === null) {
            return null;
        }

        return self::$school ??= School::find(self::$id);
    }

    /** Run something inside one school, then restore the previous one. */
    public static function run(?int $schoolId, Closure $callback): mixed
    {
        $previous = self::$id;
        self::set($schoolId);
        try {
            return $callback();
        } finally {
            self::set($previous);
        }
    }

    /** "exists" validation limited to the current school, e.g. Tenant::exists('sections'). */
    public static function exists(string $table, string $column = 'id'): Exists
    {
        return Rule::exists($table, $column)->where('school_id', self::$id);
    }

    /** "unique" validation limited to the current school, e.g. Tenant::unique('users', 'id_number'). */
    public static function unique(string $table, string $column): Unique
    {
        return Rule::unique($table, $column)->where('school_id', self::$id);
    }
}
