<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Libraries\Gst;
use App\Libraries\InvoiceService;
use CodeIgniter\Database\BaseBuilder;

/**
 * /api/reports — port of modules/reports/reports.js. Drafts are not sales, so every report leaves them out.
 * The purchases report is PHP-only (the Node backend has no purchases).
 */
class Reports extends BaseController
{
    private const SUM_COLUMNS = 'COUNT(*) AS count, SUM(sub_total) AS subTotal, SUM(total_cgst) AS cgst, SUM(total_sgst) AS sgst,'
        . ' SUM(total_igst) AS igst, SUM(total_tax) AS tax, SUM(grand_total) AS total';

    /**
     * Dashboard for ?period= (this_month — the default — last_month, this_quarter, this_year = financial year):
     * money in and out over the period, receivable/payable balances at its end, each with the same figure for the
     * previous period (for the % change), plus month-by-month trend for the charts and sparklines.
     */
    public function dashboard()
    {
        $companyId = $this->companyId();
        $db        = db_connect();
        $period    = $this->request->getGet('period') ?? 'this_month';
        if (! is_string($period) || ! in_array($period, self::DASHBOARD_PERIODS, true)) {
            throw new HttpError(404, 'Not found.');
        }
        ['from' => $from, 'to' => $to, 'prevFrom' => $prevFrom, 'prevTo' => $prevTo, 'months' => $months] = self::dashboardPeriod($period, today());

        $flows = function (string $f, string $t) use ($companyId): array {
            $sales     = $this->issuedInvoices($companyId, ['from' => $f, 'to' => $t])->select('COUNT(*) AS count, SUM(grand_total) AS amount', false)->get()->getRowArray();
            $purchases = $this->purchasesIn($companyId, ['from' => $f, 'to' => $t])->select('COUNT(*) AS count, SUM(grand_total) AS amount', false)->get()->getRowArray();
            $received  = self::sumIn('receipts', 'receipt_date', $companyId, $f, $t);
            $paid      = self::sumIn('vendor_payments', 'payment_date', $companyId, $f, $t);

            return array_map(static fn (array $r): array => ['amount' => (float) ($r['amount'] ?? 0), 'count' => (int) $r['count']],
                compact('sales', 'purchases', 'received', 'paid'));
        };
        $now  = $flows($from, $to);
        $prev = $flows($prevFrom, $prevTo);
        $receivable     = self::receivableAt($companyId, $to);
        $payable        = self::payableAt($companyId, $to);
        $prevReceivable = self::receivableAt($companyId, $prevTo);
        $prevPayable    = self::payableAt($companyId, $prevTo);

        $vendors = $db->query(
            'SELECT COUNT(*) AS n FROM (SELECT vendor_name FROM purchases WHERE company_id = ? UNION SELECT vendor_name FROM vendor_payments WHERE company_id = ?) v',
            [$companyId, $companyId],
        )->getRowArray();

        $stat = static fn (array $cur, array $old): array => [...$cur, 'previous' => $old['amount']];

        return $this->json([
            'period'         => ['key' => $period, 'from' => $from, 'to' => $to],
            'sales'          => $stat($now['sales'], $prev['sales']),
            'purchases'      => $stat($now['purchases'], $prev['purchases']),
            'received'       => $stat($now['received'], $prev['received']),
            'paid'           => $stat($now['paid'], $prev['paid']),
            // Balances at the end of the period; count = customers / vendors with dues.
            'receivable'     => $stat($receivable, $prevReceivable),
            'payable'        => $stat($payable, $prevPayable),
            'clientCount'    => $db->table('clients')->where('company_id', $companyId)->countAllResults(),
            'vendorCount'    => (int) $vendors['n'],
            'itemCount'      => $db->table('items')->where('company_id', $companyId)->countAllResults(),
            'trend'          => $this->monthlyTrend($companyId, $to, $months),
            'recentInvoices' => (new InvoiceService())->listInvoices($companyId, ['sort' => 'date_desc', 'limit' => 6]),
        ]);
    }

    private const DASHBOARD_PERIODS = ['this_month', 'last_month', 'this_quarter', 'this_year'];

