<?php

use Illuminate\Support\Facades\Schedule;

// "Evaluation is open" and "closes in 24 hours" notifications.
// On the server, add one cron entry: * * * * * php /path/to/backend/artisan schedule:run
Schedule::command('teachwise:notify')->hourly()->withoutOverlapping();

// Housekeeping: drop expired sign-ins and old crash reports.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::call(fn () => \App\Models\ClientError::where('created_at', '<', now()->subDays(90))->delete())->daily()->name('prune-client-errors');
