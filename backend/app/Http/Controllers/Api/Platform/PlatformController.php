<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\ClientError;
use App\Models\Evaluation;
use App\Models\Invite;
use App\Models\School;
use App\Models\SupportMessage;
use App\Models\User;
use App\Services\QuestionBank;
use App\Support\Audit;
use App\Support\Notifier;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * The TeachWise owner's console: school applications, approving and pausing schools,
 * first-admin invites, and app health. Numbers only; never evaluation answers or comments.
 */
class PlatformController extends Controller
{
    public function overview(): JsonResponse
    {
        return response()->json([
            'schools' => [
                'active' => School::where('status', School::ACTIVE)->count(),
                'pending' => School::where('status', School::PENDING)->count(),
                'suspended' => School::where('status', School::SUSPENDED)->count(),
            ],
            'people' => [
                'students' => User::where('role', User::ROLE_STUDENT)->whereNotNull('school_id')->count(),
                'teachers' => User::where('role', User::ROLE_TEACHER)->whereNotNull('school_id')->count(),
                'admins' => User::where('role', User::ROLE_ADMIN)->whereNotNull('school_id')->count(),
            ],
            'evaluations' => [
                'total' => Evaluation::count(),
                'last_30_days' => Evaluation::where('submitted_at', '>=', now()->subDays(30))->count(),
            ],
            'errors_last_7_days' => ClientError::where('created_at', '>=', now()->subDays(7))->count(),
            'open_messages' => SupportMessage::where('meta->to', 'teachwise')->where('status', 'open')->count(),
            'pending' => School::where('status', School::PENDING)->latest()->limit(10)->get()->map(fn (School $s) => $this->row($s)),
            'deletion_requests' => School::get()->filter(fn (School $s) => $s->setting('deletion_requested_at'))->map(fn (School $s) => $this->row($s))->values(),
        ]);
    }

