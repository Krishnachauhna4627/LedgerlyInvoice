<?php

namespace App\Libraries;

use App\Exceptions\HttpError;
use App\Models\ClientModel;
use App\Models\CompanyModel;
use App\Models\InvoiceModel;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\Database\RawSql;

/**
 * Port of backend/src/modules/invoices/invoices.service.js.
 */
class InvoiceService
{
    private const SORTS = [
        'date_desc'   => [['invoice_date', 'desc'], ['invoices.id', 'desc']],
        'date_asc'    => [['invoice_date', 'asc'], ['invoices.id', 'asc']],
        'amount_desc' => [['grand_total', 'desc']],
        'amount_asc'  => [['grand_total', 'asc']],
        'number_asc'  => [['invoice_number', 'asc']],
        'number_desc' => [['invoice_number', 'desc']],
        // Overdue, then unpaid, paid and drafts; newest first within each.
        'status' => [['invoice_date', 'desc'], ['invoices.id', 'desc']],
    ];

    private BaseConnection $db;

    public function __construct()
    {
        $this->db = db_connect();
    }

    /**
     * @param array{search?: string, from?: string, to?: string, status?: string, sort: string, limit?: int} $query
     *
     * @return list<array<string, mixed>>
     */
    public function listInvoices(int $companyId, array $query): array
    {
        $builder = $this->db->table('invoices')
            ->select('invoices.*')
            ->select(InvoiceModel::itemCountColumn(), false)
            ->where('company_id', $companyId);

        if (($query['search'] ?? '') !== '') {
            $builder->groupStart()
                ->like('invoice_number', $query['search'])
                ->orLike('client_name', $query['search'])
                ->orLike('client_gstin', $query['search'])
                ->groupEnd();
        }
        if (isset($query['from'])) {
            $builder->where('invoice_date >=', $query['from']);
        }
        if (isset($query['to'])) {
            $builder->where('invoice_date <=', $query['to']);
        }
        if (isset($query['status'])) {
            InvoiceModel::whereDisplayStatus($builder, $query['status']);
        }
        if ($query['sort'] === 'status') {
            $today = $this->db->escape(today());
            $builder->orderBy("CASE
                WHEN invoices.status = 'unpaid' AND due_date IS NOT NULL AND due_date < {$today} THEN 1
                WHEN invoices.status = 'unpaid' THEN 2
                WHEN invoices.status = 'paid' THEN 3
                ELSE 4
              END", '', false);
        }
        foreach (self::SORTS[$query['sort']] as [$column, $direction]) {
            $builder->orderBy($column, $direction);
        }
        if (isset($query['limit'])) {
            $builder->limit($query['limit']);
        }

        return array_map(InvoiceModel::toListDto(...), (new LedgerService())->withAmountDue($builder->get()->getResultArray()));
    }

    /**
     * @return array<string, mixed>
     */
    public function getInvoice(int $companyId, int $id): array
    {
        $row     = (new LedgerService())->withAmountDue([$this->findInvoiceRow($companyId, $id)])[0];
        $lines   = $this->db->table('invoice_items')->where('invoice_id', $id)->orderBy('position')->get()->getResultArray();
        $company = $this->db->table('companies')->select('signature')->where('id', $companyId)->get()->getRowArray();

        return InvoiceModel::toDetailDto([...$row, 'signature' => $company['signature'] ?? null], $lines);
    }

    /**
     * Admin only: any company's invoice.
     *
     * @return array<string, mixed>
     */
    public function getAnyInvoice(int $id): array
    {
        $row = $this->db->table('invoices')->select('company_id')->where('id', $id)->get()->getRowArray();
        if (! $row) {
            throw new HttpError(404, 'Invoice not found.');
        }

        return $this->getInvoice((int) $row['company_id'], $id);
    }

    public function count(int $companyId): int
    {
        return $this->db->table('invoices')->where('company_id', $companyId)->countAllResults();
    }

    /**
     * Next plain number (1, 2, 3...) for this company. Older "INV-<year>-0001" numbers still count
     * towards the sequence so numbering carries on from them.
     */
    public function nextInvoiceNumber(int $companyId): string
    {
        $rows    = $this->db->table('invoices')->select('invoice_number')->where('company_id', $companyId)->get()->getResultArray();
        $highest = 0;
        foreach ($rows as $row) {
            $value   = preg_match('/^(?:INV-\d{4}-)?(\d+)$/', $row['invoice_number'], $match) ? (float) $match[1] : 0;
            $highest = max($highest, $value);
        }

        return number_format($highest + 1, 0, '', '');
    }

    /**
     * @param array<string, mixed> $input validated invoice body
     *
     * @return array<string, mixed>
     */
    public function createInvoice(int $companyId, array $input): array
    {
        [$invoice, $lineRows] = $this->buildInvoice($companyId, $input);

        try {
            $this->db->transException(true)->transStart();
            $this->db->table('invoices')->insert([...$invoice, 'paid_at' => $input['status'] === 'paid' ? new RawSql('CURRENT_TIMESTAMP') : null]);
            $id = (int) $this->db->insertID();
            $this->insertLines($id, $lineRows);
            $this->db->transComplete();
        } catch (DatabaseException $e) {
            throw self::duplicateNumberError($e);
        }
        // Receipts decide paid / unpaid (oldest invoices first), whatever status was sent.
        (new LedgerService())->settleInvoices((int) $invoice['client_id']);

        return $this->getInvoice($companyId, $id);
    }

    /**
     * @param array<string, mixed> $input validated invoice body
     *
     * @return array<string, mixed>
     */
    public function updateInvoice(int $companyId, int $id, array $input): array
    {
        $existing             = $this->findInvoiceRow($companyId, $id);
        [$invoice, $lineRows] = $this->buildInvoice($companyId, $input);
        $paidAt               = $input['status'] !== 'paid' ? null : ($existing['paid_at'] ?? new RawSql('CURRENT_TIMESTAMP'));

        try {
            $this->db->transException(true)->transStart();
            $this->db->table('invoices')->where('id', $id)->update([...$invoice, 'paid_at' => $paidAt]);
            $this->db->table('invoice_items')->where('invoice_id', $id)->delete();
            $this->insertLines($id, $lineRows);
            $this->db->transComplete();
        } catch (DatabaseException $e) {
            throw self::duplicateNumberError($e);
        }
        $ledger = new LedgerService();
        $ledger->settleInvoices((int) $invoice['client_id']);
        if ((int) $existing['client_id'] !== (int) $invoice['client_id']) {
            $ledger->settleInvoices($existing['client_id'] === null ? null : (int) $existing['client_id']);
        }

        return $this->getInvoice($companyId, $id);
    }

    /**
     * @return array<string, mixed>
     */
    public function setInvoiceStatus(int $companyId, int $id, string $status): array
    {
        $existing = $this->findInvoiceRow($companyId, $id);
        $this->db->table('invoices')->where('id', $id)->update([
            'status'  => $status,
            'paid_at' => $status === 'paid' ? ($existing['paid_at'] ?? new RawSql('CURRENT_TIMESTAMP')) : null,
        ]);

        return $this->getInvoice($companyId, $id);
    }

    public function deleteInvoice(int $companyId, int $id): void
    {
        $existing = $this->findInvoiceRow($companyId, $id);
        $this->db->table('invoices')->where('id', $id)->delete();
        (new LedgerService())->settleInvoices($existing['client_id'] === null ? null : (int) $existing['client_id']);
    }

    /**
     * @return array<string, mixed>
     */
    private function findInvoiceRow(int $companyId, int $id): array
    {
        $row = $this->db->table('invoices')->where(['id' => $id, 'company_id' => $companyId])->get()->getRowArray();
        if (! $row) {
            throw new HttpError(404, 'Invoice not found.');
        }

        return $row;
    }

    /**
     * Builds the full invoice row (snapshots + server-calculated totals) and its line rows.
     *
     * @param array<string, mixed> $input
     *
     * @return array{0: array<string, mixed>, 1: list<array<string, mixed>>}
     */
    private function buildInvoice(int $companyId, array $input): array
    {
        $seller = model(CompanyModel::class)->getRow($companyId);
        if (! $seller['state_code']) {
            throw new HttpError(
                400,
                'Please complete your Business Details, including the state, before saving an invoice.',
            );
        }

        try {
            $client = model(ClientModel::class)->findOwned($companyId, (int) $input['clientId']);
        } catch (HttpError) {
            throw new HttpError(400, 'Please fix the highlighted fields.', ['clientId' => 'Choose a saved customer.']);
        }

        $placeOfSupplyCode = $input['placeOfSupplyCode'] ?? $client['state_code'];
        $calc              = Gst::calculateInvoice($input['lines'], $seller['state_code'], $placeOfSupplyCode, (bool) $input['reverseCharge']);
        $totals            = $calc['totals'];

        $invoice = [
            'company_id'           => $companyId,
            'client_id'            => $client['id'],
            'invoice_number'       => $input['invoiceNumber'],
            'invoice_date'         => $input['invoiceDate'],
            'due_date'             => $input['dueDate'],
            'status'               => $input['status'],
            'template'             => $input['template'],
            'reverse_charge'       => $input['reverseCharge'] ? 1 : 0,
            'place_of_supply_code' => $placeOfSupplyCode,
            'is_inter_state'       => $calc['isInterState'] ? 1 : 0,
            'seller_name'          => $seller['name'],
            'seller_address'       => $seller['address'],
            'seller_state_code'    => $seller['state_code'],
            'seller_gstin'         => $seller['gstin'],
            'seller_phone'         => $seller['phone'],
            'seller_email'         => $seller['email'],
            'seller_bank_name'     => $seller['bank_name'],
            'seller_account_no'    => $seller['account_no'],
            'seller_ifsc'          => $seller['ifsc'],
            'seller_terms'         => $seller['terms'],
            'client_name'          => $client['name'],
            'client_address'       => $client['address'],
            'client_state_code'    => $client['state_code'],
            'client_gstin'         => $client['gstin'],
            'sub_total'            => $totals['subTotal'],
            'total_cgst'           => $totals['totalCgst'],
            'total_sgst'           => $totals['totalSgst'],
            'total_igst'           => $totals['totalIgst'],
            'total_tax'            => $totals['totalTax'],
            'grand_total'          => $totals['grandTotal'],
        ];

        // Only link lines to saved items that belong to this company.
        $itemIds      = array_values(array_unique(array_filter(array_column($calc['lines'], 'itemId'))));
        $ownedItemIds = $itemIds === [] ? [] : array_map('intval', array_column(
            $this->db->table('items')->select('id')->where('company_id', $companyId)->whereIn('id', $itemIds)->get()->getResultArray(),
            'id',
        ));

        $lineRows = [];
        foreach ($calc['lines'] as $index => $l) {
            $lineRows[] = [
                'item_id'        => in_array($l['itemId'], $ownedItemIds, false) ? (int) $l['itemId'] : null,
                'position'       => $index + 1,
                'description'    => $l['description'],
                'narration'      => $l['narration'],
                'hsn_sac'        => $l['hsnSac'],
                'quantity'       => $l['quantity'],
                'unit'           => $l['unit'],
                'unit_price'     => $l['unitPrice'],
                'gst_rate'       => $l['gstRate'],
                'taxable_amount' => $l['taxableAmount'],
                'cgst'           => $l['cgst'],
                'sgst'           => $l['sgst'],
                'igst'           => $l['igst'],
                'total_tax'      => $l['totalTax'],
                'line_total'     => $l['lineTotal'],
            ];
        }

        return [$invoice, $lineRows];
    }

    /**
     * @param list<array<string, mixed>> $lineRows
     */
    private function insertLines(int $invoiceId, array $lineRows): void
    {
        $this->db->table('invoice_items')->insertBatch(array_map(
            static fn (array $l): array => [...$l, 'invoice_id' => $invoiceId],
            $lineRows,
        ));
    }

    private static function duplicateNumberError(DatabaseException $e): \Throwable
    {
        if ($e->getCode() === 1062) {
            return new HttpError(409, 'This invoice number is already used.', [
                'invoiceNumber' => 'This invoice number is already used.',
            ]);
        }

        return $e;
    }
}
