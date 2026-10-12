<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\User;
use App\Services\QuestionBank;
use App\Support\Audit;
use App\Support\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Creates the first accounts of a real install (there are no built-in accounts):
 * - the TeachWise owner, who approves schools:   teachwise:create-admin --platform
 * - an admin for a school (creating the school if needed): teachwise:create-admin --school=CODE
 */
class CreateAdmin extends Command
{
    protected $signature = 'teachwise:create-admin
        {--platform : Create the TeachWise owner account instead of a school admin}
        {--school= : Join code of the school (a new school is created if none exists)}
        {--school-name= : Name for a new school}
        {--name= : Full name}
        {--username= : Username used to sign in}
        {--id= : ID number, e.g. ADMIN-001}
        {--email= : Email (optional)}
        {--password= : Password (asked privately if left out)}';

    protected $description = 'Create the TeachWise owner or a school admin account';

    public function handle(): int
    {
        $platform = (bool) $this->option('platform');
        $school = $platform ? null : $this->pickSchool();
        if (! $platform && ! $school) {
            return self::FAILURE;
        }

        return Tenant::run($school?->id, fn () => $this->createAccount($school));
    }

    private function createAccount(?School $school): int
    {
        $data = [
            'name' => $this->option('name') ?: $this->ask('Full name'),
            'username' => $this->option('username') ?: $this->ask('Username'),
            'id_number' => $this->option('id') ?: $this->ask('ID number', $school ? 'ADMIN-'.str_pad((string) (User::where('role', 'admin')->count() + 1), 3, '0', STR_PAD_LEFT) : 'TW-OWNER'),
            'email' => $this->option('email') ?: ($this->input->isInteractive() ? $this->ask('Email (optional)') : null),
            'password' => $this->option('password') ?: $this->secret('Password (at least 8 characters)'),
        ];

        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'alpha_dash', 'min:3', 'max:50', 'unique:users,username'],
            'id_number' => ['required', 'string', 'max:30', Rule::unique('users', 'id_number')->where('school_id', $school?->id)],
            'email' => ['nullable', 'email', 'unique:users,email'],
            'password' => ['required', Password::min(8)],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::create($validator->validated() + [
            'school_id' => $school?->id,
            'role' => $school ? User::ROLE_ADMIN : User::ROLE_PLATFORM,
            'department' => $school ? 'Administration' : null,
            'is_active' => true,
        ]);
        Audit::log('user.created', $school ? "Created admin {$user->name} from the command line." : "Created the TeachWise owner {$user->name}.", $user, [], $user->id);

        $this->info($school
            ? "Admin {$user->name} created for {$school->name}. Sign in with \"{$user->username}\". Students join with the school code {$school->code}."
            : "TeachWise owner {$user->name} created. Sign in with \"{$user->username}\" to approve schools.");

        return self::SUCCESS;
    }

    private function pickSchool(): ?School
    {
        if ($code = $this->option('school')) {
            $school = School::where('code', strtoupper($code))->first();
            if ($school) {
                return $school;
            }
            $name = $this->option('school-name') ?: ($this->input->isInteractive() ? $this->ask("No school uses the code {$code}. Name of the new school") : null);
            if (! $name) {
                $this->error("No school uses the code {$code}. Add --school-name to create it.");

                return null;
            }

            return $this->newSchool($name, strtoupper($code));
        }

        $schools = School::orderBy('name')->get();
        if ($schools->count() === 1 && ! $this->input->isInteractive()) {
            return $schools->first();
        }
        if ($this->input->isInteractive() && $schools->isNotEmpty()) {
            $choice = $this->choice('Which school?', [...$schools->map(fn ($s) => "{$s->code} · {$s->name}")->all(), 'A new school'], 0);
            if ($choice !== 'A new school') {
                return $schools->firstWhere('code', explode(' · ', $choice)[0]);
            }
        }

        $name = $this->option('school-name') ?: ($this->input->isInteractive() ? $this->ask('Name of the school') : null);
        if (! $name) {
            $this->error('Choose a school with --school=CODE, or name a new one with --school-name="…".');

            return null;
        }

        return $this->newSchool($name);
    }

    private function newSchool(string $name, ?string $code = null): School
    {
        $school = School::create([
            'name' => $name,
            'short_name' => mb_substr($name, 0, 40),
            'code' => $code ?? School::makeCode($name),
            'status' => School::ACTIVE,
            'approved_at' => now(),
        ]);
        QuestionBank::install($school);
        $this->info("School {$school->name} created with the code {$school->code}.");

        return $school;
    }
}
