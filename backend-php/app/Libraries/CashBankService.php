<?php

namespace App\Libraries;

use App\Exceptions\HttpError;
use CodeIgniter\Database\BaseConnection;

/**
 * Cash book and bank books: money in (receipts from customers) and out (payments to vendors) per account,
 * with opening and closing balances and a running balance, in the same shape as the customer ledger.
 *
 * Accounts: 'cash'; 'bank-<id>' for each of the company's bank accounts; and 'bank' for bank receipts or
 * payments saved without an account when the company has no bank account to put them in. Bank entries
 * without an account otherwise count in the primary (first) account — the one they are printed with.
 */
class CashBankService
{
    private BaseConnection $db;

    public function __construct()
    {
        $this->db = db_connect();
    }

    /**
     * Every account with its opening balance at $from, money in and out in the period and the closing balance at $to.
     *
     * @return list<array<string, mixed>>
     */
    public function summary(int $companyId, ?string $from, ?string $to): array
    {
        $accounts  = $this->accounts($companyId);
        $movements = $this->movements($companyId);

        return array_map(function (array $account) use ($movements, $from, $to): array {
            $opening = $account['openingBalance'];
            $in      = 0.0;
            $out     = 0.0;
            foreach ($movements as $m) {
                if ($this->accountKeyOf($m, $account['primaryId']) !== $account['key'] || ($to !== null && $m['date'] > $to)) {
                    continue;
                }
                if ($from !== null && $m['date'] < $from) {
                    $opening += $m['in'] - $m['out'];
                } else {
                    $in  += $m['in'];
                    $out += $m['out'];
                }
            }
            $opening = Gst::round2($opening);

            return [
                ...self::publicAccount($account),
                'periodOpening' => $opening,
                'in'            => Gst::round2($in),
                'out'           => Gst::round2($out),
                'closing'       => Gst::round2($opening + $in - $out),
            ];
        }, $accounts);
    }

    /**
     * Date-wise book of one account: receipts are debits (money in), payments credits (money out), with a running
     * balance. Entries before $from fold into the opening balance; entries after $to are left out.
     *
     * @return array<string, mixed>
     */
    public function ledger(int $companyId, string $key, ?string $from, ?string $to): array
    {
        $account = null;
        foreach ($this->accounts($companyId) as $a) {
            if ($a['key'] === $key) {
                $account = $a;
            }
        }
        if ($account === null) {
            throw new HttpError(404, 'Account not found.');
        }

        $balance = $account['openingBalance'];
        $opening = $balance;
        $entries = [];
        foreach ($this->movements($companyId) as $m) {
            if ($this->accountKeyOf($m, $account['primaryId']) !== $key) {
                continue;
            }
            if ($to !== null && $m['date'] > $to) {
                break;
            }
            $balance = Gst::round2($balance + $m['in'] - $m['out']);
            if ($from !== null && $m['date'] < $from) {
                $opening = $balance;

                continue;
            }
            $entries[] = [
                'type'      => $m['type'],
                'id'        => $m['id'],
                'date'      => $m['date'],
                'createdAt' => $m['createdAt'],
                'number'    => $m['number'],
                'clientId'  => $m['clientId'],
                'party'     => $m['party'],
                'reference' => $m['reference'],
                'debit'     => $m['in'],
                'credit'    => $m['out'],
                'balance'   => $balance,
            ];
        }
        $sum = static fn (string $k): float => Gst::round2(array_reduce($entries, static fn (float $t, array $e): float => $t + $e[$k], 0.0));

        return [
            'account'        => self::publicAccount($account),
            'from'           => $from,
            'to'             => $to,
            'openingBalance' => Gst::round2($opening),
            'entries'        => $entries,
            'totals'         => ['in' => $sum('debit'), 'out' => $sum('credit'), 'closingBalance' => $balance],
        ];
    }

