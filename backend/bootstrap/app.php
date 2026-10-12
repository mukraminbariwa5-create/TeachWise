<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureSchoolAdmin;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetLanguage;
use App\Http\Middleware\SetTenant;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => EnsureRole::class,
            'school_admin' => EnsureSchoolAdmin::class,
        ]);
        // SetTenant runs first so route models are already limited to the user's school.
        $middleware->api(prepend: [SetTenant::class], append: [SetLanguage::class, SecurityHeaders::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // The app only talks JSON: always render API errors as JSON.
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
    })->create();