    /**
     * The period's dates, and the previous period of the same kind cut to the same length (so month-to-date is
     * compared with the same days of last month). months = how many months the trend charts show.
     *
     * @return array{from: string, to: string, prevFrom: string, prevTo: string, months: int}
     */
    public static function dashboardPeriod(string $period, string $today): array
    {
        [$y, $m] = array_map('intval', explode('-', $today));
        [$from, $to, $length] = match ($period) {
            'last_month'   => [self::monthStart($y, $m - 1), self::monthEnd($y, $m - 1), 1],
            'this_quarter' => [self::monthStart($y, $m - ($m - 1) % 3), $today, 3],
            // Indian financial year: 1 April – 31 March.
            'this_year'    => [($m >= 4 ? $y : $y - 1) . '-04-01', $today, 12],
            default        => [self::monthStart($y, $m), $today, 1],
        };
        [$ty, $tm, $td] = array_map('intval', explode('-', $to));
        $prevEnd = self::monthEnd($ty, $tm - $length);
        // Same day of the month, clamped to that month's last day (and the whole month when $to is a month end).
        $prevTo  = $to === self::monthEnd($ty, $tm) ? $prevEnd : min($prevEnd, substr($prevEnd, 0, 8) . sprintf('%02d', $td));
        [$fy, $fm] = array_map('intval', explode('-', $from));

        return [
            'from'     => $from,
            'to'       => $to,
            'prevFrom' => self::monthStart($fy, $fm - $length),
            'prevTo'   => $prevTo,
            'months'   => max(6, $length === 12 ? ($ty * 12 + $tm) - ($fy * 12 + $fm) + 1 : 6),
        ];
    }

    private static function monthStart(int $y, int $m): string
    {
        return date('Y-m-d', mktime(0, 0, 0, $m, 1, $y));
    }

    private static function monthEnd(int $y, int $m): string
    {
        return date('Y-m-d', mktime(0, 0, 0, $m + 1, 0, $y));
    }

    /**
     * @return array{count: int|string, amount: mixed}
     */
    private static function sumIn(string $table, string $dateColumn, int $companyId, string $from, string $to): array
    {
        return db_connect()->table($table)->select('COUNT(*) AS count, SUM(amount) AS amount', false)
            ->where('company_id', $companyId)->where("{$dateColumn} >=", $from)->where("{$dateColumn} <=", $to)
            ->get()->getRowArray();
    }

