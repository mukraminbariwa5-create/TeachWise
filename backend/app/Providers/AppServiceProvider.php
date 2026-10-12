<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Catch lazy-loading and mass-assignment mistakes while developing.
        Model::shouldBeStrict(! $this->app->isProduction());

        // A safety net per login name + IP. The friendlier lockout ("2 tries left",
        // countdown) lives in AuthController and kicks in after 5 wrong passwords.
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(10)->by(mb_strtolower((string) $request->input('login')).'|'.$request->ip());
        });

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });
    }
}
