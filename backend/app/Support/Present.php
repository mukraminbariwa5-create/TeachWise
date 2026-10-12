<?php

namespace App\Support;

use App\Models\ClassOffering;
use App\Models\EvaluationPeriod;
use App\Models\School;
use App\Models\User;

/**
 * Small helpers that turn models into the JSON shapes the app expects,
 * so every endpoint describes a teacher, class or period the same way.
 */
class Present
{
    public static function user(User $user): array
    {
        $data = [
            'id' => $user->id,
            'id_number' => $user->id_number,
            'name' => $user->name,
            'initials' => $user->initials(),
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->departmentName(),
            'department_id' => $user->department_id,
            // Department admins manage only their department; school admins everything.
            'admin_scope' => $user->isAdmin() ? ($user->department_id ? 'department' : 'school') : null,
        ];

        if ($user->isStudent()) {
            $section = $user->studentProfile?->section;
            $data['section'] = $section ? ['id' => $section->id, 'label' => $section->label] : null;
        }

        return $data;
    }

    public static function person(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'initials' => $user->initials(),
            'department' => $user->departmentName(),
        ];
    }

    /** The signed-in person's school, with the settings the app needs. */
    public static function school(?School $school): ?array
    {
        if (! $school) {
            return null;
        }
        $s = $school->allSettings();

        return $school->publicInfo() + [
            'status' => $school->status,
            'settings' => [
                'term_label' => $s['term_label'],
                'peer_evaluation' => (bool) $s['peer_evaluation'],
                'min_responses' => (int) $s['min_responses'],
                'scale' => $s['scale'],
                'scale_fil' => $s['scale_fil'],
                'support_email' => $s['support_email'],
                'dpo_email' => $s['dpo_email'],
                'setup_completed' => (bool) $s['setup_completed'],
            ],
        ];
    }

    public static function offering(ClassOffering $offering): array
    {
        return [
            'id' => $offering->id,
            'subject' => [
                'id' => $offering->subject->id,
                'code' => $offering->subject->code,
                'name' => $offering->subject->name,
                'units' => $offering->subject->units,
            ],
            'section' => $offering->section->label,
            'schedule' => $offering->schedule,
        ];
    }

    public static function period(?EvaluationPeriod $period): ?array
    {
        if (! $period) {
            return null;
        }

        return [
            'id' => $period->id,
            'name' => $period->name,
            'type' => $period->type,
            'opens_at' => $period->opens_at->toIso8601String(),
            'closes_at' => $period->closes_at->toIso8601String(),
            'is_open' => $period->is_open,
        ];
    }
}
