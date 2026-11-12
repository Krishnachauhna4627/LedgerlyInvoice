<?php

namespace App\Models;

use App\Exceptions\HttpError;
use App\Libraries\Gst;
use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Model;

/**
 * Money paid to a vendor for a purchase, with the items bought (purchase_payment_items).
 */
class PurchasePaymentModel extends Model
{
    protected $table         = 'purchase_payments';
    protected $returnType    = 'array';
    protected $allowedFields = [
        'company_id', 'payment_number', 'vendor_name', 'purchase_date', 'mode', 'bank_account_id', 'note',
        'sub_total', 'total_tax', 'grand_total',
    ];

    private const ITEMS_TABLE = 'purchase_payment_items';

    /**
     * This company's payments, with the bank account's name and number.
     */
    private function withBank(int $companyId): BaseBuilder
    {
        return $this->db->table('purchase_payments')
            ->select('purchase_payments.*, bank.bank_name, bank.account_no')
            ->join('company_bank_accounts bank', 'bank.id = purchase_payments.bank_account_id', 'left')
            ->where('purchase_payments.company_id', $companyId);
    }

    /**
     * @param array{from?: string, to?: string, mode?: string, search?: string} $query
     *
     * @return list<array<string, mixed>>
     */
    public function listFor(int $companyId, array $query): array
    {
        $builder = $this->withBank($companyId)->orderBy('purchase_date', 'desc')->orderBy('purchase_payments.id', 'desc');
        if (isset($query['from'])) {
            $builder->where('purchase_date >=', $query['from']);
        }
        if (isset($query['to'])) {
            $builder->where('purchase_date <=', $query['to']);
        }
        if (isset($query['mode'])) {
            $builder->where('mode', $query['mode']);
        }
        $rows  = $builder->get()->getResultArray();
        $lines = $this->linesFor(array_map(static fn (array $r): int => (int) $r['id'], $rows));

        return array_map(static fn (array $r): array => self::toDto($r, $lines[(int) $r['id']] ?? []), $rows);
    }

    /**
     * @return array<string, mixed> the API shape, with its lines
     */
    public function findOwnedDto(int $companyId, int $id): array
    {
        $row = $this->withBank($companyId)->where('purchase_payments.id', $id)->get()->getRowArray();
        if (! $row) {
            throw new HttpError(404, 'Payment not found.');
        }

        return self::toDto($row, $this->linesFor([$id])[$id] ?? []);
    }

    /**
     * Next plain number (1, 2, 3...): one more than the highest numeric one.
     */
    public function nextPaymentNumber(int $companyId): string
    {
        $row = $this->db->table('purchase_payments')
            ->select('MAX(CAST(payment_number AS DECIMAL(65,0))) AS highest', false)
            ->where('company_id', $companyId)
            ->where("payment_number REGEXP '^[0-9]+$'", null, false)
            ->get()->getRowArray();

        return number_format((float) ($row['highest'] ?? 0) + 1, 0, '', '');
    }

