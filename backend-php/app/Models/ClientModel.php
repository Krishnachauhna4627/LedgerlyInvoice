<?php

namespace App\Models;

use App\Exceptions\HttpError;
use App\Libraries\Gst;
use App\Libraries\LedgerService;
use CodeIgniter\Model;

class ClientModel extends Model
{
    protected $table         = 'clients';
    protected $returnType    = 'array';
    protected $allowedFields = ['company_id', 'name', 'address', 'state_code', 'gstin', 'phone', 'email', 'opening_balance'];

    /**
     * clients.* plus the current balance (see LedgerService::BALANCE_SQL); toDto() needs both.
     */
    public function withBalance(): self
    {
        return $this->select('clients.*')->select(LedgerService::BALANCE_SQL . ' AS balance', false);
    }

    /**
     * Only ever returns a client that belongs to the given company.
     *
     * @return array<string, mixed>
     */
    public function findOwned(int $companyId, int $id): array
    {
        $row = $this->withBalance()->where('company_id', $companyId)->find($id);
        if (! $row) {
            throw new HttpError(404, 'Customer not found.');
        }

        return $row;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listFor(int $companyId): array
    {
        return array_map(self::toDto(...), $this->withBalance()->where('company_id', $companyId)->orderBy('name')->findAll());
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
            'address'   => $row['address'],
            'stateCode' => $row['state_code'],
            'gstin'     => $row['gstin'],
            'phone'     => $row['phone'],
            'email'          => $row['email'],
            'openingBalance' => (float) $row['opening_balance'],
            'balance'        => Gst::round2((float) $row['balance']),
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
            'address'    => $body['address'],
            'state_code' => $body['stateCode'],
            'gstin'      => $body['gstin'],
            'phone'      => $body['phone'],
            'email'           => $body['email'],
            'opening_balance' => Gst::round2((float) ($body['openingBalance'] ?? 0)),
        ];
    }
}
