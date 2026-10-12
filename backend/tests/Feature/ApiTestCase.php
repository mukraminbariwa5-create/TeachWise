<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\User;
use App\Support\Tenant;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = DemoSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();
        // Test code (factories, direct queries) works inside the main demo school.
        Tenant::set(School::where('code', 'DEMO')->value('id'));
    }

    protected function tearDown(): void
    {
        Tenant::set(null);
        parent::tearDown();
    }

    protected function demoId(): int
    {
        return (int) School::where('code', 'DEMO')->value('id');
    }

    protected function actingAsUsername(string $username): User
    {
        $user = User::withoutGlobalScopes()->where('username', $username)->firstOrFail();
        Sanctum::actingAs($user);
        Tenant::set($user->school_id);

        return $user;
    }
}
