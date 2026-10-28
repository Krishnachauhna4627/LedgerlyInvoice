<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Libraries\InvoiceService;
use App\Models\InvoiceModel;
use CodeIgniter\Database\BaseBuilder;

/**
 * /api/reports — port of modules/reports/reports.js. Drafts are not sales, so every report leaves them out.
 */
class Reports extends BaseController
{
    private const SUM_COLUMNS = 'COUNT(*) AS count, SUM(sub_total) AS subTotal, SUM(total_cgst) AS cgst, SUM(total_sgst) AS sgst,'
        . ' SUM(total_igst) AS igst, SUM(total_tax) AS tax, SUM(grand_total) AS total';

    public function dashboard()
    {
        $companyId  = $this->companyId();
        $db         = db_connect();
        $monthStart = substr(today(), 0, 7) . '-01';
        $sumOf      = static fn (BaseBuilder $q): array => $q->select('COUNT(*) AS count, SUM(grand_total) AS amount', false)->get()->getRowArray();

        $thisMonth   = $sumOf($this->issuedInvoices($companyId, ['from' => $monthStart]));
        $outstanding = $sumOf($db->table('invoices')->where(['company_id' => $companyId, 'status' => 'unpaid']));
        $overdue     = $sumOf(InvoiceModel::whereDisplayStatus($db->table('invoices')->where('company_id', $companyId), 'overdue'));

        return $this->json([
            'thisMonth'      => ['sales' => (float) ($thisMonth['amount'] ?? 0), 'invoiceCount' => (int) $thisMonth['count']],
            'outstanding'    => ['amount' => (float) ($outstanding['amount'] ?? 0), 'count' => (int) $outstanding['count']],
            'overdue'        => ['amount' => (float) ($overdue['amount'] ?? 0), 'count' => (int) $overdue['count']],
            'clientCount'    => $db->table('clients')->where('company_id', $companyId)->countAllResults(),
            'itemCount'      => $db->table('items')->where('company_id', $companyId)->countAllResults(),
            'recentInvoices' => (new InvoiceService())->listInvoices($companyId, ['sort' => 'date_desc', 'limit' => 6]),
        ]);
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
