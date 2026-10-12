<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Section;
use App\Support\AdminScope;
use App\Support\Tenant;
use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'role' => ['nullable', Rule::in(['admin', 'teacher', 'student'])],
            'section_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $page = AdminScope::users(User::query())
            ->with('studentProfile.section')
            ->when($data['department_id'] ?? null, fn ($q, $id) => $q->where('department_id', $id))
            ->when($data['role'] ?? null, fn ($q, $role) => $q->where('role', $role))
            ->when($data['section_id'] ?? null, fn ($q, $id) => $q->whereHas('studentProfile', fn ($p) => $p->where('section_id', $id)))
            ->when($data['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$s}%")->orWhere('username', 'like', "%{$s}%")->orWhere('id_number', 'like', "%{$s}%")))
            ->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 25), 1), 500));

        $page->getCollection()->transform(fn (User $u) => Present::user($u) + ['is_active' => $u->is_active]);

        return response()->json($page);
    }

    public function show(User $user): JsonResponse
    {
        $this->inScope($user);

        return response()->json(['user' => Present::user($user->load('studentProfile.section')) + ['is_active' => $user->is_active]]);
    }

    /**
     * Admins don't create accounts: students sign up with an approved ID and staff join with an invite,
     * so everyone picks their own password and agrees to the privacy notice themselves.
     * Admins can correct records, move students, change a staff member's department or role, and turn accounts off.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $this->inScope($user);
        $data = $this->validated($request, $user);

        DB::transaction(function () use ($user, $data) {
            $user->update(collect($data)->except('section_id')->all());
            if ($user->isStudent() && array_key_exists('section_id', $data)) {
                StudentProfile::updateOrCreate(['user_id' => $user->id], ['section_id' => $data['section_id']]);
            }
        });
        if (($data['is_active'] ?? true) === false) {
            $user->tokens()->delete();
        }

        Audit::log('user.updated', "Updated {$user->name} ({$user->id_number}).", $user, ['fields' => array_keys($data)]);

        return response()->json(['user' => Present::user($user->fresh()->load('studentProfile.section')) + ['is_active' => $user->fresh()->is_active]]);
    }

    /** For someone who can't sign in: a one-time temporary password, shown once. They're signed out everywhere. */
    public function temporaryPassword(Request $request, User $user): JsonResponse
    {
        $this->inScope($user);
        abort_if($user->id === $request->user()->id, 422, 'Change your own password in Profile.');

        $temporary = 'TW-'.random_int(100000, 999999);
        $user->update(['password' => $temporary]);
        $user->tokens()->delete();
        \App\Models\PasswordResetRequest::where('user_id', $user->id)->where('status', 'pending')
            ->update(['status' => 'resolved', 'resolved_by' => $request->user()->id, 'resolved_at' => now()]);
        Notifier::send($user, 'account', 'Your password was reset', 'Sign in with the temporary password your admin gave you, then change it in Profile.');
        Audit::log('password.reset', "Gave {$user->name} ({$user->id_number}) a temporary password.", $user);

        return response()->json(['message' => 'Temporary password created.', 'temporary_password' => $temporary]);
    }

    /**
     * Only for accounts made by mistake. People with a teaching record or evaluations are turned off
     * instead, so reports and anonymous results stay intact.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->inScope($user);
        abort_if($user->id === $request->user()->id, 422, 'You can’t delete your own account here. Use Settings → Delete account.');
        $hasHistory = $user->offerings()->exists() || $user->evaluationsReceived()->exists() || $user->evaluationsGiven()->exists();
        abort_if($hasHistory, 422, 'This person has classes or evaluations. Turn their account off instead, so their records stay intact.');
        if ($user->isAdmin()) {
            abort_if(User::where('role', User::ROLE_ADMIN)->whereNull('department_id')->where('is_active', true)->whereKeyNot($user->id)->doesntExist() && $user->department_id === null, 422, 'Your school needs at least one school admin.');
        }

        Audit::log('user.deleted', "Deleted {$user->role} {$user->name} ({$user->id_number}).", null, ['user_id' => $user->id]);
        $user->delete();

        return response()->json(['message' => 'Account deleted.']);
    }

    private function validated(Request $request, User $user): array
    {
        $self = $user->id === $request->user()->id;
        $staff = ! $user->isStudent();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'id_number' => ['sometimes', 'string', 'max:30', Tenant::unique('users', 'id_number')->ignore($user)],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('users')->ignore($user)],
            // Students stay students. School admins can turn a teacher into an admin (e.g. a new dean) and back.
            'role' => ['sometimes', Rule::in($staff && ! AdminScope::limited() ? ['teacher', 'admin'] : [$user->role])],
            'department_id' => ['sometimes', 'nullable', 'integer', Tenant::exists('departments')],
            'section_id' => ['sometimes', 'nullable', 'integer', Tenant::exists('sections')],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($self) {
            // Nobody can lock themselves out or change their own powers.
            abort_if(array_key_exists('role', $data) && $data['role'] !== $user->role, 422, 'You can’t change your own role.');
            abort_if(($data['is_active'] ?? true) === false, 422, 'You can’t turn off your own account.');
            abort_if(array_key_exists('department_id', $data) && $data['department_id'] !== $user->department_id, 422, 'Ask another school admin to change your department.');
        }
        if (! $staff) {
            unset($data['department_id']);
        } else {
            unset($data['section_id']);
        }

        if (AdminScope::limited()) {
            unset($data['department_id'], $data['role']);
            if (! empty($data['section_id'])) {
                abort_unless(AdminScope::sections(Section::whereKey($data['section_id']))->exists(), 422, 'Choose a section in your department.');
            }
        }
        if (array_key_exists('department_id', $data) && $data['department_id'] === null) {
            $data['department'] = null;
        }

        return $data;
    }

    private function inScope(User $user): void
    {
        AdminScope::check(AdminScope::users(User::whereKey($user->id))->exists());
        // Department admins can't change other admins.
        abort_if(AdminScope::limited() && $user->isAdmin() && $user->id !== auth()->id(), 403, 'Only your school admin can change other admins.');
    }
}
