<?php

namespace App\Support;

/**
 * Two-language text for messages the app shows. The app sends "X-Lang: fil"
 * when the person picked Filipino; everything else gets English.
 */
class Say
{
    public static function fil(): bool
    {
        return app()->getLocale() === 'fil';
    }

    public static function it(string $english, string $filipino): string
    {
        return self::fil() ? $filipino : $english;
    }
}
