<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Throwable;

/** Writes a line to the admin's activity log. Never breaks the request if logging fails. */
class Audit
{
    public static function log(string $action, string $description, ?Model $subject = null, array $meta = [], ?int $userId = null): void
    {
        try {
            $userId ??= auth()->id();
            AuditLog::create([
                'school_id' => Tenant::id() ?? $subject?->getAttribute('school_id') ?? ($userId ? User::withoutGlobalScopes()->find($userId)?->school_id : null),
                'user_id' => $userId,
                'action' => $action,
                'description' => mb_substr($description, 0, 255),
                'subject_type' => $subject ? class_basename($subject) : null,
                'subject_id' => $subject?->getKey(),
                'meta' => $meta ?: null,
                'ip_address' => request()?->ip(),
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }
}
