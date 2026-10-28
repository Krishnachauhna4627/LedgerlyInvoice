<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;

class Health extends BaseController
{
    public function index()
    {
        return $this->response->setJSON(['status' => 'ok']);
    }
}
