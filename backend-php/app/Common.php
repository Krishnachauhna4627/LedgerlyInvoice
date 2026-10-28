<?php

/**
 * The goal of this file is to allow developers a location
 * where they can overwrite core procedural functions and
 * replace them with their own. This file is loaded during
 * the bootstrap process and is called during the framework's
 * execution.
 *
 * This can be looked at as a `master helper` file that is
 * loaded early on, and may also contain additional functions
 * that you'd like to use throughout your entire application
 *
 * @see: https://codeigniter.com/user_guide/extending/common.html
 */

if (! function_exists('required_env')) {
    /**
     * Reads a setting from .env; a missing value stops the request with a clear message (see .env.example).
     */
    function required_env(string $name): string
    {
        $value = env($name);
        if ($value === null || $value === '' || $value === false) {
            throw new RuntimeException("Missing required environment variable {$name} (see .env.example)");
        }

        return (string) $value;
    }
}

// Shortest round-trip float output in JSON (e.g. 0.1, not 0.10000000000000001), like JavaScript.
// Some shared hosts ship a php.ini with serialize_precision = 17.
ini_set('serialize_precision', '-1');

if (! function_exists('iso_timestamp')) {
    /**
     * A TIMESTAMP column (read in UTC, see BaseController) as the ISO string the Node API returns,
     * e.g. '2026-10-28T11:50:00.000Z'.
     */
    function iso_timestamp(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    }
}

if (! function_exists('today')) {
    /**
     * Today's date in the app time zone (Config\App::$appTimezone), as 'YYYY-MM-DD'.
     */
    function today(): string
    {
        return date('Y-m-d');
    }
}
