<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\Evaluation;
use App\Models\PushToken;
use App\Models\SupportMessage;
use App\Support\Notifier;
use App\Models\User;
use App\Support\Audit;
use App\Support\Present;
use App\Support\Say;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * The signed-in person's own account: settings, profile details, signed-in devices,
 * session renewal, push tokens, data download and account deletion.
 */
class AccountController extends Controller
{
    public function settings(Request $request): JsonResponse
    {
        return response()->json(['settings' => $request->user()->allSettings()]);
    }

    /** Partial update: {"tips": false} or {"notify": {"reminders": false}}. */
    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tips' => ['sometimes', 'boolean'],
            'notify' => ['sometimes', 'array'],
            'notify.periods' => ['sometimes', 'boolean'],
            'notify.reminders' => ['sometimes', 'boolean'],
            'notify.account' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();
        $user->update(['settings' => array_replace_recursive($user->allSettings(), $data)]);

        return response()->json(['settings' => $user->fresh()->allSettings()]);
    }

    /** Professor Wise's page tips are shown once per account, on any device. */
    public function seenTip(Request $request, string $key): JsonResponse
    {
        abort_unless(preg_match('/^[a-z0-9:._-]{1,60}$/', $key), 422);
        $user = $request->user();
        $settings = $user->allSettings();
        $settings['seen_tips'] = array_values(array_unique([...$settings['seen_tips'], $key]));
        $user->update(['settings' => $settings]);

        return response()->json(['seen_tips' => $settings['seen_tips']]);
    }

    /** Email (for account recovery) and phone number. Name, ID and section come from college records. */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users')->ignore($user)],
            'phone_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s()]{7,20}$/'],
        ]);
        $user->update($data);
        Audit::log('profile.updated', "{$user->name} updated their contact details.", $user);

        return response()->json(['user' => Present::user($user->load('studentProfile.section')) + ['phone_number' => $user->phone_number]]);
    }

    /** Devices this account is signed in on. */
    public function sessions(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();
        $current = $token instanceof PersonalAccessToken ? $token->id : null;

        return response()->json([
            'data' => $request->user()->tokens()->latest('last_used_at')->get()->map(fn (PersonalAccessToken $t) => [
                'id' => $t->id,
                'device' => explode('|', $t->name)[0] ?: 'TeachWise app',
                'last_used_at' => ($t->last_used_at ?? $t->created_at)?->toIso8601String(),
                'created_at' => $t->created_at?->toIso8601String(),
                'expires_at' => $t->expires_at?->toIso8601String(),
                'current' => $t->id === $current,
            ])->values(),
        ]);
    }

    public function revokeSession(Request $request, int $id): JsonResponse
    {
        $request->user()->tokens()->whereKey($id)->delete();

        return response()->json(['message' => Say::it('Signed out of that device.', 'Na-sign out na sa device na iyon.')]);
    }

    public function revokeOtherSessions(Request $request): JsonResponse
    {
        $user = $request->user();
        $token = $user->currentAccessToken();
        $count = $user->tokens()->when($token instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($token->id))->delete();
        Audit::log('sessions.revoked', "{$user->name} signed out of {$count} other device(s).", $user);

        return response()->json(['message' => Say::it("Signed out of {$count} other device(s).", "Na-sign out sa {$count} ibang device."), 'count' => $count]);
    }

    /**
     * Renews the sign-in before it runs out, keeping the same "stay signed in" choice.
     * The old token stops working; the app saves the new one.
     */
    public function refresh(Request $request): JsonResponse
    {
        $old = $request->user()->currentAccessToken();
        $old = $old instanceof PersonalAccessToken ? $old : null;
        [$device, $kind] = array_pad(explode('|', (string) $old?->name), 2, 'long');
        $remember = $kind !== 'short';
        $expires = $remember ? now()->addDays(config('teachwise.session_days')) : now()->addHours(config('teachwise.short_session_hours'));

        $new = $request->user()->createToken("{$device}|".($remember ? 'long' : 'short'), ['*'], $expires);
        $old?->delete();

        return response()->json(['token' => $new->plainTextToken, 'expires_at' => $expires->toIso8601String()]);
    }

    public function registerPushToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255', 'regex:/^(ExponentPushToken|ExpoPushToken)\[.+\]$/'],
            'platform' => ['nullable', 'string', 'max:20'],
        ]);
        PushToken::updateOrCreate(['token' => $data['token']], ['user_id' => $request->user()->id, 'platform' => $data['platform'] ?? null, 'last_used_at' => now()]);

        return response()->json(['message' => 'Saved.'], 201);
    }

    public function removePushToken(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:255']]);
        PushToken::where('user_id', $request->user()->id)->where('token', $data['token'])->delete();

        return response()->json(['message' => 'Removed.']);
    }

    /** Everything stored about this person, as a JSON file (Data Privacy Act: right to access). */
    public function export(Request $request): JsonResponse
    {
        $user = $request->user()->load('studentProfile.section');
        $evaluations = Evaluation::where('evaluator_id', $user->id)
            ->with(['teacher', 'offering.subject', 'period', 'answers.question'])
            ->orderBy('submitted_at')
            ->get()
            ->map(fn (Evaluation $e) => [
                'teacher' => $e->teacher?->name,
                'subject' => $e->offering?->subject?->name,
                'period' => $e->period?->name,
                'submitted_at' => $e->submitted_at?->toIso8601String(),
                'overall_rating' => $e->overall_rating,
                'comment' => $e->comment,
                'answers' => $e->answers->map(fn ($a) => ['question' => $a->question?->text, 'rating' => $a->rating, 'text' => $a->answer_text])->values(),
            ]);

        Audit::log('account.exported', "{$user->name} downloaded their data.", $user);

        return response()->json([
            'exported_at' => now()->toIso8601String(),
            'account' => Present::user($user) + [
                'phone_number' => $user->phone_number,
                'created_at' => $user->created_at?->toIso8601String(),
                'privacy_accepted_at' => $user->privacy_accepted_at?->toIso8601String(),
            ],
            'settings' => $user->allSettings(),
            'evaluations_submitted' => $evaluations,
            'notifications' => $user->appNotifications()->latest()->get(['title', 'message', 'read_at', 'created_at']),
            'professor_wise_chat' => ChatMessage::where('user_id', $user->id)->orderBy('id')->get(['role', 'content', 'created_at']),
        ]);
    }

    /**
     * Deletes the account after the password is confirmed. Submitted evaluations stay in
     * teachers' results but are no longer linked to anyone (they were anonymous already).
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']], [
            'password.current_password' => Say::it('That password is not correct.', 'Mali ang password.'),
        ]);
        $user = $request->user();
        abort_if($user->isPlatform(), 422, Say::it('Owner accounts are removed by another owner or on the server.', 'Ang owner account ay binubura ng ibang owner o sa server.'));

        // Teachers' and admins' records belong to the school, so their deletion goes through an admin.
        if (! $user->isStudent()) {
            $otherAdmins = Notifier::admins()->where('id', '!=', $user->id);
            // The only admin left asks TeachWise instead (someone must still run the school).
            $toTeachwise = $otherAdmins->isEmpty();
            SupportMessage::create(['user_id' => $user->id, 'kind' => 'contact', 'message' => 'Please delete my TeachWise account.', 'meta' => array_filter(['type' => 'account_deletion', 'to' => $toTeachwise ? 'teachwise' : null])]);
            Notifier::send($toTeachwise ? User::withoutGlobalScopes()->where('role', User::ROLE_PLATFORM)->where('is_active', true)->get() : $otherAdmins, 'account', 'Account deletion request', "{$user->name} ({$user->id_number}) asked for their account to be deleted.");
            Audit::log('account.deletion_requested', "{$user->name} asked for their account to be deleted.", $user);

            return response()->json(['requested' => true, 'message' => $toTeachwise
                ? Say::it('You are your school’s only admin, so TeachWise support will contact you. Invite another admin first if someone should take over.', 'Ikaw lang ang admin ng paaralan, kaya makikipag-ugnayan sa iyo ang TeachWise support. Mag-imbita muna ng ibang admin kung may papalit.')
                : Say::it('Request sent. An admin will delete your account and confirm with you.', 'Naipadala na ang request. Buburahin ng admin ang account mo at sasabihan ka.')], 202);
        }

        Audit::log('account.deleted', "{$user->name} ({$user->id_number}) deleted their account.", null, ['role' => $user->role], $user->id);
        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            $user->delete(); // evaluations keep their answers; evaluator_id becomes empty
        });

        return response()->json(['message' => Say::it('Your account was deleted.', 'Nabura na ang account mo.')]);
    }
}
