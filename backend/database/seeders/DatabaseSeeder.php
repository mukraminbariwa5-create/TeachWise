<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * A real install starts clean: no schools and no accounts.
     * Create the TeachWise owner account:   php artisan teachwise:create-admin --platform
     * Or set up one school directly:         php artisan teachwise:create-admin
     * Sample data for presentations:         php artisan teachwise:demo
     */
    public function run(): void
    {
        $this->call(QuestionSeeder::class);
    }
}
