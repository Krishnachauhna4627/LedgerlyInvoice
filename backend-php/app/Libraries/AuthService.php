<?php

namespace App\Libraries;

use App\Exceptions\HttpError;
use App\Models\CompanyModel;
use App\Models\UserModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use Firebase\JWT\JWT;

/**
 * Port of backend/src/modules/auth/auth.service.js.
 * Password hashes are bcrypt ($2y$ here, $2a$/$2b$ from bcryptjs); both backends accept each other's.
 */
class AuthService
{
    private const BCRYPT_COST = 12;

    // bcrypt('not-a-real-password'). Compared against when the account doesn't exist,
    // so response time doesn't reveal which usernames/emails exist.
    private const DUMMY_HASH = '$2y$12$TkJdPVcPSFHi85uqr6k5q.ZYdGtGKoU5SkBXHYNAZoGWnJp13te2.';

    // One reset email per address per window, so repeated clicks (or someone else) can't flood the inbox.
    private const RESET_COOLDOWN_SECONDS = 5 * 60;

    // How long a "Forgot password" link works.
    private const RESET_LINK_SECONDS = 30 * 60;

    private UserModel $users;

    public function __construct()
    {
        $this->users = model(UserModel::class);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getUserById(int $id): ?array
    {
        return $this->users->findPublic($id);
    }

    /**
     * @param array<string, string> $data
     *
     * @return array{token: string, user: array<string, mixed>}
     */
    public function signup(array $data): array
    {
        $passwordHash = self::hash($data['password']);
        $db           = db_connect();

        try {
            $db->transException(true)->transStart();
            $companyId = model(CompanyModel::class)->insert(['name' => $data['company']]);
            $userId    = $this->users->insert([
                'company_id'    => $companyId,
                'name'          => $data['name'],
                'username'      => $data['username'],
                'email'         => $data['email'],
                'phone'         => $data['phone'],
                'password_hash' => $passwordHash,
            ]);
            $db->transComplete();
        } catch (DatabaseException $e) {
            throw self::toDuplicateError($e);
        }

        return $this->createSession($this->getUserById((int) $userId));
    }

    /**
     * `login` is a username or an email; usernames can't contain '@', so that tells them apart.
     *
     * @param array<string, string> $data
     *
     * @return array{token: string, user: array<string, mixed>}
     */
    public function login(array $data): array
    {
        RateLimit::assertLoginAllowed($data['login']);
        $column = str_contains($data['login'], '@') ? 'email' : 'username';
        $row    = $this->users->select('id, password_hash')->where($column, $data['login'])->first();
        $valid  = password_verify($data['password'], $row['password_hash'] ?? self::DUMMY_HASH);
        if (! $row || ! $valid) {
            RateLimit::loginFailed($data['login']);
            throw new HttpError(401, 'Incorrect username/email or password.');
        }
        RateLimit::loginSucceeded($data['login']);

        return $this->createSession($this->getUserById((int) $row['id']));
    }

    /**
     * @param array<string, string> $data
     *
     * @return array<string, mixed>|null
     */
    public function updateProfile(int $id, array $data): ?array
    {
        try {
            $this->users->update($id, [
                'name'     => $data['name'],
                'username' => $data['username'],
                'email'    => $data['email'],
                'phone'    => $data['phone'],
            ]);
        } catch (DatabaseException $e) {
            throw self::toDuplicateError($e);
        }

        return $this->getUserById($id);
    }

    /**
     * Saves the new password and logs the account out everywhere (every existing token stops working),
     * including the device that changed it: the user then logs in again with the new password.
     *
     * @param array<string, string> $data
     */
    public function changePassword(int $id, array $data): void
    {
        $row = $this->users->select('password_hash')->find($id);
        if (! $row || ! password_verify($data['currentPassword'], $row['password_hash'])) {
            throw new HttpError(400, 'Current password is incorrect.', [
                'currentPassword' => 'Current password is incorrect.',
            ]);
        }
        $this->setPassword($id, $data['newPassword']);
    }

    /**
     * "Forgot password": emails a one-time link to set a new password. Nothing changes until the link is used,
     * so the current password keeps working (nobody can lock an account by asking for resets).
     * Never reports whether the email has an account.
     */
    public function sendPasswordResetLink(string $email): void
    {
        // One email per address per window, so repeated clicks (or someone else) can't flood the inbox.
        // Cache keys can't contain '@', so key on a hash of the email.
        $cacheKey = 'password_reset_' . md5($email);
        if (cache($cacheKey) !== null) {
            return;
        }
        cache()->save($cacheKey, time(), self::RESET_COOLDOWN_SECONDS);

        $user = $this->users->select('id, name, username')->where('email', $email)->first();
        if (! $user) {
            return;
        }

        // Only the hash is stored; the token itself exists only in the email. A new link replaces older ones.
        $token  = bin2hex(random_bytes(32));
        $resets = db_connect()->table('password_resets');
        $resets->where('user_id', (int) $user['id'])->delete();
        $resets->insert([
            'user_id'    => (int) $user['id'],
            'token_hash' => hash('sha256', $token),
            'expires_at' => gmdate('Y-m-d H:i:s', time() + self::RESET_LINK_SECONDS),
        ]);

        $link = self::appUrl() . 'reset-password?token=' . $token;
        Mailer::send($email, 'Reset your Gogna password', implode("\n", [
            "Hi {$user['name']},",
            '',
            'We received a request to reset the password for your Gogna account (username: ' . $user['username'] . ').',
            'Open this link to choose a new password:',
            '',
            "    {$link}",
            '',
            'The link works once and expires in ' . (self::RESET_LINK_SECONDS / 60) . ' minutes.',
            '',
            "If you didn't ask for this, you can ignore this email: your password has not changed.",
        ]));
    }

    /**
     * Sets a new password with a token from a reset link. The link then stops working, and the account is
     * logged out everywhere.
     */
    public function resetPasswordWithToken(string $token, string $password): void
    {
        $invalid = new HttpError(400, 'This reset link is invalid or has expired. Please ask for a new one.');
        if (preg_match('/^[0-9a-f]{64}$/', $token) !== 1) {
            throw $invalid;
        }

        $db    = db_connect();
        $reset = $db->table('password_resets')
            ->select('id, user_id')
            ->where('token_hash', hash('sha256', $token))
            ->where('used_at', null)
            ->where('expires_at >', gmdate('Y-m-d H:i:s'))
            ->get()->getRowArray();
        if (! $reset) {
            throw $invalid;
        }

        $db->transException(true)->transStart();
        // Claim the link first; if two requests race, only the one that marks it used goes on.
        $db->table('password_resets')->where('id', (int) $reset['id'])->where('used_at', null)
            ->update(['used_at' => gmdate('Y-m-d H:i:s')]);
        if ($db->affectedRows() !== 1) {
            $db->transComplete();
            throw $invalid;
        }
        $this->setPassword((int) $reset['user_id'], $password);
        $db->table('password_resets')->where('user_id', (int) $reset['user_id'])->where('id !=', (int) $reset['id'])->delete();
        $db->transComplete();

        $user = $this->users->select('email, username')->find((int) $reset['user_id']);
        if ($user) {
            RateLimit::clearLoginFailures((string) $user['email'], (string) $user['username']);
        }
    }

    /**
     * A session for any user, without their password: for the super user's "Log in as" (Admin::loginAs).
     *
     * @return array{token: string, user: array<string, mixed>}
     */
    public function sessionFor(int $userId): array
    {
        $user = $this->getUserById($userId);
        if (! $user) {
            throw new HttpError(404, 'User not found.');
        }

        return $this->createSession($user);
    }

    /**
     * Same token as the Node backend: HS256, sub = user id as a string, iat + exp.
     *
     * @param array<string, mixed> $user
     *
     * @return array{token: string, user: array<string, mixed>}
     */
    private function createSession(array $user): array
    {
        $jwt     = config('Jwt');
        $now     = time();
        $version = db_connect()->table('users')->select('token_version')->where('id', (int) $user['id'])->get()->getRowArray();
        $token   = JWT::encode([
            'sub' => (string) $user['id'],
            // Checked by AuthFilter: a password change / reset raises the user's version, ending older tokens.
            'ver' => (int) ($version['token_version'] ?? 0),
            'iat' => $now,
            'exp' => $now + $jwt->expiresIn,
        ], $jwt->secret, 'HS256');

        return ['token' => $token, 'user' => $user];
    }

    /**
     * Saves a new password and ends every existing session of the account.
     */
    private function setPassword(int $userId, string $password): void
    {
        db_connect()->table('users')->where('id', $userId)
            ->set('password_hash', self::hash($password))
            ->set('token_version', 'token_version + 1', false)
            ->update();
    }

    /**
     * Where the app is opened, for links in emails: FRONTEND_URL, else app.baseURL. Never taken from the
     * request's Host header, which a client could fake to send reset links to their own site.
     */
    private static function appUrl(): string
    {
        $url = (string) (env('FRONTEND_URL') ?: config('App')->baseURL);

        return rtrim($url, '/') . '/';
    }

    private static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => self::BCRYPT_COST]);
    }

    /**
     * Username and email are unique; turn a clash into a message on the right field.
     */
    private static function toDuplicateError(DatabaseException $e): \Throwable
    {
        if ($e->getCode() !== 1062) {
            return $e;
        }
        if (str_contains($e->getMessage(), 'users_email_unique')) {
            return new HttpError(409, 'An account with that email already exists.', [
                'email' => 'An account with that email already exists.',
            ]);
        }

        return new HttpError(409, 'That username is already taken.', ['username' => 'That username is already taken.']);
    }
}
