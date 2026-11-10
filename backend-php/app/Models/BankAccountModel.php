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
     * Makes the company's accounts match $accounts (in order). Entries with the id of one of the
     * company's accounts update it, so receipts keep pointing at it; others are added; accounts
     * left out are removed (their receipts keep mode "bank" without an account). Call inside a transaction.
     *
     * @param list<array{id: ?int, bank_name: ?string, account_no: ?string, ifsc: ?string}> $accounts
     */
    public function syncForCompany(int $companyId, array $accounts): void
    {
        $existing = array_map('intval', array_column(
            $this->db->table($this->table)->select('id')->where('company_id', $companyId)->get()->getResultArray(),
            'id',
        ));
        $kept = [];
        foreach ($accounts as $position => $account) {
            $id  = $account['id'];
            $row = ['bank_name' => $account['bank_name'], 'account_no' => $account['account_no'], 'ifsc' => $account['ifsc'], 'position' => $position];
            if ($id !== null && in_array($id, $existing, true) && ! in_array($id, $kept, true)) {
                $this->update($id, $row);
                $kept[] = $id;
            } else {
                $this->insert(['company_id' => $companyId] + $row);
            }
        }
        $removed = array_diff($existing, $kept);
        if ($removed !== []) {
            $this->where('company_id', $companyId)->whereIn('id', $removed)->delete();
        }
    }

    /**
     * Whether $id is one of the company's accounts.
     */
    public function isOwned(int $companyId, int $id): bool
    {
        return $this->where('company_id', $companyId)->where('id', $id)->countAllResults() > 0;
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
