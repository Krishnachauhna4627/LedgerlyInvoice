<?php

namespace App\Libraries;

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
     * Date-wise ledger of one customer (a clients row): sales are debits, receipts credits, with a
     * running balance. Entries before $from are folded into the opening balance; entries after $to are left out.
     *
     * @param array<string, mixed> $client
     *
     * @return array<string, mixed>
     */
    public function getLedger(array $client, ?string $from, ?string $to): array
    {
        $invoices = $this->db->table('invoices')
            ->select('id, invoice_number, invoice_date, grand_total')
            ->where('client_id', $client['id'])
            ->where('status !=', 'draft')
            ->get()->getResultArray();
        $receipts = $this->db->table('receipts')
            ->select('id, receipt_date, mode, amount, reference')
            ->where('client_id', $client['id'])
            ->get()->getResultArray();

        $all = [
            ...array_map(static fn (array $i): array => [
                'type'          => 'sale',
                'id'            => (int) $i['id'],
                'date'          => $i['invoice_date'],
                'invoiceNumber' => $i['invoice_number'],
                'mode'          => null,
                'reference'     => null,
                'debit'         => (float) $i['grand_total'],
                'credit'        => 0,
            ], $invoices),
            ...array_map(static fn (array $r): array => [
                'type'          => 'receipt',
                'id'            => (int) $r['id'],
                'date'          => $r['receipt_date'],
                'invoiceNumber' => null,
                'mode'          => $r['mode'],
                'reference'     => $r['reference'],
                'debit'         => 0,
                'credit'        => (float) $r['amount'],
            ], $receipts),
        ];
        // By date; on the same day sales come before receipts, then in the order they were entered.
        usort($all, static fn (array $a, array $b): int => strcmp($a['date'], $b['date'])
            ?: (($a['type'] === 'sale' ? -1 : 1) - ($b['type'] === 'sale' ? -1 : 1))
            ?: $a['id'] - $b['id']);

        $balance = (float) $client['opening_balance'];
        $entries = [];
        foreach ($all as $entry) {
            if ($to !== null && $entry['date'] > $to) {
                break;
            }
            $balance = Gst::round2($balance + $entry['debit'] - $entry['credit']);
            if ($from === null || $entry['date'] >= $from) {
                $entries[] = [...$entry, 'balance' => $balance];
            }
        }
        $sum = static fn (string $key): float => Gst::round2(array_reduce($entries, static fn (float $total, array $e): float => $total + $e[$key], 0.0));

        return [
            'from'           => $from,
            'to'             => $to,
            'openingBalance' => Gst::round2($balance - array_reduce($entries, static fn (float $total, array $e): float => $total + $e['debit'] - $e['credit'], 0.0)),
            'entries'        => $entries,
            'totals'         => ['sales' => $sum('debit'), 'receipts' => $sum('credit'), 'closingBalance' => $balance],
        ];
    }
}
