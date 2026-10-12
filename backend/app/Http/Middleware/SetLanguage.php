<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Uses the language the app asks for ("X-Lang: en" or "fil"). */
class SetLanguage
{
    public function handle(Request $request, Closure $next): Response
    {
        $lang = $request->header('X-Lang');
        app()->setLocale(in_array($lang, ['en', 'fil'], true) ? $lang : 'en');

        return $next($request);
    }
}
