<?php

namespace App\Exceptions;

use CodeIgniter\Exceptions\HTTPExceptionInterface;
use RuntimeException;

/**
 * Throw this from controllers/libraries/filters to send a specific status and message to the client.
 * Rendered by App\Libraries\JsonExceptionHandler as { message, errors?: { field: message } }.
 * The status is also the exception code, so Config\Exceptions::$ignoreCodes keeps 4xx out of the error log.
 */
class HttpError extends RuntimeException implements HTTPExceptionInterface
{
    /**
     * @param array<string, string>|null $errors
     */
    public function __construct(public readonly int $status, string $message, public readonly ?array $errors = null)
    {
        parent::__construct($message, $status);
    }
}
