<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, BelongsToSchool;

    /** The TeachWise owner: manages schools, never sees evaluation answers. */
    public const ROLE_PLATFORM = 'platform';
    /** A school admin, or a department admin when department_id is set. */
    public const ROLE_ADMIN = 'admin';
    public const ROLE_TEACHER = 'teacher';
    public const ROLE_STUDENT = 'student';

    protected $fillable = [
        'school_id',
        'department_id',
        'id_number',
        'name',
        'middle_name',
        'username',
        'email',
        'phone_number',
        'role',
        'department',
        'is_active',
        'privacy_accepted_at',
        'settings',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'privacy_accepted_at' => 'datetime',
            'settings' => 'array',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isPlatform(): bool
    {
        return $this->role === self::ROLE_PLATFORM;
    }

    /** Admin for the whole school (registrar, QA office). */
    public function isSchoolAdmin(): bool
    {
        return $this->isAdmin() && $this->department_id === null;
    }

    /** Admin for one department only (dean, chairperson). */
    public function isDepartmentAdmin(): bool
    {
        return $this->isAdmin() && $this->department_id !== null;
    }

    public function departmentRelation(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** Department name (kept in sync with the department record when one is set). */
    public function departmentName(): ?string
    {
        return $this->department;
    }

    protected static function booted(): void
    {
        static::saving(function (User $user) {
            if ($user->department_id && $user->isDirty('department_id')) {
                $user->department = Department::withoutGlobalScopes()->find($user->department_id)?->name ?? $user->department;
            }
        });
    }

    public function isTeacher(): bool
    {
        return $this->role === self::ROLE_TEACHER;
    }

    public function isStudent(): bool
    {
        return $this->role === self::ROLE_STUDENT;
    }

    public function studentProfile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }

    /** Classes this user teaches. */
    public function offerings(): HasMany
    {
        return $this->hasMany(ClassOffering::class, 'teacher_id');
    }

    /** Evaluations about this user (as a teacher). */
    public function evaluationsReceived(): HasMany
    {
        return $this->hasMany(Evaluation::class, 'teacher_id');
    }

    /** Evaluations this user has submitted. */
    public function evaluationsGiven(): HasMany
    {
        return $this->hasMany(Evaluation::class, 'evaluator_id');
    }

    /** Per-account preferences. Anything not saved yet uses these defaults. */
    public const DEFAULT_SETTINGS = [
        'tips' => true,
        'seen_tips' => [],
        'notify' => ['periods' => true, 'reminders' => true, 'account' => true],
    ];

    /** @return array{tips: bool, seen_tips: list<string>, notify: array{periods: bool, reminders: bool, account: bool}} */
    public function allSettings(): array
    {
        $saved = $this->settings ?? [];
        $merged = array_replace_recursive(self::DEFAULT_SETTINGS, $saved);
        $merged['seen_tips'] = array_values(array_unique($saved['seen_tips'] ?? []));

        return $merged;
    }

    public function wantsNotification(string $category): bool
    {
        return (bool) data_get($this->allSettings(), "notify.{$category}", true);
    }

    public function pushTokens(): HasMany
    {
        return $this->hasMany(PushToken::class);
    }

    public function appNotifications(): HasMany
    {
        return $this->hasMany(AppNotification::class);
    }

    /** Two-letter initials for avatar circles, e.g. "Prof. Liza Santos" -> "LS". */
    public function initials(): string
    {
        $words = preg_split('/\s+/', trim(preg_replace('/^(prof|dr|mr|ms|mrs|engr)\.?\s+/i', '', $this->name)));
        $first = mb_substr($words[0] ?? '', 0, 1);
        // Second word, so compound surnames work: "Ramon Dela Cruz" -> "RD".
        $last = count($words) > 1 ? mb_substr($words[1], 0, 1) : '';

        return mb_strtoupper($first.$last);
    }
}
