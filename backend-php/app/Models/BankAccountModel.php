<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * A company's bank accounts, in display order. The first one is the primary account printed on invoices.
 */
class BankAccountModel extends Model
{
    public const MAX_ACCOUNTS = 10;

    protected $table         = 'company_bank_accounts';
    protected $returnType    = 'array';
    protected $allowedFields = ['company_id', 'bank_name', 'account_no', 'ifsc', 'position'];

    /**
     * @return list<array<string, mixed>>
     */
    public function listForCompany(int $companyId): array
    {
        return array_map(
            self::toDto(...),
            $this->where('company_id', $companyId)->orderBy('position')->orderBy('id')->findAll(),
        );
    }

    /**
     * Replaces all of the company's accounts with $accounts (snake_case rows, in order).
     * Call inside a transaction.
     *
     * @param list<array{bank_name: ?string, account_no: ?string, ifsc: ?string}> $accounts
     */
    public function replaceForCompany(int $companyId, array $accounts): void
    {
        $this->where('company_id', $companyId)->delete();
        foreach ($accounts as $position => $account) {
            $this->insert(['company_id' => $companyId, 'position' => $position] + $account);
        }
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
            'bankName'  => $row['bank_name'],
            'accountNo' => $row['account_no'],
            'ifsc'      => $row['ifsc'],
        ];
    }
}