    /**
     * Inserts or updates a payment and replaces its lines; totals are calculated here. Call inside a transaction.
     *
     * @param array<string, mixed> $body validated API fields
     */
    public function savePayment(int $companyId, ?int $id, array $body): int
    {
        $lines = array_map(static fn (array $l): array => [...$l, ...Gst::calculateLine($l, false)], $body['lines']);
        $sum   = static fn (string $key): float => Gst::round2(array_reduce($lines, static fn (float $t, array $l): float => $t + $l[$key], 0.0));
        $row   = [
            'payment_number'  => $body['paymentNumber'],
            'vendor_name'     => $body['vendorName'],
            'purchase_date'   => $body['purchaseDate'],
            'mode'            => $body['mode'],
            'bank_account_id' => $body['bankAccountId'],
            'note'            => $body['note'],
            'sub_total'       => $sum('taxableAmount'),
            'total_tax'       => $sum('totalTax'),
        ];
        $row['grand_total'] = Gst::round2($row['sub_total'] + $row['total_tax']);

        if ($id === null) {
            $id = (int) $this->insert(['company_id' => $companyId] + $row);
        } else {
            $this->update($id, $row);
            $this->db->table(self::ITEMS_TABLE)->where('purchase_payment_id', $id)->delete();
        }

        // Only link saved products that belong to this company.
        $itemIds = array_values(array_unique(array_filter(array_map(static fn (array $l) => $l['itemId'] === null ? null : (int) $l['itemId'], $lines))));
        $owned   = $itemIds === [] ? [] : array_map('intval', array_column(
            $this->db->table('items')->select('id')->where('company_id', $companyId)->whereIn('id', $itemIds)->get()->getResultArray(),
            'id',
        ));
        foreach ($lines as $position => $l) {
            $this->db->table(self::ITEMS_TABLE)->insert([
                'purchase_payment_id' => $id,
                'item_id'             => $l['itemId'] !== null && in_array((int) $l['itemId'], $owned, true) ? (int) $l['itemId'] : null,
                'position'            => $position,
                'description'         => $l['description'],
                'narration'           => $l['narration'],
                'hsn_sac'             => $l['hsnSac'],
                'quantity'            => $l['quantity'],
                'unit'                => $l['unit'],
                'unit_price'          => $l['unitPrice'],
                'gst_rate'            => $l['gstRate'],
                'taxable_amount'      => $l['taxableAmount'],
                'total_tax'           => $l['totalTax'],
                'line_total'          => $l['lineTotal'],
            ]);
        }

        return $id;
    }

    /**
     * Vendor names used before, for suggestions (most recent first).
     *
     * @return list<string>
     */
    public function vendorNames(int $companyId): array
    {
        $rows = $this->db->table('purchase_payments')
            ->select('vendor_name, MAX(purchase_date) AS last_date')
            ->where('company_id', $companyId)
            ->groupBy('vendor_name')
            ->orderBy('last_date', 'desc')
            ->limit(200)
            ->get()->getResultArray();

        return array_column($rows, 'vendor_name');
    }

    /**
     * @param list<int> $paymentIds
     *
     * @return array<int, list<array<string, mixed>>> lines per payment id, in order
     */
    private function linesFor(array $paymentIds): array
    {
        if ($paymentIds === []) {
            return [];
        }
        $rows = $this->db->table(self::ITEMS_TABLE)
            ->whereIn('purchase_payment_id', $paymentIds)
            ->orderBy('position')->orderBy('id')
            ->get()->getResultArray();
        $byPayment = [];
        foreach ($rows as $l) {
            $byPayment[(int) $l['purchase_payment_id']][] = [
                'itemId'        => $l['item_id'] === null ? null : (int) $l['item_id'],
                'description'   => $l['description'],
                'narration'     => $l['narration'],
                'hsnSac'        => $l['hsn_sac'],
                'quantity'      => (float) $l['quantity'],
                'unit'          => $l['unit'],
                'unitPrice'     => (float) $l['unit_price'],
                'gstRate'       => (float) $l['gst_rate'],
                'taxableAmount' => (float) $l['taxable_amount'],
                'totalTax'      => (float) $l['total_tax'],
                'lineTotal'     => (float) $l['line_total'],
            ];
        }

        return $byPayment;
    }

    /**
     * @param array<string, mixed>       $row
     * @param list<array<string, mixed>> $lines
     *
     * @return array<string, mixed>
     */
    private static function toDto(array $row, array $lines): array
    {
        return [
            'id'            => (int) $row['id'],
            'paymentNumber' => $row['payment_number'],
            'vendorName'    => $row['vendor_name'],
            'purchaseDate'  => $row['purchase_date'],
            // When it was saved (ISO timestamp); the date above has no time.
            'createdAt'     => iso_timestamp($row['created_at'] ?? null),
            'mode'          => $row['mode'],
            'bankAccountId' => $row['bank_account_id'] === null ? null : (int) $row['bank_account_id'],
            'bankAccount'   => $row['bank_account_id'] === null ? null : ['bankName' => $row['bank_name'], 'accountNo' => $row['account_no']],
            'note'          => $row['note'],
            'lines'         => $lines,
            'totals'        => [
                'subTotal'   => (float) $row['sub_total'],
                'totalTax'   => (float) $row['total_tax'],
                'grandTotal' => (float) $row['grand_total'],
            ],
        ];
    }
}