    public function schools(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('search', ''));
        $schools = School::query()
            ->when($request->query('status'), fn ($w, $status) => $w->where('status', $status))
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('name', 'like', "%{$q}%")->orWhere('code', 'like', "%{$q}%")->orWhere('location', 'like', "%{$q}%")))
            ->withCount([
                'users as students_count' => fn ($u) => $u->where('role', User::ROLE_STUDENT),
                'users as teachers_count' => fn ($u) => $u->where('role', User::ROLE_TEACHER),
            ])
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END")
            ->orderBy('name')
            ->paginate(30);

        $schools->getCollection()->transform(fn (School $s) => $this->row($s) + ['students' => $s->students_count, 'teachers' => $s->teachers_count]);

        return response()->json($schools);
    }

    public function show(School $school): JsonResponse
    {
        return response()->json([
            'school' => $this->row($school) + [
                'contact_name' => $school->contact_name,
                'contact_position' => $school->contact_position,
                'contact_email' => $school->contact_email,
                'contact_phone' => $school->contact_phone,
                'student_count' => $school->student_count,
                'message' => $school->message,
                'suspended_reason' => $school->suspended_reason,
                'deletion_requested_at' => $school->setting('deletion_requested_at'),
                'deletion_reason' => $school->setting('deletion_reason'),
            ],
            'stats' => [
                'students' => $school->users()->where('role', User::ROLE_STUDENT)->count(),
                'teachers' => $school->users()->where('role', User::ROLE_TEACHER)->count(),
                'evaluations' => Evaluation::where('school_id', $school->id)->count(),
                'last_active' => $school->users()->max('updated_at'),
            ],
            'admins' => $school->users()->where('role', User::ROLE_ADMIN)->get()->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'username' => $u->username, 'department' => $u->department_id ? $u->department : null]),
            'admin_invites' => Invite::withoutGlobalScopes()->where('school_id', $school->id)->where('role', 'admin')->whereNull('used_at')->latest('id')->get()
                ->map(fn (Invite $i) => ['code' => $i->code, 'name' => $i->name, 'email' => $i->email, 'expires_at' => $i->expires_at?->toIso8601String(), 'usable' => $i->isUsable()]),
        ]);
    }

    /** Approve an application: the school becomes active with the default form, and gets a first-admin invite. */
    public function approve(Request $request, School $school): JsonResponse
    {
        abort_unless($school->status === School::PENDING, 422, 'Only schools waiting for approval can be approved.');
        $school->update(['status' => School::ACTIVE, 'approved_at' => now()]);
        QuestionBank::install($school);
        $invite = $this->adminInvite($school, $school->contact_name, $school->contact_email);
        Audit::log('school.approved', "Approved {$school->name}.", $school);

        return response()->json(['message' => "{$school->name} is now active.", 'invite' => $invite]);
    }

    /** Turn down an application (it's removed). */
    public function reject(School $school): JsonResponse
    {
        abort_unless($school->status === School::PENDING, 422, 'Only applications can be rejected.');
        Audit::log('school.rejected', "Rejected the application from {$school->name}.");
        $school->delete();

        return response()->json(['message' => 'Application removed.']);
    }

    /** Another first-admin invite (e.g. the first one expired or went to the wrong person). */
    public function inviteAdmin(Request $request, School $school): JsonResponse
    {
        $data = $request->validate(['name' => ['nullable', 'string', 'max:150'], 'email' => ['nullable', 'email', 'max:150']]);
        abort_unless($school->isActive(), 422, 'Approve or reactivate the school first.');

        return response()->json(['invite' => $this->adminInvite($school, $data['name'] ?? null, $data['email'] ?? null)], 201);
    }

    public function suspend(Request $request, School $school): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);
        $school->update(['status' => School::SUSPENDED, 'suspended_reason' => $data['reason']]);
        $school->users()->each(fn (User $u) => $u->tokens()->delete());
        Audit::log('school.suspended', "Paused {$school->name}: {$data['reason']}", $school);

        return response()->json(['message' => "{$school->name} is paused. Its people can't sign in until you reactivate it."]);
    }

    public function activate(School $school): JsonResponse
    {
        abort_unless($school->status === School::SUSPENDED, 422, 'This school is not paused.');
        $school->update(['status' => School::ACTIVE, 'suspended_reason' => null]);
        Audit::log('school.activated', "Reactivated {$school->name}.", $school);

        return response()->json(['message' => "{$school->name} is active again."]);
    }

    /** Permanently deletes a paused school and everything in it. Type the school's code to confirm. */
    public function destroy(Request $request, School $school): JsonResponse
    {
        $request->validate(['confirm' => ['required', 'string']]);
        abort_unless($school->status === School::SUSPENDED, 422, 'Pause the school first, then delete it.');
        abort_unless(strtoupper($request->input('confirm')) === $school->code, 422, 'Type the school code exactly to confirm.');

        if ($school->logo_path) {
            Storage::disk('local')->delete($school->logo_path);
        }
        $name = $school->name;
        Tenant::run($school->id, fn () => User::where('school_id', $school->id)->each(fn (User $u) => $u->tokens()->delete()));
        $school->delete();
        Audit::log('school.deleted', "Deleted {$name} and all of its data.");

        return response()->json(['message' => "{$name} and all of its data were deleted."]);
    }

    /** Messages and problem reports from school admins, addressed to TeachWise support. */
    public function messages(Request $request): JsonResponse
    {
        $status = $request->query('status', 'open');
        $page = SupportMessage::with('user', 'school:id,name,code')
            ->where('meta->to', 'teachwise')
            ->when(in_array($status, ['open', 'closed'], true), fn ($q) => $q->where('status', $status))
            ->latest('id')
            ->paginate(30);
        $page->getCollection()->transform(fn (SupportMessage $m) => [
            'id' => $m->id,
            'kind' => $m->kind,
            'message' => $m->message,
            'meta' => $m->meta,
            'status' => $m->status,
            'created_at' => $m->created_at?->toIso8601String(),
            'user' => $m->user ? ['name' => $m->user->name, 'email' => $m->user->email, 'role' => $m->user->role, 'department' => $m->user->department] : null,
            'school' => $m->school ? ['id' => $m->school->id, 'name' => $m->school->name, 'code' => $m->school->code] : null,
        ]);

        return response()->json(array_merge($page->toArray(), [
            'open_count' => SupportMessage::where('meta->to', 'teachwise')->where('status', 'open')->count(),
        ]));
    }

    public function closeMessage(SupportMessage $message): JsonResponse
    {
        abort_unless(($message->meta['to'] ?? null) === 'teachwise', 404);
        $message->update(['status' => 'closed']);

        return response()->json(['message' => 'Marked as done.']);
    }

    public function errors(): JsonResponse
    {
        return response()->json(ClientError::with('school:id,name')->latest('id')->paginate(30));
    }

    private function adminInvite(School $school, ?string $name, ?string $email): array
    {
        $invite = Invite::create([
            'school_id' => $school->id,
            'role' => 'admin',
            'name' => $name,
            'email' => $email,
            'code' => Invite::generateCode(),
            'expires_at' => now()->addDays(14),
            'created_by' => auth()->id(),
        ]);

        return ['code' => $invite->code, 'name' => $invite->name, 'email' => $invite->email, 'expires_at' => $invite->expires_at->toIso8601String()];
    }

    private function row(School $s): array
    {
        return $s->publicInfo() + [
            'status' => $s->status,
            'contact_name' => $s->contact_name,
            'contact_email' => $s->contact_email,
            'applied_at' => $s->created_at?->toIso8601String(),
            'approved_at' => $s->approved_at?->toIso8601String(),
        ];
    }
}
