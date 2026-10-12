<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A real install has no built-in accounts: only the default questions. */
class CleanInstallTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_seeding_creates_no_accounts(): void
    {
        User::query()->delete();
        $this->seed(DatabaseSeeder::class);
        $this->assertSame(0, User::count());
        $this->assertGreaterThan(0, Question::count());
        $this->assertNotNull(Question::first()->text_fil);

        $this->postJson('/api/auth/login', ['login' => 'admin', 'password' => 'password'])->assertStatus(422);
    }
}
