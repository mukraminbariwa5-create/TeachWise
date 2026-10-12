<?php

namespace App\Http\Middleware;

use App\Support\AdminScope;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Routes only the whole-school admin may use (department admins get 403). */
class EnsureSchoolAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        AdminScope::requireSchoolAdmin();

        return $next($request);
    }
}
