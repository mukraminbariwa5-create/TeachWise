<?php

/*
| Which websites may call the API from a browser.
| Production: set CORS_ALLOWED_ORIGINS to your web app's address, e.g. https://teachwise.example.edu
| (comma-separated for several). Phones don't use CORS.
*/
$origins = array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '*')))));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $origins ?: ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Lang', 'X-App-Version', 'X-Platform', 'X-Requested-With'],
    'exposed_headers' => ['Retry-After'],
    'max_age' => 3600,
    'supports_credentials' => false,
];
