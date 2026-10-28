<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;
use RuntimeException;

/**
 * Login tokens. Uses the same JWT_SECRET as the Node backend, so tokens from either backend work on both.
 */
class Jwt extends BaseConfig
{
    public string $secret = '';

    /**
     * Token lifetime in seconds, from JWT_EXPIRES_IN (e.g. 7d, 12h, 30m, 3600s).
     */
    public int $expiresIn = 0;

    public function __construct()
    {
        parent::__construct();

        $this->secret    = required_env('JWT_SECRET');
        $this->expiresIn = self::toSeconds((string) env('JWT_EXPIRES_IN', '7d'));
    }

    private static function toSeconds(string $value): int
    {
        $units = ['s' => 1, 'm' => 60, 'h' => 3600, 'd' => 86400, 'w' => 604800];
        if (! preg_match('/^\s*(\d+)\s*([smhdw])?\s*$/i', $value, $match)) {
            throw new RuntimeException("JWT_EXPIRES_IN must look like 7d, 12h, 30m or 3600s (got '{$value}')");
        }

        return (int) $match[1] * $units[strtolower($match[2] ?? 's')];
    }
}
