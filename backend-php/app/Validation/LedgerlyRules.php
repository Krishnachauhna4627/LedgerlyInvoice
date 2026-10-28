<?php

namespace App\Validation;

use App\Libraries\Gst;

/**
 * Custom rules for the Ledgerly rule groups in Config\Validation.
 * Values are already cleaned (trimmed, coerced, '' → null) by BaseController::validated().
 */
class LedgerlyRules
{
    /**
     * A GST state code; state_code[nullable] also allows null (but not '').
     */
    public function state_code($value, ?string $params = null): bool
    {
        return ($value === null && $params === 'nullable') || in_array($value, Gst::STATE_CODES, true);
    }

    /**
     * Empty (null) or a valid 15-character GSTIN.
     */
    public function gstin($value): bool
    {
        return $value === null || (is_string($value) && preg_match(Gst::GSTIN_PATTERN, $value) === 1);
    }

    /**
     * Empty (null) or one of the fixed units of measure.
     */
    public function unit($value): bool
    {
        return $value === null || in_array($value, Gst::UNITS, true);
    }

    /**
     * Indian mobile: 10 digits starting with 6–9 (+91 / 0 prefix already removed). Empty (null) is allowed.
     */
    public function indian_mobile($value): bool
    {
        return $value === null || (is_string($value) && preg_match('/^[6-9]\d{9}$/', $value) === 1);
    }

    /**
     * Empty (null) or a valid email address.
     */
    public function optional_email($value): bool
    {
        return $value === null || (is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false);
    }

    /**
     * 'YYYY-MM-DD' (format only, like the Node isoDate rule); iso_date[nullable] also allows null (but not '').
     */
    public function iso_date($value, ?string $params = null): bool
    {
        return ($value === null && $params === 'nullable')
            || (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1);
    }

    /**
     * A finite number (after the 'number' cleaner, which coerces like JavaScript's Number()).
     */
    public function js_number($value): bool
    {
        return (is_int($value) || is_float($value)) && is_finite($value);
    }

    public function js_integer($value): bool
    {
        return $this->js_number($value) && floor($value) == $value;
    }

    /**
     * Error message names the type received, like zod: "Invalid input: expected boolean, received string".
     */
    public function boolean($value, ?string &$error = null): bool
    {
        if (is_bool($value)) {
            return true;
        }
        $error = 'Invalid input: expected boolean, received ' . self::jsType($value);

        return false;
    }

    /**
     * A string (use after permit_empty for optional text). Error message like zod's.
     */
    public function text($value, ?string &$error = null): bool
    {
        if (is_string($value)) {
            return true;
        }
        $error = 'Invalid input: expected string, received ' . self::jsType($value);

        return false;
    }

    /**
     * The JavaScript type name of a decoded JSON value, for zod-style messages.
     *
     * @param mixed $value
     */
    public static function jsType($value): string
    {
        return match (true) {
            is_string($value)                => 'string',
            is_int($value), is_float($value) => 'number',
            is_bool($value)                  => 'boolean',
            $value === null                  => 'null',
            default                          => array_is_list($value) ? 'array' : 'object',
        };
    }

    /**
     * A JSON array with between min and max entries, e.g. list_size[1,200].
     */
    public function list_size($value, string $params): bool
    {
        [$min, $max] = array_map('intval', explode(',', $params));

        return is_array($value) && array_is_list($value) && count($value) >= $min && count($value) <= $max;
    }
}
