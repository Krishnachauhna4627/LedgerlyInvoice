<?php

namespace App\Libraries;

/**
 * The logged-in user for this request (service('currentUser')), set by AuthFilter.
 * Every query for business data must be scoped by $companyId.
 */
class CurrentUser
{
    public int $id = 0;
    public int $companyId = 0;
    public bool $isAdmin = false;
}
