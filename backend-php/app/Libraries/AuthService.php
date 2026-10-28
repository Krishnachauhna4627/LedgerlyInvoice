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

    // No 0/O/1/l/I so the emailed password is easy to type.
    private const TEMP_PASSWORD_CHARS  = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    private const TEMP_PASSWORD_LENGTH = 12;

    // One reset per email per window, so repeated clicks (or someone else) can't keep replacing the password.
    private const RESET_COOLDOWN_SECONDS = 5 * 60;

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
        $column = str_contains($data['login'], '@') ? 'email' : 'username';
        $row    = $this->users->select('id, password_hash')->where($column, $data['login'])->first();
        $valid  = password_verify($data['password'], $row['password_hash'] ?? self::DUMMY_HASH);
        if (! $row || ! $valid) {
            throw new HttpError(401, 'Incorrect username/email or password.');
        }

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
        $this->users->update($id, ['password_hash' => self::hash($data['newPassword'])]);
    }

    /**
     * Emails the account a new random password, then saves it (email first, so a failed send leaves the old one working).
     * Never reports whether the email has an account.
     */
    public function resetPassword(string $email): void
    {
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
        $password = self::generateTempPassword();
        Mailer::send($email, 'Your new Gogna password', implode("\n", [
            "Hi {$user['name']},",
            '',
            'We received a request to reset your Gogna password. Your new password is:',
            '',
            "    {$password}",
            '',
            "Log in with your username ({$user['username']}) or this email, then change it from your profile: click your name at the bottom of the sidebar → Change password.",
            '',
            "If you didn't ask for this, log in with the password above and change it right away.",
        ]));
        $this->users->update((int) $user['id'], ['password_hash' => self::hash($password)]);
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
        $jwt   = config('Jwt');
        $now   = time();
        $token = JWT::encode(['sub' => (string) $user['id'], 'iat' => $now, 'exp' => $now + $jwt->expiresIn], $jwt->secret, 'HS256');

        return ['token' => $token, 'user' => $user];
    }

    private static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => self::BCRYPT_COST]);
    }

    private static function generateTempPassword(): string
    {
        $chars    = self::TEMP_PASSWORD_CHARS;
        $password = '';
        for ($i = 0; $i < self::TEMP_PASSWORD_LENGTH; $i++) {
            $password .= $chars[random_int(0, strlen($chars) - 1)];
        }

        return $password;
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
