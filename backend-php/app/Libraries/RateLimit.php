<?php

namespace App\Libraries;

use App\Exceptions\HttpError;

/**
 * Brute-force protection for the public auth endpoints (login, signup, forgot password).
 * Counts live in the cache (file cache on shared hosting), so nothing is stored in the database.
 *
 * Per-IP limits are deliberately generous: behind a proxy or tunnel many users can share one IP.
 * The per-account limit on failed logins is the real protection against password guessing.
 */
class RateLimit
{
    // Failed logins allowed per account (username/email) before it is paused, and for how long.
    public const LOGIN_FAILURES_MAX    = 10;
    public const LOGIN_FAILURES_WINDOW = 15 * MINUTE;

    /**
     * Allows $max requests per $seconds for $action from $ip; answers 429 once that is used up.
     */
    public static function perIp(string $action, string $ip, int $max, int $seconds): void
    {
        $throttler = service('throttler');
        if ($throttler->check(self::key("{$action}_ip", $ip), $max, $seconds)) {
            return;
        }

        $wait = max(1, (int) ceil($throttler->getTokenTime() / MINUTE));
        throw new HttpError(429, 'Too many attempts. Please try again in ' . self::minutes($wait) . '.');
    }

    /**
     * Answers 429 while the account has too many recent failed logins.
     */
    public static function assertLoginAllowed(string $login): void
    {
        if ((int) cache(self::key('login_fail', $login)) >= self::LOGIN_FAILURES_MAX) {
            throw new HttpError(429, 'Too many failed login attempts. Please try again in '
                . self::minutes((int) (self::LOGIN_FAILURES_WINDOW / MINUTE)) . ', or use "Forgot password".');
        }
    }

    /**
     * Counts one failed login for the account. The window restarts with each failure.
     */
    public static function loginFailed(string $login): void
    {
        $key = self::key('login_fail', $login);
        cache()->save($key, (int) cache($key) + 1, self::LOGIN_FAILURES_WINDOW);
    }

    public static function loginSucceeded(string $login): void
    {
        cache()->delete(self::key('login_fail', $login));
    }

    // Cache keys can't contain characters like '@' or ':', so key on a hash.
    private static function key(string $prefix, string $value): string
    {
        return 'rl_' . $prefix . '_' . md5($value);
    }

    private static function minutes(int $n): string
    {
        return $n === 1 ? '1 minute' : "{$n} minutes";
    }
}
