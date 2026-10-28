<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\CompanyModel;

/**
 * /api/company — the logged-in user's own business ("seller") details. Port of modules/company/company.js.
 */
class Company extends BaseController
{
    private const OPTIONAL_TEXT = ['trim', 'empty_to_null'];

    private const SELLER_CLEANERS = [
        'name'      => ['trim'],
        'address'   => self::OPTIONAL_TEXT,
        'stateCode' => [],
        'gstin'     => ['trim', 'upper', 'empty_to_null'],
        'phone'     => ['indian_phone', 'empty_to_null'],
        'email'     => ['trim', 'lower', 'empty_to_null'],
        'bankName'  => self::OPTIONAL_TEXT,
        'accountNo' => self::OPTIONAL_TEXT,
        'ifsc'      => ['trim', 'empty_to_null'],
        'terms'     => self::OPTIONAL_TEXT,
    ];

    private CompanyModel $companies;

    public function __construct()
    {
        $this->companies = model(CompanyModel::class);
    }

    public function show()
    {
        return $this->json($this->current());
    }

    public function update()
    {
        $b = $this->validated('seller', self::SELLER_CLEANERS);
        $this->companies->update($this->companyId(), [
            'name'       => $b['name'],
            'address'    => $b['address'],
            'state_code' => $b['stateCode'],
            'gstin'      => $b['gstin'],
            'phone'      => $b['phone'],
            'email'      => $b['email'],
            'bank_name'  => $b['bankName'],
            'account_no' => $b['accountNo'],
            'ifsc'       => $b['ifsc'] === null ? null : strtoupper($b['ifsc']),
            'terms'      => $b['terms'],
        ]);

        return $this->json($this->current());
    }

    public function saveSignature()
    {
        $this->companies->update($this->companyId(), ['signature' => $this->validated('signature')['signature']]);

        return $this->json($this->current());
    }

    public function deleteSignature()
    {
        $this->companies->update($this->companyId(), ['signature' => null]);

        return $this->json($this->current());
    }

    /**
     * @return array<string, mixed>
     */
    private function current(): array
    {
        return CompanyModel::toDto($this->companies->getRow($this->companyId()));
    }
}
