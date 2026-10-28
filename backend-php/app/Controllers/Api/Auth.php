<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\AuthService;
use Throwable;

/**
 * /api/auth — port of backend/src/modules/auth/auth.routes.js.
 */
class Auth extends BaseController
{
    private const PROFILE_CLEANERS = [
        'name'     => ['trim'],
        'username' => ['trim', 'lower'],
        'email'    => ['trim', 'lower'],
        'phone'    => ['no_spaces_dashes'],
    ];

    private AuthService $auth;

    public function __construct()
    {
        $this->auth = new AuthService();
    }

    public function signup()
    {
        $data = $this->validated('signup', self::PROFILE_CLEANERS + ['company' => ['trim']]);

        return $this->response->setStatusCode(201)->setJSON($this->auth->signup($data));
    }

    public function login()
    {
        $data = $this->validated('login', ['login' => ['trim', 'lower']]);

        return $this->response->setJSON($this->auth->login($data));
    }

    /**
     * Same answer whether or not the email has an account. The email is sent after the response
     * goes out where the server allows it (PHP-FPM / LiteSpeed); otherwise before.
     */
    public function forgotPassword()
    {
        $email = $this->validated('forgotPassword', ['email' => ['trim', 'lower']])['email'];

        register_shutdown_function(function () use ($email) {
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } elseif (function_exists('litespeed_finish_request')) {
                litespeed_finish_request();
            }

            try {
                $this->auth->resetPassword($email);
            } catch (Throwable $e) {
                log_message('error', 'Password reset failed: ' . $e);
            }
        });

        return $this->response->setJSON(['message' => 'If an account exists for that email, we have sent it a new password.']);
    }

    public function me()
    {
        return $this->response->setJSON(['user' => $this->auth->getUserById(service('currentUser')->id)]);
    }

    public function updateMe()
    {
        $data = $this->validated('profile', self::PROFILE_CLEANERS);

        return $this->response->setJSON(['user' => $this->auth->updateProfile(service('currentUser')->id, $data)]);
    }

    public function changePassword()
    {
        $this->auth->changePassword(service('currentUser')->id, $this->validated('passwordChange'));

        return $this->response->setStatusCode(204);
    }
}
