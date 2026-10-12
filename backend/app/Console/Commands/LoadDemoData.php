<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\DemoSeeder;
use Database\Seeders\DemoUpgradeSeeder;
use Illuminate\Console\Command;

/** Loads sample school data for presentations. Never runs by itself. */
class LoadDemoData extends Command
{
    protected $signature = 'teachwise:demo
        {--force : Allow on a production server}
        {--upgrade-only : Only update demo data loaded by an older version; never add demo data to a real database}';

    protected $description = 'Load sample data (demo accounts use the password "password")';

    public function handle(): int
    {
        return \App\Support\Tenant::run(null, fn () => $this->load());
    }

    private function load(): int
    {
        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('This is a production server. Demo data would add accounts with a known password. Use --force only on a test copy.');

            return self::FAILURE;
        }
        if ($this->option('upgrade-only') && (! User::where('username', 'aisha')->exists() || User::where('username', 'owner')->exists())) {
            return self::SUCCESS;
        }
        if (User::where('username', 'aisha')->exists()) {
            if (User::where('username', 'owner')->exists()) {
                $this->warn('Demo data is already loaded.');

                return self::SUCCESS;
            }
            $this->call('db:seed', ['--class' => DemoUpgradeSeeder::class, '--force' => true]);
            $this->info('Demo data updated for multiple schools.');
        } else {
            $this->call('db:seed', ['--class' => DemoSeeder::class, '--force' => true]);
            $this->info('Demo data loaded.');
        }

        $this->table(['Account', 'What it is'], [
            ['owner', 'TeachWise owner: approves and manages schools'],
            ['admin', 'School admin, Demo State University (code DEMO)'],
            ['ccsdean', 'Department admin, College of Computer Studies'],
            ['lsantos', 'Teacher'],
            ['aisha', 'Student'],
            ['sampleadmin', 'Admin of a second school, Sample Community College (code SAMPLE)'],
        ]);
        $this->line('Every demo account uses the password: password');

        return self::SUCCESS;
    }
}
