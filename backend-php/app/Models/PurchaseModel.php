<?php

namespace App\Models;

use App\Exceptions\HttpError;
use App\Libraries\Gst;
use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Model;

/**
 * A purchase bill from a vendor, with the items bought (purchase_items). Payments to vendors are
 * separate (VendorPaymentModel), like receipts are separate from invoices.
 */
class PurchaseModel extends Model
{
    protected $table         = 'purchases';
    protected $returnType    = 'array';
    protected $allowedFields = [
        'company_id', 'purchase_number', 'vendor_name', 'purchase_date', 'note', 'sub_total', 'total_tax', 'grand_total',
    ];

    private const ITEMS_TABLE = 'purchase_items';

    /**
     * This company's purchases.
     */
    private function owned(int $companyId): BaseBuilder
    {
        return $this->db->table('purchases')->where('purchases.company_id', $companyId);
    }

    /**
     * @param array{from?: string, to?: string} $query
     *
     * @return list<array<string, mixed>>
     */
    public function listFor(int $companyId, array $query): array
    {
        $builder = $this->owned($companyId)->orderBy('purchase_date', 'desc')->orderBy('purchases.id', 'desc');
        if (isset($query['from'])) {
            $builder->where('purchase_date >=', $query['from']);
        }
        if (isset($query['to'])) {
            $builder->where('purchase_date <=', $query['to']);
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
        $row = $this->owned($companyId)->where('purchases.id', $id)->get()->getRowArray();
        if (! $row) {
            throw new HttpError(404, 'Purchase not found.');
        }

        return self::toDto($row, $this->linesFor([$id])[$id] ?? []);
    }

    /**
     * Next plain number (1, 2, 3...): one more than the highest numeric one.
     */
    public function nextPurchaseNumber(int $companyId): string
    {
        $row = $this->db->table('purchases')
            ->select('MAX(CAST(purchase_number AS DECIMAL(65,0))) AS highest', false)
            ->where('company_id', $companyId)
            ->where("purchase_number REGEXP '^[0-9]+$'", null, false)
            ->get()->getRowArray();

        return number_format((float) ($row['highest'] ?? 0) + 1, 0, '', '');
    }

    /**
     * Inserts or updates a purchase and replaces its lines; totals are calculated here. Call inside a transaction.
     *
     * @param array<string, mixed> $body validated API fields
     */
    public function savePurchase(int $companyId, ?int $id, array $body): int
    {
        $lines = array_map(static fn (array $l): array => [...$l, ...Gst::calculateLine($l, false)], $body['lines']);
        $sum   = static fn (string $key): float => Gst::round2(array_reduce($lines, static fn (float $t, array $l): float => $t + $l[$key], 0.0));
        $row   = [
            'purchase_number' => $body['purchaseNumber'],
            'vendor_name'     => $body['vendorName'],
            'purchase_date'   => $body['purchaseDate'],
            'note'            => $body['note'],
            'sub_total'       => $sum('taxableAmount'),
            'total_tax'       => $sum('totalTax'),
        ];
        $row['grand_total'] = Gst::round2($row['sub_total'] + $row['total_tax']);

        if ($id === null) {
            $id = (int) $this->insert(['company_id' => $companyId] + $row);
        } else {
            $this->update($id, $row);
            $this->db->table(self::ITEMS_TABLE)->where('purchase_id', $id)->delete();
        }

        // Only link saved products that belong to this company.
        $itemIds = array_values(array_unique(array_filter(array_map(static fn (array $l) => $l['itemId'] === null ? null : (int) $l['itemId'], $lines))));
        $owned   = $itemIds === [] ? [] : array_map('intval', array_column(
            $this->db->table('items')->select('id')->where('company_id', $companyId)->whereIn('id', $itemIds)->get()->getResultArray(),
            'id',
        ));
        foreach ($lines as $position => $l) {
            $this->db->table(self::ITEMS_TABLE)->insert([
                'purchase_id'    => $id,
                'item_id'        => $l['itemId'] !== null && in_array((int) $l['itemId'], $owned, true) ? (int) $l['itemId'] : null,
                'position'       => $position,
                'description'    => $l['description'],
                'narration'      => $l['narration'],
                'hsn_sac'        => $l['hsnSac'],
                'quantity'       => $l['quantity'],
                'unit'           => $l['unit'],
                'unit_price'     => $l['unitPrice'],
                'gst_rate'       => $l['gstRate'],
                'taxable_amount' => $l['taxableAmount'],
                'total_tax'      => $l['totalTax'],
                'line_total'     => $l['lineTotal'],
            ]);
        }

        return $id;
    }

    /**
     * Vendor names used on purchases or payments, for suggestions (most recent first).
     *
     * @return list<string>
     */
    public function vendorNames(int $companyId): array
    {
        $rows = $this->db->query(
            'SELECT vendor_name, MAX(last_date) AS last_date FROM (
                SELECT vendor_name, MAX(purchase_date) AS last_date FROM purchases WHERE company_id = ? GROUP BY vendor_name
                UNION ALL
                SELECT vendor_name, MAX(payment_date) AS last_date FROM vendor_payments WHERE company_id = ? GROUP BY vendor_name
            ) AS used GROUP BY vendor_name ORDER BY last_date DESC LIMIT 200',
            [$companyId, $companyId],
        )->getResultArray();

        return array_column($rows, 'vendor_name');
    }

    /**
     * @param list<int> $purchaseIds
     *
     * @return array<int, list<array<string, mixed>>> lines per purchase id, in order
     */
    private function linesFor(array $purchaseIds): array
    {
        if ($purchaseIds === []) {
            return [];
        }
        $rows = $this->db->table(self::ITEMS_TABLE)
            ->whereIn('purchase_id', $purchaseIds)
            ->orderBy('position')->orderBy('id')
            ->get()->getResultArray();
        $byPurchase = [];
        foreach ($rows as $l) {
            $byPurchase[(int) $l['purchase_id']][] = [
                'itemId'        => $l['item_id'] === null ? null : (int) $l['item_id'],
                'description'    => $l['description'],
                'narration'      => $l['narration'],
                'hsnSac'        => $l['hsn_sac'],
                'quantity'       => (float) $l['quantity'],
                'unit'           => $l['unit'],
                'unitPrice'     => (float) $l['unit_price'],
                'gstRate'       => (float) $l['gst_rate'],
                'taxableAmount' => (float) $l['taxable_amount'],
                'totalTax'      => (float) $l['total_tax'],
                'lineTotal'     => (float) $l['line_total'],
            ];
        }

        return $byPurchase;
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
            'id'             => (int) $row['id'],
            'purchaseNumber' => $row['purchase_number'],
            'vendorName'     => $row['vendor_name'],
            'purchaseDate'   => $row['purchase_date'],
            // When it was saved (ISO timestamp); the date above has no time.
            'createdAt'      => iso_timestamp($row['created_at'] ?? null),
            'note'           => $row['note'],
            'lines'          => $lines,
            'totals'         => [
                'subTotal'   => (float) $row['sub_total'],
                'totalTax'   => (float) $row['total_tax'],
                'grandTotal' => (float) $row['grand_total'],
            ],
        ];
    }
}
