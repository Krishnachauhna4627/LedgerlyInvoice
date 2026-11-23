<?php

namespace App\Libraries;

use App\Models\ReceiptModel;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\Database\RawSql;

/**
 * Port of backend/src/modules/receipts/ledger.js: customer balances, receipts settling invoices,
 * and the date-wise customer ledger.
 */
class LedgerService
{
    /**
     * A customer's balance: opening balance + sales (every invoice except drafts) − receipts.
     * Positive means the customer owes us (Dr, due); negative means they paid in advance (Cr).
     * Used as a column expression on the clients table.
     */
    public const BALANCE_SQL = "clients.opening_balance
        + COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.client_id = clients.id AND i.status <> 'draft'), 0)
        - COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.client_id = clients.id), 0)";

    /**
     * A party's total debits and credits across sales and purchases, as column expressions on the clients table.
     * Debit (they owe us more): sales invoices except drafts + payments we made to them as a vendor.
     * Credit (we owe them more): receipts from them + purchase bills from them as a vendor.
     * Closing balance = opening balance + debit − credit: Dr (positive) = receivable, Cr (negative) = payable.
     * Purchases and payments count only when linked to the party (client_id), i.e. recorded with the vendor picked.
     */
    public const PARTY_DEBIT_SQL = "COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.client_id = clients.id AND i.status <> 'draft'), 0)
        + COALESCE((SELECT SUM(vp.amount) FROM vendor_payments vp WHERE vp.client_id = clients.id), 0)";

    public const PARTY_CREDIT_SQL = 'COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.client_id = clients.id), 0)
        + COALESCE((SELECT SUM(p.grand_total) FROM purchases p WHERE p.client_id = clients.id), 0)';

    /**
     * Per customer: receipt money left over after the opening balance and the paid invoices, and the
     * oldest unpaid invoice (the one that leftover partly pays — see settleInvoices()).
     */
    private const PART_PAYMENT_SQL = "clients.id,
        COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.client_id = clients.id), 0)
        - clients.opening_balance
        - COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.client_id = clients.id AND i.status = 'paid'), 0) AS leftover,
        (SELECT i.id FROM invoices i WHERE i.client_id = clients.id AND i.status = 'unpaid'
          ORDER BY i.invoice_date, i.id LIMIT 1) AS first_unpaid_id";

    private BaseConnection $db;

    public function __construct()
    {
        $this->db = db_connect();
    }

    /**
     * Receipts settle the oldest invoices first (after the opening balance): every invoice they fully
     * cover is paid, the rest unpaid. Call after anything that changes a customer's receipts, invoices
     * or opening balance. Drafts are left alone.
     */
    public function settleInvoices(?int $clientId): void
    {
        if (! $clientId) {
            return;
        }
        $client = $this->db->table('clients')->select('opening_balance')->where('id', $clientId)->get()->getRowArray();
        if (! $client) {
            return;
        }
        $received = $this->db->table('receipts')->selectSum('amount', 'received')->where('client_id', $clientId)->get()->getRowArray();
        $credit   = Gst::round2((float) ($received['received'] ?? 0) - (float) $client['opening_balance']);
        $covered  = true;

        $invoices = $this->db->table('invoices')
            ->select('id, status, grand_total')
            ->where('client_id', $clientId)
            ->where('status !=', 'draft')
            ->orderBy('invoice_date')->orderBy('id')
            ->get()->getResultArray();
        foreach ($invoices as $invoice) {
            $total   = (float) $invoice['grand_total'];
            $covered = $covered && $credit >= $total;
            if ($covered) {
                $credit = Gst::round2($credit - $total);
            }
            $status = $covered ? 'paid' : 'unpaid';
            if ($status !== $invoice['status']) {
                $this->db->table('invoices')->where('id', $invoice['id'])->update([
                    'status'  => $status,
                    'paid_at' => $covered ? new RawSql('CURRENT_TIMESTAMP') : null,
                ]);
            }
        }
    }

    /**
     * Sets amount_due on invoice rows: 0 when paid; for the customer's oldest unpaid invoice, its total
     * minus any part payment; otherwise the full total.
     *
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function withAmountDue(array $rows): array
    {
        $clientIds = array_values(array_unique(array_map(
            static fn (array $r): int => (int) $r['client_id'],
            array_filter($rows, static fn (array $r): bool => $r['status'] === 'unpaid' && $r['client_id'] !== null),
        )));
        $parts = $clientIds === [] ? [] : $this->db->table('clients')
            ->select(self::PART_PAYMENT_SQL, false)
            ->whereIn('clients.id', $clientIds)
            ->get()->getResultArray();
        $partByClient = array_column($parts, null, 'id');

        return array_map(static function (array $row) use ($partByClient): array {
            $part     = $partByClient[$row['client_id']] ?? null;
            $leftover = $part !== null && (int) $part['first_unpaid_id'] === (int) $row['id'] ? (float) $part['leftover'] : 0.0;
            $total    = (float) $row['grand_total'];
            $due      = $row['status'] === 'paid' ? 0.0 : ($leftover > 0 ? max(Gst::round2($total - $leftover), 0.0) : $total);

            return [...$row, 'amount_due' => $due];
        }, $rows);
    }

    /**
     * Date-wise ledger of one party (a clients row), on both sides of the business:
     *   debit  (they owe us more / we owe them less): sales invoices (except drafts), payments we made to them;
     *   credit (they owe us less / we owe them more): receipts from them, purchase bills from them.
     * The running balance starts at the opening balance: positive = Dr (receivable), negative = Cr (payable) —
     * the same closing balance as the Ledgers/Party Detail list (PARTY_DEBIT_SQL / PARTY_CREDIT_SQL).
     * Entries before $from are folded into the opening balance; entries after $to are left out.
     *
     * Every entry has `number` (its voucher / bill number); sales also keep `invoiceNumber`, receipts `receiptNumber`.
     *
     * @param array<string, mixed> $client
     *
     * @return array<string, mixed>
     */
    public function getLedger(array $client, ?string $from, ?string $to): array
    {
        $invoices = $this->db->table('invoices')
            ->select('id, invoice_number, invoice_date, grand_total, created_at')
            ->where('client_id', $client['id'])
            ->where('status !=', 'draft')
            ->get()->getResultArray();
        $receipts = $this->db->table('receipts')
            ->select('receipts.id, receipt_number, receipt_date, receipts.created_at, mode, bank_account_id, amount, reference, bank.bank_name, bank.account_no')
            ->join('company_bank_accounts bank', 'bank.id = receipts.bank_account_id', 'left')
            ->where('client_id', $client['id'])
            ->get()->getResultArray();
        $purchases = $this->db->table('purchases')
            ->select('id, purchase_number, purchase_date, grand_total, note, created_at')
            ->where('client_id', $client['id'])
            ->get()->getResultArray();
        $payments = $this->db->table('vendor_payments')
            ->select('vendor_payments.id, payment_number, payment_date, vendor_payments.created_at, mode, bank_account_id, amount, reference, bank.bank_name, bank.account_no')
            ->join('company_bank_accounts bank', 'bank.id = vendor_payments.bank_account_id', 'left')
            ->where('client_id', $client['id'])
            ->get()->getResultArray();

        $entry = static fn (string $type, array $fields): array => [
            'type'          => $type,
            'invoiceNumber' => null,
            'receiptNumber' => null,
            'mode'          => null,
            'bankAccount'   => null,
            'reference'     => null,
            'debit'         => 0,
            'credit'        => 0,
            ...$fields,
        ];
        $all = [
            ...array_map(static fn (array $i): array => $entry('sale', [
                'id'            => (int) $i['id'],
                'date'          => $i['invoice_date'],
                'createdAt'     => iso_timestamp($i['created_at']),
                'number'        => $i['invoice_number'],
                'invoiceNumber' => $i['invoice_number'],
                'debit'         => (float) $i['grand_total'],
            ]), $invoices),
            ...array_map(static fn (array $r): array => $entry('receipt', [
                'id'            => (int) $r['id'],
                'date'          => $r['receipt_date'],
                'createdAt'     => iso_timestamp($r['created_at']),
                'number'        => $r['receipt_number'],
                'receiptNumber' => $r['receipt_number'],
                'mode'          => $r['mode'],
                'bankAccount'   => ReceiptModel::bankAccountDto($r),
                'reference'     => $r['reference'],
                'credit'        => (float) $r['amount'],
            ]), $receipts),
            ...array_map(static fn (array $p): array => $entry('purchase', [
                'id'        => (int) $p['id'],
                'date'      => $p['purchase_date'],
                'createdAt' => iso_timestamp($p['created_at']),
                'number'    => $p['purchase_number'],
                'reference' => $p['note'],
                'credit'    => (float) $p['grand_total'],
            ]), $purchases),
            ...array_map(static fn (array $v): array => $entry('payment', [
                'id'          => (int) $v['id'],
                'date'        => $v['payment_date'],
                'createdAt'   => iso_timestamp($v['created_at']),
                'number'      => $v['payment_number'],
                'mode'        => $v['mode'],
                'bankAccount' => ReceiptModel::bankAccountDto($v),
                'reference'   => $v['reference'],
                'debit'       => (float) $v['amount'],
            ]), $payments),
        ];
        // By date; on the same day bills (sales, purchases) come before money (receipts, payments), then in the
        // order they were entered.
        $order = ['sale' => 0, 'purchase' => 1, 'receipt' => 2, 'payment' => 3];
        usort($all, static fn (array $a, array $b): int => strcmp($a['date'], $b['date'])
            ?: $order[$a['type']] - $order[$b['type']]
            ?: strcmp((string) $a['createdAt'], (string) $b['createdAt'])
            ?: $a['id'] - $b['id']);

        $balance = (float) $client['opening_balance'];
        $entries = [];
        foreach ($all as $e) {
            if ($to !== null && $e['date'] > $to) {
                break;
            }
            $balance = Gst::round2($balance + $e['debit'] - $e['credit']);
            if ($from === null || $e['date'] >= $from) {
                $entries[] = [...$e, 'balance' => $balance];
            }
        }
        $sum = static fn (string $key, ?string $type = null): float => Gst::round2(array_reduce(
            $entries,
            static fn (float $total, array $e): float => $total + ($type === null || $e['type'] === $type ? $e[$key] : 0),
            0.0,
        ));

        return [
            'from'           => $from,
            'to'             => $to,
            'openingBalance' => Gst::round2($balance - array_reduce($entries, static fn (float $total, array $e): float => $total + $e['debit'] - $e['credit'], 0.0)),
            'entries'        => $entries,
            'totals'         => [
                'sales'          => $sum('debit', 'sale'),
                'receipts'       => $sum('credit', 'receipt'),
                'purchases'      => $sum('credit', 'purchase'),
                'payments'       => $sum('debit', 'payment'),
                'debit'          => $sum('debit'),
                'credit'         => $sum('credit'),
                'closingBalance' => $balance,
            ],
        ];
    }
}
