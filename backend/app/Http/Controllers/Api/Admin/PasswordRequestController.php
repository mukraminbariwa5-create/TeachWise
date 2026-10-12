<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\AdminScope;
use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Support\Notifier;
use App\Models\PasswordResetRequest;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** "Forgot password?" requests. The admin resolves one by giving the person a temporary password. */
class PasswordRequestController extends Controller
{
    public function index(): JsonResponse
    {
        $requests = PasswordResetRequest::with('user.studentProfile.section')
            ->whereHas('user', fn ($q) => AdminScope::users($q))
            ->orderByRaw("status = 'pending' desc")
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'pending' => $requests->where('status', 'pending')->count(),
            'data' => $requests->map(fn (PasswordResetRequest $r) => [
                'id' => $r->id,
                'status' => $r->status,
                'note' => $r->note,
                'requested_at' => $r->created_at,
                'resolved_at' => $r->resolved_at,
                'user' => Present::user($r->user),
            ])->values(),
        ]);
    }

    /**
     * Sets a temporary password, signs the person out everywhere and tells them by notification.
     * The temporary password is returned once so the admin can pass it on.
     */
    public function resolve(Request $request, PasswordResetRequest $passwordRequest): JsonResponse
    {
        AdminScope::check(AdminScope::users(\App\Models\User::whereKey($passwordRequest->user_id))->exists());
        abort_if($passwordRequest->status !== 'pending', 422, 'This request was already resolved.');

        $temporary = 'TW-'.random_int(100000, 999999);
        $user = $passwordRequest->user;
        $user->update(['password' => $temporary]);
        $user->tokens()->delete();

        $passwordRequest->update(['status' => 'resolved', 'resolved_by' => $request->user()->id, 'resolved_at' => now()]);

        Notifier::send($user, 'account', 'Your password was reset', 'Sign in with the temporary password your admin gave you, then change it in Profile.');
        Audit::log('password.reset', "Reset the password of {$user->name} ({$user->id_number}).", $user);

        return response()->json(['message' => 'Password reset.', 'temporary_password' => $temporary]);
    }
}
