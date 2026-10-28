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
    protected $allowedFields = ['company_id', 'name', 'hsn_sac', 'unit', 'unit_price', 'gst_rate'];

    /**
     * Only ever returns an item that belongs to the given company.
     *
     * @return array<string, mixed>
     */
    public function findOwned(int $companyId, int $id): array
    {
        $row = $this->where('company_id', $companyId)->find($id);
        if (! $row) {
            throw new HttpError(404, 'Item not found.');
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
        ];
    }
}
