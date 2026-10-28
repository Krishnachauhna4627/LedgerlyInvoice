<?php

namespace App\Filters;

use App\Exceptions\HttpError;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Throwable;

/**
 * Expects "Authorization: Bearer <token>"; fills service('currentUser') with { id, companyId, isAdmin }.
 */
class AuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $parts  = explode(' ', self::authorizationHeader($request));
        $scheme = $parts[0];
        $token  = $parts[1] ?? '';
        if ($scheme !== 'Bearer' || $token === '') {
            throw new HttpError(401, 'Please log in.');
        }

        try {
            $payload = JWT::decode($token, new Key(config('Jwt')->secret, 'HS256'));
        } catch (Throwable) {
            throw new HttpError(401, 'Your session has expired. Please log in again.');
        }

        $user = db_connect()->table('users')
            ->select('id, company_id, is_admin')
            ->where('id', (int) ($payload->sub ?? 0))
            ->get()->getRow();
        if (! $user) {
            throw new HttpError(401, 'Please log in.');
        }

        $current            = service('currentUser');
        $current->id        = (int) $user->id;
        $current->companyId = (int) $user->company_id;
        $current->isAdmin   = (bool) $user->is_admin;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }

    /**
     * Behind Apache rewrites (shared hosting) the header can arrive only as REDIRECT_HTTP_AUTHORIZATION
     * (or REDIRECT_REDIRECT_...), which CodeIgniter doesn't read as a header.
     */
    private static function authorizationHeader(RequestInterface $request): string
    {
        $header = $request->getHeaderLine('Authorization');
        if ($header !== '') {
            return $header;
        }
        foreach ($_SERVER as $key => $value) {
            if (is_string($value) && preg_match('/^(REDIRECT_)+HTTP_AUTHORIZATION$/', $key) === 1) {
                return $value;
            }
        }

        return '';
    }
}
