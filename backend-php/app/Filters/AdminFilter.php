<?php

namespace App\Filters;

use App\Exceptions\HttpError;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Use after 'auth'. Answers 404 so the admin API isn't advertised to regular users.
 */
class AdminFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (! service('currentUser')->isAdmin) {
            throw new HttpError(404, 'Not found.');
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }
}
