<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Invite;
use App\Models\User;
use App\Support\AdminScope;
use App\Support\Audit;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Invite codes for teachers and admins. Department admins can invite teachers to their department;
 * school admins anyone. Several at once: send a list of names.
 */
class InviteController extends Controller
{
    public function index(): JsonResponse
    {
        $invites = Invite::query()
            ->when(AdminScope::limited(), fn ($q) => $q->where('department_id', AdminScope::departmentId()))
            ->with('department:id,name')
            ->latest('id')->limit(300)->get()
            ->map(fn (Invite $i) => $this->present($i));

        return response()->json(['data' => $invites]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(AdminScope::limited() ? ['teacher'] : ['teacher', 'admin'])],
            'department_id' => ['nullable', 'integer', Tenant::exists('departments')],
            'people' => ['required', 'array', 'min:1', 'max:300'],
            'people.*.name' => ['nullable', 'string', 'max:150'],
            'people.*.email' => ['nullable', 'email', 'max:150'],
            'people.*.id_number' => ['nullable', 'string', 'max:30'],
        ]);
        $departmentId = AdminScope::limited() ? AdminScope::departmentId() : ($data['department_id'] ?? null);

        $created = collect($data['people'])->map(fn ($p) => Invite::create([
            'role' => $data['role'],
            'department_id' => $departmentId,
            'name' => $p['name'] ?? null,
            'email' => $p['email'] ?? null,
            'id_number' => $p['id_number'] ?? null,
            'code' => Invite::generateCode(),
            'expires_at' => now()->addDays(30),
            'created_by' => $request->user()->id,
        ])->load('department:id,name'));

        $who = $data['role'] === 'admin' ? ($departmentId ? 'department admin' : 'school admin') : 'teacher';
        Audit::log('invite.created', "Created {$created->count()} {$who} invite code(s).");

        return response()->json(['data' => $created->map(fn ($i) => $this->present($i))->values()], 201);
    }

    public function destroy(Invite $invite): JsonResponse
    {
        AdminScope::check(! AdminScope::limited() || $invite->department_id === AdminScope::departmentId());
        abort_if($invite->used_at, 422, 'This code was already used.');
        $invite->delete();

        return response()->json(['message' => 'Invite cancelled.']);
    }

    private function present(Invite $i): array
    {
        return [
            'id' => $i->id,
            'code' => $i->code,
            'role' => $i->role,
            'department' => $i->department?->name,
            'name' => $i->name,
            'email' => $i->email,
            'status' => $i->used_at ? 'used' : ($i->isUsable() ? 'waiting' : 'expired'),
            'used_by' => $i->used_by ? User::find($i->used_by)?->name : null,
            'expires_at' => $i->expires_at?->toIso8601String(),
            'created_at' => $i->created_at?->toIso8601String(),
        ];
    }
}