    /**
     * What customers owed at the end of $date (opening balance + sales − receipts); advances don't reduce it.
     *
     * @return array{amount: float, count: int}
     */
    private static function receivableAt(int $companyId, string $date): array
    {
        $row = db_connect()->query(
            "SELECT SUM(GREATEST(bal, 0)) AS amount, SUM(bal > 0) AS count FROM (
               SELECT c.opening_balance
                 + COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.client_id = c.id AND i.status <> 'draft' AND i.invoice_date <= ?), 0)
                 - COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.client_id = c.id AND r.receipt_date <= ?), 0) AS bal
               FROM clients c WHERE c.company_id = ?) t",
            [$date, $date, $companyId],
        )->getRowArray();

        return ['amount' => Gst::round2((float) ($row['amount'] ?? 0)), 'count' => (int) ($row['count'] ?? 0)];
    }

    /**
     * What we owed vendors at the end of $date (purchase bills − payments, per vendor name); advances don't reduce it.
     *
     * @return array{amount: float, count: int}
     */
    private static function payableAt(int $companyId, string $date): array
    {
        $row = db_connect()->query(
            'SELECT SUM(GREATEST(bal, 0)) AS amount, SUM(bal > 0) AS count FROM (
               SELECT vendor_name, SUM(amt) AS bal FROM (
                 SELECT vendor_name, grand_total AS amt FROM purchases WHERE company_id = ? AND purchase_date <= ?
                 UNION ALL
                 SELECT vendor_name, -amount AS amt FROM vendor_payments WHERE company_id = ? AND payment_date <= ?
               ) u GROUP BY vendor_name) t',
            [$companyId, $date, $companyId, $date],
        )->getRowArray();

        return ['amount' => Gst::round2((float) ($row['amount'] ?? 0)), 'count' => (int) ($row['count'] ?? 0)];
    }

    /**
     * The last $months months up to $to's month: sales, purchases, received and paid in each, and the
     * receivable / payable balances at each month's end (or at $to for its own month).
     *
     * @return list<array<string, mixed>>
     */
    private function monthlyTrend(int $companyId, string $to, int $months): array
    {
        [$ty, $tm] = array_map('intval', explode('-', $to));
        $first = self::monthStart($ty, $tm - $months + 1);
        $db    = db_connect();
        $byMonth = static fn (BaseBuilder $q, string $dateColumn, string $sumColumn): array => array_column(
            $q->select("DATE_FORMAT({$dateColumn}, '%Y-%m') AS month, SUM({$sumColumn}) AS amount", false)
                ->where("{$dateColumn} >=", $first)->where("{$dateColumn} <=", $to)
                ->groupBy('month')->get()->getResultArray(),
            'amount',
            'month',
        );
        $sales     = $byMonth($this->issuedInvoices($companyId, []), 'invoice_date', 'grand_total');
        $purchases = $byMonth($this->purchasesIn($companyId, []), 'purchase_date', 'grand_total');
        $received  = $byMonth($db->table('receipts')->where('company_id', $companyId), 'receipt_date', 'amount');
        $paid      = $byMonth($db->table('vendor_payments')->where('company_id', $companyId), 'payment_date', 'amount');

        $trend = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $month   = substr(self::monthStart($ty, $tm - $i), 0, 7);
            $end     = min(self::monthEnd($ty, $tm - $i), $to);
            $trend[] = [
                'month'      => $month,
                'sales'      => (float) ($sales[$month] ?? 0),
                'purchases'  => (float) ($purchases[$month] ?? 0),
                'received'   => (float) ($received[$month] ?? 0),
                'paid'       => (float) ($paid[$month] ?? 0),
                'receivable' => self::receivableAt($companyId, $end)['amount'],
                'payable'    => self::payableAt($companyId, $end)['amount'],
            ];
        }

        return $trend;
    }

    /**
     * Totals, month-by-month and HSN/SAC summary for a date range.
     */
    public function sales()
    {
        $range     = $this->range();
        $companyId = $this->companyId();

        $totals = $this->issuedInvoices($companyId, $range)->select(self::SUM_COLUMNS, false)->get()->getRowArray();
        $byMonth = $this->issuedInvoices($companyId, $range)
            ->select(self::SUM_COLUMNS, false)
            ->select("DATE_FORMAT(invoice_date, '%Y-%m') AS month", false)
            ->groupBy('month')
            ->orderBy('month')
            ->get()->getResultArray();
        $byHsn = $this->issuedInvoices($companyId, $range)
            ->join('invoice_items', 'invoice_items.invoice_id = invoices.id')
            ->select('invoice_items.hsn_sac AS hsnSac, invoice_items.gst_rate AS gstRate')
            ->select('SUM(invoice_items.taxable_amount) AS taxable, SUM(invoice_items.cgst) AS cgst, SUM(invoice_items.sgst) AS sgst,'
                . ' SUM(invoice_items.igst) AS igst, SUM(invoice_items.total_tax) AS tax', false)
            ->groupBy(['invoice_items.hsn_sac', 'invoice_items.gst_rate'])
            ->orderBy('invoice_items.hsn_sac')
            ->get()->getResultArray();

        return $this->json([
            'totals'  => self::toNumbers($totals),
            'byMonth' => array_map(self::toNumbers(...), $byMonth),
            'byHsn'   => array_map(self::toNumbers(...), $byHsn),
        ]);
    }

    /**
     * Purchase bills for a date range: totals, month-by-month and HSN/SAC summary (GST is one amount on purchases).
     */
    public function purchases()
    {
        $range     = $this->range();
        $companyId = $this->companyId();
        $sums      = 'COUNT(*) AS count, SUM(sub_total) AS subTotal, SUM(total_tax) AS tax, SUM(grand_total) AS total';

        $totals  = $this->purchasesIn($companyId, $range)->select($sums, false)->get()->getRowArray();
        $byMonth = $this->purchasesIn($companyId, $range)
            ->select($sums, false)
            ->select("DATE_FORMAT(purchase_date, '%Y-%m') AS month", false)
            ->groupBy('month')
            ->orderBy('month')
            ->get()->getResultArray();
        $byHsn = $this->purchasesIn($companyId, $range)
            ->join('purchase_items', 'purchase_items.purchase_id = purchases.id')
            ->select('purchase_items.hsn_sac AS hsnSac, purchase_items.gst_rate AS gstRate')
            ->select('SUM(purchase_items.taxable_amount) AS taxable, SUM(purchase_items.total_tax) AS tax', false)
            ->groupBy(['purchase_items.hsn_sac', 'purchase_items.gst_rate'])
            ->orderBy('purchase_items.hsn_sac')
            ->get()->getResultArray();

        return $this->json([
            'totals'  => self::toNumbers($totals),
            'byMonth' => array_map(self::toNumbers(...), $byMonth),
            'byHsn'   => array_map(self::toNumbers(...), $byHsn),
        ]);
    }

    /**
     * Every issued invoice in the range with its lines, for the CSV exports.
     */
    public function salesExport()
    {
        $range    = $this->range();
        $db       = db_connect();
        $invoices = $this->issuedInvoices($this->companyId(), $range)->orderBy('invoice_date')->orderBy('id')->get()->getResultArray();

        $linesByInvoice = [];
        if ($invoices !== []) {
            $lines = $db->table('invoice_items')
                ->whereIn('invoice_id', array_column($invoices, 'id'))
                ->orderBy('invoice_id')->orderBy('position')
                ->get()->getResultArray();
            foreach ($lines as $line) {
                $linesByInvoice[$line['invoice_id']][] = $line;
            }
        }

        return $this->json(array_map(static fn (array $inv): array => [
            'invoiceNumber'     => $inv['invoice_number'],
            'invoiceDate'       => $inv['invoice_date'],
            'status'            => $inv['status'],
            'sellerName'        => $inv['seller_name'],
            'sellerGstin'       => $inv['seller_gstin'],
            'clientName'        => $inv['client_name'],
            'clientAddress'     => $inv['client_address'],
            'clientStateCode'   => $inv['client_state_code'],
            'clientGstin'       => $inv['client_gstin'],
            'placeOfSupplyCode' => $inv['place_of_supply_code'],
            'reverseCharge'     => (bool) $inv['reverse_charge'],
            'subTotal'          => (float) $inv['sub_total'],
            'totalCgst'         => (float) $inv['total_cgst'],
            'totalSgst'         => (float) $inv['total_sgst'],
            'totalIgst'         => (float) $inv['total_igst'],
            'totalTax'          => (float) $inv['total_tax'],
            'grandTotal'        => (float) $inv['grand_total'],
            'lines'             => array_map(static fn (array $l): array => [
                'description'   => $l['description'],
                'narration'     => $l['narration'],
                'hsnSac'        => $l['hsn_sac'],
                'quantity'      => (float) $l['quantity'],
                'unit'          => $l['unit'],
                'unitPrice'     => (float) $l['unit_price'],
                'gstRate'       => (float) $l['gst_rate'],
                'taxableAmount' => (float) $l['taxable_amount'],
                'cgst'          => (float) $l['cgst'],
                'sgst'          => (float) $l['sgst'],
                'igst'          => (float) $l['igst'],
                'totalTax'      => (float) $l['total_tax'],
                'lineTotal'     => (float) $l['line_total'],
            ], $linesByInvoice[$inv['id']] ?? []),
        ], $invoices));
    }

    /**
     * @param array{from?: string, to?: string} $range
     */
    private function issuedInvoices(int $companyId, array $range): BaseBuilder
    {
        $q = db_connect()->table('invoices')->where('invoices.company_id', $companyId)->where('invoices.status !=', 'draft');
        if (isset($range['from'])) {
            $q->where('invoice_date >=', $range['from']);
        }
        if (isset($range['to'])) {
            $q->where('invoice_date <=', $range['to']);
        }

        return $q;
    }

    /**
     * @param array{from?: string, to?: string} $range
     */
    private function purchasesIn(int $companyId, array $range): BaseBuilder
    {
        $q = db_connect()->table('purchases')->where('purchases.company_id', $companyId);
        if (isset($range['from'])) {
            $q->where('purchase_date >=', $range['from']);
        }
        if (isset($range['to'])) {
            $q->where('purchase_date <=', $range['to']);
        }

        return $q;
    }

    /**
     * ?from / ?to as 'YYYY-MM-DD'; anything else answers 404 like the Node rangeSchema.
     *
     * @return array{from?: string, to?: string}
     */
    private function range(): array
    {
        $range = [];
        foreach (['from', 'to'] as $key) {
            $value = $this->request->getGet($key);
            if ($value === null) {
                continue;
            }
            if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
                throw new HttpError(404, 'Not found.');
            }
            $range[$key] = $value;
        }

        return $range;
    }

    /**
     * Sums as numbers (0 when there are no rows); month and hsnSac stay as they are.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private static function toNumbers(array $row): array
    {
        foreach ($row as $key => $value) {
            if ($key !== 'month' && $key !== 'hsnSac') {
                $row[$key] = (float) ($value ?? 0);
            }
        }

        return $row;
    }
}
