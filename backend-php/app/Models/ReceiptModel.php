<?php

namespace App\Models;

use App\Exceptions\HttpError;
use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Model;

/**
 * Money received from a customer, on account (port of modules/receipts/receipts.js).
 */
class ReceiptModel extends Model
{
    protected $table         = 'receipts';
    protected $returnType    = 'array';
    protected $allowedFields = ['company_id', 'client_id', 'receipt_date', 'mode', 'amount', 'reference'];

    public const MODES = ['cash', 'bank'];

    /**
     * This company's receipts, with the customer's name.
     */
    public function withClient(int $companyId): BaseBuilder
    {
        return $this->db->table('receipts')
            ->select('receipts.*, clients.name AS client_name')
            ->join('clients', 'clients.id = receipts.client_id')
            ->where('receipts.company_id', $companyId);
    }

    /**
     * @return array<string, mixed>
     */
    public function findOwned(int $companyId, int $id): array
    {
        $row = $this->withClient($companyId)->where('receipts.id', $id)->get()->getRowArray();
        if (! $row) {
            throw new HttpError(404, 'Receipt not found.');
        }

        return $row;
    }

    /**
     * @param array{from?: string, to?: string, clientId?: int, mode?: string} $query
     *
     * @return list<array<string, mixed>>
     */
    public function listFor(int $companyId, array $query): array
    {
        $builder = $this->withClient($companyId)->orderBy('receipt_date', 'desc')->orderBy('receipts.id', 'desc');
        if (isset($query['from'])) {
            $builder->where('receipt_date >=', $query['from']);
        }
        if (isset($query['to'])) {
            $builder->where('receipt_date <=', $query['to']);
        }
        if (isset($query['clientId'])) {
            $builder->where('receipts.client_id', $query['clientId']);
        }
        if (isset($query['mode'])) {
            $builder->where('mode', $query['mode']);
        }

        return array_map(self::toDto(...), $builder->get()->getResultArray());
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public static function toDto(array $row): array
    {
        return [
            'id'          => (int) $row['id'],
            'clientId'    => (int) $row['client_id'],
            'clientName'  => $row['client_name'],
            'receiptDate' => $row['receipt_date'],
            'mode'        => $row['mode'],
            'amount'      => (float) $row['amount'],
            'reference'   => $row['reference'],
        ];
    }

    /**
     * Validated API fields → columns.
     *
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    public static function toRow(array $body, int $clientId): array
    {
        return [
            'client_id'    => $clientId,
            'receipt_date' => $body['receiptDate'],
            'mode'         => $body['mode'],
            'amount'       => $body['amount'],
            'reference'    => $body['reference'],
        ];
    }
}
