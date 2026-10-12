<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        $n = Str::lower(Str::random(8));

        return [
            'id_number' => 'U-'.Str::upper(Str::random(10)),
            'name' => 'User '.Str::title($n),
            'username' => $n,
            'email' => $n.'@example.test',
            'role' => User::ROLE_STUDENT,
            'is_active' => true,
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => User::ROLE_ADMIN]);
    }

    public function teacher(): static
    {
        return $this->state(fn () => ['role' => User::ROLE_TEACHER, 'department' => 'IT Department']);
    }

    public function student(): static
    {
        return $this->state(fn () => ['role' => User::ROLE_STUDENT]);
    }
}
