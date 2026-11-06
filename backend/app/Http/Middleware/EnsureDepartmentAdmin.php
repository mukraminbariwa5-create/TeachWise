<?php

namespace App\Http\Middleware;

use App\Support\AdminScope;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureDepartmentAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(AdminScope::limited(), 403, 'Your department admin manages department people, approved IDs and classes.');
        return $next($request);
    }
}
