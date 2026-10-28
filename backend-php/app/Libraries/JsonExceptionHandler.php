<?php

namespace App\Libraries;

use App\Exceptions\HttpError;
use CodeIgniter\Debug\ExceptionHandlerInterface;
use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\HTTP\Cors;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Turns every exception into the JSON error shape the frontend expects (same as the Node error-handler):
 * HttpError → its status / message / errors, unknown route → 404, anything else → logged + 500.
 */
class JsonExceptionHandler implements ExceptionHandlerInterface
{
    public function handle(
        Throwable $exception,
        RequestInterface $request,
        ResponseInterface $response,
        int $statusCode,
        int $exitCode,
    ): void {
        if ($exception instanceof HttpError) {
            $status = $exception->status;
            $body   = ['message' => $exception->getMessage()];
            if ($exception->errors) {
                $body['errors'] = $exception->errors;
            }
        } elseif ($exception instanceof PageNotFoundException) {
            $status = 404;
            $body   = ['message' => 'Not found.'];
        } else {
            log_message('error', (string) $exception);
            $status = 500;
            $body   = ['message' => 'Something went wrong. Please try again.'];
        }

        // Filters' "after" step doesn't run on errors, so add the CORS headers here.
        if ($request instanceof IncomingRequest) {
            (new Cors())->addResponseHeaders($request, $response);
        }

        $response->setStatusCode($status)->setJSON($body)->send();

        if (ENVIRONMENT !== 'testing') {
            exit($exitCode);
        }
    }
}
