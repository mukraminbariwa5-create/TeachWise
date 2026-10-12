<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginAttempt;
use App\Models\PasswordResetRequest;
use App\Models\School;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\WhitelistedId;
use App\Support\Audit;
use App\Support\Notifier;
use App\Support\Present;
use App\Support\Say;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /** Wrong passwords allowed before a short lockout. */
    private const MAX_FAILURES = 5;

    /** How long the lockout lasts (and how far back failures are counted). */
    private const LOCK_MINUTES = 10;

    /**
     * Log in with username, ID number or email. Returns a Sanctum token.
     * Wrong passwords answer with "attempts_left"; after 5 the login is locked
     * for 10 minutes and the answer says how many seconds are left ("retry_after").
     * "remember": false gives a 12-hour session instead of 30 days.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string'],
            'school_id' => ['nullable', 'integer'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'remember' => ['nullable', 'boolean'],
        ]);
        $school = $this->school($request);
        $key = mb_strtolower(trim($data['login'])).($school ? '@'.$school->id : '');

        if ($locked = $this->lockout($key)) {
            return $locked;
        }

        $matches = $this->findAccounts($data['login'], $school);
        if ($matches->count() > 1) {
            return response()->json([
                'message' => Say::it('This ID number is used in more than one school. Choose your school, then sign in.', 'Ginagamit ang ID number na ito sa higit sa isang paaralan. Piliin ang paaralan mo, saka mag-sign in.'),
                'errors' => ['login' => [Say::it('Choose your school first.', 'Piliin muna ang paaralan mo.')]],
                'needs_school' => true,
            ], 422);
        }
        $user = $matches->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            $this->logAttempt($request, $key, 'invalid_credentials');
            if ($locked = $this->lockout($key)) {
                return $locked;
            }
            $left = self::MAX_FAILURES - $this->recentFailures($key)->count();

            return response()->json([
                'message' => Say::it('The login or password is incorrect.', 'Mali ang login o password.'),
                'errors' => ['login' => [Say::it('The login or password is incorrect.', 'Mali ang login o password.')]],
                'attempts_left' => $left,
            ], 422);
        }

        if (! $user->is_active) {
            $this->logAttempt($request, $key, 'inactive_account');
            throw ValidationException::withMessages(['login' => Say::it('Your account is deactivated. Please contact the admin.', 'Naka-deactivate ang account mo. Makipag-ugnayan sa admin.')]);
        }

        if ($user->school_id && ! $user->school?->isActive()) {
            $this->logAttempt($request, $key, 'school_not_active');
            throw ValidationException::withMessages(['login' => Say::it('Your school’s TeachWise account is paused. Please contact your school administrator.', 'Naka-pause ang TeachWise account ng paaralan mo. Makipag-ugnayan sa admin ng paaralan.')]);
        }

        $this->logAttempt($request, $key, 'success');
        $user->load('studentProfile.section');

        return response()->json([
            'token' => $this->issueToken($user, $data['device_name'] ?? null, $data['remember'] ?? true),
            'user' => Present::user($user),
            'school' => Present::school($user->school),
        ]);
    }

    /**
     * Student self-registration. The ID number must be on the college list.
     * When the list has the student's name and section, those are used (so nobody joins the wrong section).
     */
    public function register(Request $request): JsonResponse
    {
        $school = $this->school($request, required: true);
        Tenant::set($school->id);

        $data = $request->validate([
            'id_number' => ['required', 'string', 'max:30', Tenant::unique('users', 'id_number')],
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'alpha_dash', 'min:3', 'max:50', Rule::unique('users', 'username')],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'section_id' => ['required', Tenant::exists('sections')],
            'password' => ['required', 'confirmed', Password::min(8)],
            'accepted_privacy' => ['accepted'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'remember' => ['nullable', 'boolean'],
        ], [
            'accepted_privacy.accepted' => Say::it('Please agree to the Data Privacy Notice to continue.', 'Pakisang-ayunan ang Data Privacy Notice para makapagpatuloy.'),
        ]);

        $listed = WhitelistedId::where('id_number', trim($data['id_number']))->first();
        if (! $listed) {
            throw ValidationException::withMessages(['id_number' => Say::it("This ID number isn't on {$school->name}'s list. Please contact your admin.", "Wala sa listahan ng {$school->name} ang ID na ito. Makipag-ugnayan sa admin.")]);
        }

        $user = DB::transaction(function () use ($data, $listed) {
            $user = User::create([
                'id_number' => trim($data['id_number']),
                'name' => $listed->name ?: trim($data['name']),
                'username' => $data['username'],
                'email' => $data['email'] ?? null,
                'role' => User::ROLE_STUDENT,
                'password' => $data['password'],
                'privacy_accepted_at' => now(),
            ]);
            StudentProfile::create(['user_id' => $user->id, 'section_id' => $listed->section_id ?: $data['section_id']]);

            return $user;
        });

        $user->load('studentProfile.section');

        return response()->json([
            'token' => $this->issueToken($user, $data['device_name'] ?? null, $data['remember'] ?? true),
            'user' => Present::user($user),
            'school' => Present::school($school),
        ], 201);
    }

    /**
     * Step 1 of sign-up: is this student ID allowed to create an account?
     * When the college list has details, it also returns the name and section to fill in.
     */
    public function checkId(Request $request): JsonResponse
    {
        $data = $request->validate(['id_number' => ['required', 'string', 'max:30']]);
        $id = trim($data['id_number']);
        $school = $this->school($request, required: true);
        Tenant::set($school->id);

        if (User::where('id_number', $id)->exists()) {
            return response()->json(['ok' => false, 'reason' => 'taken', 'message' => Say::it('This ID already has an account. Try signing in instead.', 'May account na ang ID na ito. Subukang mag-sign in.')]);
        }
        $listed = WhitelistedId::with('section')->where('id_number', $id)->first();
        if (! $listed) {
            return response()->json(['ok' => false, 'reason' => 'not_listed', 'message' => Say::it("This ID isn't on {$school->name}'s list yet. Check your school, or ask your admin to add it.", "Wala pa sa listahan ng {$school->name} ang ID na ito. I-check ang paaralan, o pakisabi sa admin na idagdag ito.")]);
        }

        return response()->json([
            'ok' => true,
            'message' => Say::it('Great, this ID can create an account.', 'Ayos, puwedeng gumawa ng account ang ID na ito.'),
            'name' => $listed->name,
            'section' => $listed->section ? ['id' => $listed->section->id, 'label' => $listed->section->label] : null,
        ]);
    }

    /** Live check while typing a username. When it is taken, suggests free ones. */
    public function checkUsername(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:50'],
            'id_number' => ['nullable', 'string', 'max:30'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);
        $name = trim($data['username']);

        if (! preg_match('/^[A-Za-z0-9_-]{3,50}$/', $name)) {
            return response()->json(['ok' => false, 'reason' => 'invalid', 'message' => Say::it('Use 3 or more letters, numbers, dashes or underscores.', 'Gumamit ng 3 o higit pang letra, numero, gitling o underscore.'), 'suggestions' => []]);
        }
        if (! User::whereRaw('LOWER(username) = ?', [mb_strtolower($name)])->exists()) {
            return response()->json(['ok' => true, 'message' => Say::it('Nice, that username is free.', 'Ayos, libre pa ang username na iyan.'), 'suggestions' => []]);
        }

        return response()->json([
            'ok' => false,
            'reason' => 'taken',
            'message' => Say::it('That username is taken. Try one of these:', 'May gumagamit na ng username na iyan. Subukan ang isa sa mga ito:'),
            'suggestions' => $this->usernameSuggestions($name, $data['id_number'] ?? null, $data['name'] ?? null),
        ]);
    }

    /**
     * "Forgot password?" A request goes to the admins, who set a temporary password.
     * The answer is the same whether or not the account exists, so it can't be used to find accounts.
     */
    public function requestPasswordReset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:255'],
            'school_id' => ['nullable', 'integer'],
        ]);

        $matches = $this->findAccounts($data['login'], $this->school($request));
        $user = $matches->count() === 1 && $matches->first()->school_id ? $matches->first() : null;

        if ($user && ! PasswordResetRequest::where('user_id', $user->id)->where('status', 'pending')->exists()) {
            PasswordResetRequest::create(['school_id' => $user->school_id, 'user_id' => $user->id, 'note' => $data['note'] ?? null]);
            Notifier::send(
                Notifier::admins($user->school_id),
                'account',
                'Password reset request',
                "{$user->name} ({$user->id_number}) forgot their password and asked for a reset.".(! empty($data['note']) ? " Note: {$data['note']}" : '')
            );
            Audit::log('password.reset_requested', "{$user->name} asked for a password reset.", $user, [], $user->id);
        }

        return response()->json([
            'message' => Say::it(
                'Request sent. If that account exists, your admin will give you a temporary password.',
                'Naipadala na ang request. Kung may ganitong account, bibigyan ka ng admin ng pansamantalang password.'
            ),
        ]);
    }

    /** Sections of one school (?school_id=), for the sign-up screen. */
    public function sections(Request $request): JsonResponse
    {
        $school = $this->school($request, required: true);

        return response()->json([
            'data' => Tenant::run($school->id, fn () => Section::orderBy('course')->orderBy('year_level')->orderBy('name')->get(['id', 'course', 'year_level', 'name'])),
        ]);
    }

    /** The signed-in user, their settings, and when this sign-in expires (the app renews it before then). */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('studentProfile.section');
        $token = $user->currentAccessToken();

        return response()->json([
            'user' => Present::user($user) + ['phone_number' => $user->phone_number],
            'school' => Present::school($user->school),
            'settings' => $user->allSettings(),
            'token_expires_at' => $token instanceof PersonalAccessToken && $token->expires_at instanceof \DateTimeInterface ? $token->expires_at->format(DATE_ATOM) : null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $user = $request->user();
        $user->update(['password' => $data['password']]);
        // Other devices must sign in again with the new password.
        $token = $user->currentAccessToken();
        $user->tokens()->when($token instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($token->id))->delete();
        Audit::log('password.changed', "{$user->name} changed their password.", $user);

        return response()->json(['message' => Say::it('Password updated.', 'Napalitan na ang password.')]);
    }

    // ---------------------------------------------------------------- helpers

    /** The school picked on the sign-in or sign-up screen (?school_id=), if any. Only active schools. */
    private function school(Request $request, bool $required = false): ?School
    {
        $id = $request->integer('school_id');
        $school = $id ? School::where('status', School::ACTIVE)->find($id) : null;
        if ($required && ! $school) {
            throw ValidationException::withMessages(['school_id' => Say::it('Choose your school first.', 'Piliin muna ang paaralan mo.')]);
        }

        return $school;
    }

    /**
     * Accounts matching what was typed. Usernames and emails are unique across TeachWise;
     * ID numbers only within a school, so an ID can match people in several schools.
     */
    private function findAccounts(string $login, ?School $school)
    {
        $login = trim($login);
        $byName = User::query()->where('username', $login)->orWhere('email', $login)->get();
        if ($byName->isNotEmpty()) {
            return $byName->take(1);
        }

        return User::query()->where('id_number', $login)->when($school, fn ($q) => $q->where('school_id', $school->id))->limit(5)->get();
    }

    /** Token name = "device|long" or "device|short", so sessions can be listed and renewed the same way. */
    private function issueToken(User $user, ?string $device, bool $remember): string
    {
        $expires = $remember ? now()->addDays(config('teachwise.session_days')) : now()->addHours(config('teachwise.short_session_hours'));
        $name = mb_substr(str_replace('|', ' ', $device ?: 'TeachWise app'), 0, 80).'|'.($remember ? 'long' : 'short');

        return $user->createToken($name, ['*'], $expires)->plainTextToken;
    }

    /** Wrong passwords for this login in the last 10 minutes, since its last successful sign-in. */
    private function recentFailures(string $key)
    {
        $lastSuccess = LoginAttempt::where('login', $key)->where('reason', 'success')->max('attempted_at');

        return LoginAttempt::where('login', $key)
            ->where('reason', 'invalid_credentials')
            ->where('attempted_at', '>=', now()->subMinutes(self::LOCK_MINUTES))
            ->when($lastSuccess, fn ($q) => $q->where('attempted_at', '>', $lastSuccess))
            ->orderByDesc('attempted_at');
    }

    private function lockout(string $key): ?JsonResponse
    {
        $failures = $this->recentFailures($key)->limit(self::MAX_FAILURES)->pluck('attempted_at');
        if ($failures->count() < self::MAX_FAILURES) {
            return null;
        }

        $unlockAt = \Illuminate\Support\Carbon::parse($failures->last())->addMinutes(self::LOCK_MINUTES);
        $seconds = max(1, (int) ceil(now()->diffInSeconds($unlockAt, false)));

        return response()->json([
            'message' => Say::it(
                'Too many wrong passwords. Please wait a few minutes, or use "Forgot password?".',
                'Sobrang daming maling password. Maghintay ng ilang minuto, o pindutin ang "Nakalimutan ang password?".'
            ),
            'errors' => ['login' => [Say::it('Too many wrong passwords.', 'Sobrang daming maling password.')]],
            'locked' => true,
            'retry_after' => $seconds,
        ], 429);
    }

    /** @return list<string> up to three free usernames close to what they typed. */
    private function usernameSuggestions(string $wanted, ?string $idNumber, ?string $fullName): array
    {
        $base = mb_substr(preg_replace('/[^a-z0-9_-]/', '', mb_strtolower($wanted)) ?: 'student', 0, 40);
        $year = $idNumber && preg_match('/^(\d{2})(\d{2})/', $idNumber, $m) ? $m[2] : null;
        $words = $fullName ? preg_split('/\s+/', mb_strtolower(trim(preg_replace('/[^A-Za-z\s]/', '', $fullName)))) : [];

        $candidates = array_filter([
            $year ? "{$base}{$year}" : null,
            count($words) > 1 ? $words[0].'_'.end($words) : null,
            count($words) > 1 ? mb_substr($words[0], 0, 1).end($words) : null,
            "{$base}_tw",
            $base.random_int(2, 9),
            $base.random_int(10, 99),
            $base.random_int(100, 999),
        ]);

        $taken = User::whereIn(DB::raw('LOWER(username)'), $candidates)->pluck('username')->map(fn ($u) => mb_strtolower($u))->all();

        return array_values(array_slice(array_unique(array_diff($candidates, $taken)), 0, 3));
    }

    private function logAttempt(Request $request, string $login, string $reason): void
    {
        LoginAttempt::create([
            'login' => mb_substr($login, 0, 100),
            'reason' => $reason,
            'ip_address' => $request->ip(),
            'attempted_at' => now(),
        ]);
    }
}
