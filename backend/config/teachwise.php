<?php

/*
| TeachWise settings that change per school or per release. Set them in .env.
*/
return [
    // Who runs this TeachWise server. Each school sets its own name and contacts in the app;
    // these are used when nobody is signed in, and for school applications.
    'platform_name' => env('TEACHWISE_PLATFORM_NAME', 'TeachWise'),
    'support_email' => env('TEACHWISE_SUPPORT_EMAIL', 'support@example.edu'),
    'dpo_email' => env('TEACHWISE_DPO_EMAIL', 'dpo@example.edu'),

    // Used once: an existing single-school install is moved into a school with this name.
    'school_name' => env('TEACHWISE_SCHOOL_NAME', 'My School'),

    // App updates: phones older than min_app_version are asked to update before continuing.
    'latest_app_version' => env('TEACHWISE_LATEST_APP_VERSION', '1.0.0'),
    'min_app_version' => env('TEACHWISE_MIN_APP_VERSION', '1.0.0'),
    'store_url' => env('TEACHWISE_STORE_URL', 'https://play.google.com/store/apps/details?id=com.teachwise.app'),

    // How long sign-ins last. "Stay signed in" off = short session.
    'session_days' => (int) env('TEACHWISE_SESSION_DAYS', 30),
    'short_session_hours' => (int) env('TEACHWISE_SHORT_SESSION_HOURS', 12),

    // Public portfolio demo: shared demo accounts can't be locked or broken by visitors
    // (see App\Http\Middleware\PublicDemo). Only for a public demo server.
    'public_demo' => (bool) env('TEACHWISE_PUBLIC_DEMO', false),
];
