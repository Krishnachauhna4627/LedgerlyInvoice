<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * A user's own business ("seller"); every user belongs to one.
 */
class CompanyModel extends Model
{
    protected $table         = 'companies';
    protected $returnType    = 'array';
    protected $allowedFields = [
        'name', 'address', 'state_code', 'gstin', 'phone', 'email', 'bank_name', 'account_no', 'ifsc', 'terms', 'signature',
    ];

    private const COLUMNS = 'id, name, address, state_code, gstin, phone, email, bank_name, account_no, ifsc, terms, signature';

    /**
     * @return array<string, mixed>|null
     */
    public function getRow(int $companyId): ?array
    {
        return $this->select(self::COLUMNS)->find($companyId);
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public static function toDto(array $row): array
    {
        return [
            'id'        => (int) $row['id'],
            'name'      => $row['name'],
            'address'   => $row['address'],
            'stateCode' => $row['state_code'],
            'gstin'     => $row['gstin'],
            'phone'     => $row['phone'],
            'email'     => $row['email'],
            'bankName'  => $row['bank_name'],
            'accountNo' => $row['account_no'],
            'ifsc'      => $row['ifsc'],
            'terms'     => $row['terms'],
            'signature' => $row['signature'],
        ];
    }
}