    /**
     * @return list<array{key: string, type: string, bankAccountId: ?int, bankName: ?string, accountNo: ?string, openingBalance: float, primaryId: ?int}>
     */
    private function accounts(int $companyId): array
    {
        $company = $this->db->table('companies')->select('cash_opening_balance')->where('id', $companyId)->get()->getRowArray();
        $banks   = $this->db->table('company_bank_accounts')
            ->select('id, bank_name, account_no, opening_balance')
            ->where('company_id', $companyId)
            ->orderBy('position')->orderBy('id')
            ->get()->getResultArray();
        $primaryId = $banks === [] ? null : (int) $banks[0]['id'];

        $accounts = [[
            'key' => 'cash', 'type' => 'cash', 'bankAccountId' => null, 'bankName' => null, 'accountNo' => null,
            'openingBalance' => (float) ($company['cash_opening_balance'] ?? 0), 'primaryId' => $primaryId,
        ]];
        foreach ($banks as $bank) {
            $accounts[] = [
                'key' => 'bank-' . $bank['id'], 'type' => 'bank', 'bankAccountId' => (int) $bank['id'],
                'bankName' => $bank['bank_name'], 'accountNo' => $bank['account_no'],
                'openingBalance' => (float) $bank['opening_balance'], 'primaryId' => $primaryId,
            ];
        }
        // No bank account to hold bank entries saved without one: list them on their own.
        if ($primaryId === null && $this->hasUnassignedBankEntries($companyId)) {
            $accounts[] = [
                'key' => 'bank', 'type' => 'bank', 'bankAccountId' => null, 'bankName' => null, 'accountNo' => null,
                'openingBalance' => 0.0, 'primaryId' => null,
            ];
        }

        return $accounts;
    }

    private function hasUnassignedBankEntries(int $companyId): bool
    {
        foreach (['receipts', 'vendor_payments'] as $table) {
            if ($this->db->table($table)->where('company_id', $companyId)->where('mode', 'bank')->where('bank_account_id', null)->countAllResults() > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Receipts (in) and vendor payments (out) of the company, in date order; on the same day in the order entered.
     *
     * @return list<array<string, mixed>>
     */
    private function movements(int $companyId): array
    {
        $receipts = $this->db->table('receipts')
            ->select('receipts.id, receipt_number AS number, receipt_date AS date, receipts.created_at, mode, bank_account_id, amount, reference, receipts.client_id, clients.name AS party')
            ->join('clients', 'clients.id = receipts.client_id', 'left')
            ->where('receipts.company_id', $companyId)
            ->get()->getResultArray();
        $payments = $this->db->table('vendor_payments')
            ->select('id, payment_number AS number, payment_date AS date, created_at, mode, bank_account_id, amount, reference, client_id, vendor_name AS party')
            ->where('company_id', $companyId)
            ->get()->getResultArray();

        $row = static fn (array $r, string $type): array => [
            'type'          => $type,
            'id'            => (int) $r['id'],
            'date'          => $r['date'],
            'createdAt'     => iso_timestamp($r['created_at']),
            'number'        => $r['number'],
            'clientId'      => $r['client_id'] === null ? null : (int) $r['client_id'],
            'party'         => $r['party'],
            'reference'     => $r['reference'],
            'mode'          => $r['mode'],
            'bankAccountId' => $r['bank_account_id'] === null ? null : (int) $r['bank_account_id'],
            'in'            => $type === 'receipt' ? (float) $r['amount'] : 0.0,
            'out'           => $type === 'payment' ? (float) $r['amount'] : 0.0,
        ];
        $all = [
            ...array_map(static fn (array $r): array => $row($r, 'receipt'), $receipts),
            ...array_map(static fn (array $r): array => $row($r, 'payment'), $payments),
        ];
        usort($all, static fn (array $a, array $b): int => strcmp($a['date'], $b['date'])
            ?: strcmp((string) $a['createdAt'], (string) $b['createdAt'])
            ?: strcmp($a['type'], $b['type'])
            ?: $a['id'] - $b['id']);

        return $all;
    }

    /**
     * @param array<string, mixed> $m
     */
    private function accountKeyOf(array $m, ?int $primaryId): string
    {
        if ($m['mode'] === 'cash') {
            return 'cash';
        }
        $id = $m['bankAccountId'] ?? $primaryId;

        return $id === null ? 'bank' : 'bank-' . $id;
    }

    /**
     * @param array<string, mixed> $account
     *
     * @return array<string, mixed>
     */
    private static function publicAccount(array $account): array
    {
        return [
            'key'            => $account['key'],
            'type'           => $account['type'],
            'bankAccountId'  => $account['bankAccountId'],
            'bankName'       => $account['bankName'],
            'accountNo'      => $account['accountNo'],
            'openingBalance' => Gst::round2($account['openingBalance']),
        ];
    }
}
