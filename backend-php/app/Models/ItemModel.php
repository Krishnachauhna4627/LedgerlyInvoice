<?php

namespace App\Models;

use App\Exceptions\HttpError;
use CodeIgniter\Model;

/**
 * Saved products / services used to fill invoice lines.
 */
class ItemModel extends Model
{
    protected $table         = 'items';
    protected $returnType    = 'array';
    protected $allowedFields = ['company_id', 'name', 'hsn_sac', 'unit', 'unit_price', 'gst_rate', 'opening_stock'];

    /**
     * Only ever returns an item that belongs to the given company.
     *
     * @return array<string, mixed>
     */
    public function findOwned(int $companyId, int $id): array
    {
        $row = $this->where('company_id', $companyId)->find($id);
        if (! $row) {
            throw new HttpError(404, 'Product/service not found.');
        }

        return $row;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listFor(int $companyId): array
    {
        return array_map(self::toDto(...), $this->where('company_id', $companyId)->orderBy('name')->findAll());
    }

    /**
     * @param array<string, mixed> $item an items row
     *
     * @return array<string, mixed>
     */
    public function stockLedger(array $item): array
    {
        $companyId = (int) $item['company_id'];
        $purchases = $this->db->table('purchase_items l')
            ->select('p.id, p.purchase_number AS number, p.purchase_date AS date, p.vendor_name AS party, p.created_at, l.id AS line_id, l.quantity, l.unit, l.unit_price')
            ->join('purchases p', 'p.id = l.purchase_id')
            ->where('l.item_id', $item['id'])
            ->where('p.company_id', $companyId)
            ->get()->getResultArray();
        $sales = $this->db->table('invoice_items l')
            ->select('i.id, i.invoice_number AS number, i.invoice_date AS date, i.client_name AS party, i.created_at, l.id AS line_id, l.quantity, l.unit, l.unit_price')
            ->join('invoices i', 'i.id = l.invoice_id')
            ->where('l.item_id', $item['id'])
            ->where('i.company_id', $companyId)
            ->where('i.status !=', 'draft')
            ->get()->getResultArray();

        $entry = static fn (string $type): \Closure => static fn (array $r): array => [
            'type'      => $type,
            'id'        => (int) $r['id'],
            'lineId'    => (int) $r['line_id'],
            'date'      => $r['date'],
            // When the purchase/invoice was saved (the date above has no time).
            'createdAt' => iso_timestamp($r['created_at']),
            'number'    => $r['number'],
            'party'     => $r['party'],
            'unit'      => $r['unit'],
            'rate'      => (float) $r['unit_price'],
            'quantityIn'  => $type === 'purchase' ? (float) $r['quantity'] : 0.0,
            'quantityOut' => $type === 'sale' ? (float) $r['quantity'] : 0.0,
        ];
        $entries = [...array_map($entry('purchase'), $purchases), ...array_map($entry('sale'), $sales)];
        // By date; on the same day purchases come before sales, then in the order they were entered.
        usort($entries, static fn (array $a, array $b): int => strcmp($a['date'], $b['date'])
            ?: (($a['type'] === 'purchase' ? 0 : 1) - ($b['type'] === 'purchase' ? 0 : 1))
            ?: $a['lineId'] - $b['lineId']);

        $round   = static fn (float $n): float => round($n, 3);
        $opening = (float) $item['opening_stock'];
        $balance = $opening;
        foreach ($entries as &$e) {
            $balance      = $round($balance + $e['quantityIn'] - $e['quantityOut']);
            $e['balance'] = $balance;
            unset($e['lineId']);
        }
        unset($e);

        return [
            'item'         => self::toDto($item),
            'openingStock' => $opening,
            'entries'      => $entries,
            'totals'       => [
                'purchased'    => $round(array_sum(array_column($entries, 'quantityIn'))),
                'sold'         => $round(array_sum(array_column($entries, 'quantityOut'))),
                'closingStock' => $balance,
            ],
        ];
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
            'name'      => $row['name'],
            'hsnSac'    => $row['hsn_sac'],
            'unit'      => $row['unit'],
            'unitPrice' => (float) $row['unit_price'],
            'gstRate'   => (float) $row['gst_rate'],
            'openingStock' => (float) $row['opening_stock'],
        ];
    }

    /**
     * Validated API fields → columns.
     *
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    public static function toRow(array $body): array
    {
        return [
            'name'       => $body['name'],
            'hsn_sac'    => $body['hsnSac'],
            'unit'       => $body['unit'],
            'unit_price' => $body['unitPrice'],
            'gst_rate'   => $body['gstRate'],
            'opening_stock' => $body['openingStock'],
        ];
    }
}
