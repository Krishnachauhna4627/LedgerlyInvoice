<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\BankAccountModel;
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
        'terms'     => self::OPTIONAL_TEXT,
        'bankAccounts'   => ['default:[]'],
        'bankAccounts.*' => [
            'bankName'  => self::OPTIONAL_TEXT,
            'accountNo' => self::OPTIONAL_TEXT,
            'ifsc'      => ['trim', 'upper', 'empty_to_null'],
        ],
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

        // Entries left completely empty are dropped; the first remaining one is the primary account.
        $accounts = array_values(array_filter(
            array_map(static fn (array $a): array => [
                'bank_name'  => $a['bankName'],
                'account_no' => $a['accountNo'],
                'ifsc'       => $a['ifsc'],
            ], $b['bankAccounts']),
            static fn (array $a): bool => $a['bank_name'] !== null || $a['account_no'] !== null || $a['ifsc'] !== null,
        ));
        $primary = $accounts[0] ?? ['bank_name' => null, 'account_no' => null, 'ifsc' => null];

        $db = db_connect();
        $db->transException(true)->transStart();
        $this->companies->update($this->companyId(), [
            'name'       => $b['name'],
            'address'    => $b['address'],
            'state_code' => $b['stateCode'],
            'gstin'      => $b['gstin'],
            'phone'      => $b['phone'],
            'email'      => $b['email'],
            'terms'      => $b['terms'],
        ] + $primary);
        model(BankAccountModel::class)->replaceForCompany($this->companyId(), $accounts);
        $db->transComplete();

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
        return $this->companies->getDto($this->companyId());
    }
}
