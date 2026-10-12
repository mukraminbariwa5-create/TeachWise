<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invite;
use App\Models\User;
use App\Support\Audit;
use App\Support\Present;
use App\Support\Say;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Teachers and admins join their school with a one-time invite code from the school's admin
 * (or, for a new school's first admin, from the TeachWise owner).
 */
class InviteController extends Controller
{
    /** Step 1: is this code valid? Shows the school and role it is for. */
    public function check(Request $request): JsonResponse
    {
        $invite = $this->usable($request->validate(['code' => ['required', 'string', 'max:20']])['code']);

        return response()->json([
            'school' => $invite->school->publicInfo(),
            'role' => $invite->role,
            'department' => $invite->department?->name,
            'name' => $invite->name,
            'email' => $invite->email,
            'id_number' => $invite->id_number,
        ]);
    }

    /** Step 2: create the account inside the invite's school. */
    public function accept(Request $request): JsonResponse
    {
        $invite = $this->usable((string) $request->input('code'));
        Tenant::set($invite->school_id);

        $data = $request->validate([
            'code' => ['required', 'string'],
            'name' => ['required', 'string', 'max:255'],
            'id_number' => ['required', 'string', 'max:30', Tenant::unique('users', 'id_number')],
            'username' => ['required', 'string', 'alpha_dash', 'min:3', 'max:50', Rule::unique('users', 'username')],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Password::min(8)],
            'accepted_privacy' => ['accepted'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ], [
            'accepted_privacy.accepted' => Say::it('Please agree to the Data Privacy Notice to continue.', 'Pakisang-ayunan ang Data Privacy Notice para makapagpatuloy.'),
        ]);

        $user = DB::transaction(function () use ($invite, $data) {
            $user = User::create([
                'id_number' => trim($data['id_number']),
                'name' => trim($data['name']),
                'username' => $data['username'],
                'email' => $data['email'] ?? $invite->email,
                'role' => $invite->role,
                'department_id' => $invite->department_id,
                'department' => $invite->department?->name,
                'password' => $data['password'],
                'privacy_accepted_at' => now(),
            ]);
            $invite->update(['used_at' => now(), 'used_by' => $user->id]);

            return $user;
        });

        Audit::log('invite.accepted', "{$user->name} joined as {$user->role} with an invite code.", $user, [], $user->id);
        $token = $user->createToken(mb_substr(str_replace('|', ' ', $data['device_name'] ?? 'TeachWise app'), 0, 80).'|long', ['*'], now()->addDays(config('teachwise.session_days')))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => Present::user($user),
            'school' => Present::school($invite->school),
        ], 201);
    }

    private function usable(string $code): Invite
    {
        $invite = Invite::findUsable($code);
        if (! $invite || ! $invite->school?->isActive()) {
            throw ValidationException::withMessages(['code' => Say::it('This invite code isn’t valid or was already used. Ask your admin for a new one.', 'Hindi valid o nagamit na ang invite code na ito. Humingi ng bago sa admin.')]);
        }

        return $invite;
    }
}
