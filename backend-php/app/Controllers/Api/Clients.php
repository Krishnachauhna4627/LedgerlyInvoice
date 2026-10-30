<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Libraries\LedgerService;
use App\Models\ClientModel;

/**
 * /api/clients — port of modules/clients/clients.js.
 */
class Clients extends BaseController
{
    private const CLEANERS = [
        'name'      => ['trim'],
        'address'   => ['trim', 'empty_to_null'],
        'stateCode' => [],
        'gstin'     => ['trim', 'upper', 'empty_to_null'],
        'phone'     => ['indian_phone', 'empty_to_null'],
        'email'     => ['trim', 'lower', 'empty_to_null'],
        // Missing → 0; null counts as 0 too (like Number(null) in the Node schema).
        'openingBalance' => ['default:0', 'nullable_number'],
    ];

    private ClientModel $clients;

    public function __construct()
    {
        $this->clients = model(ClientModel::class);
    }

    public function index()
    {
        return $this->json($this->clients->listFor($this->companyId()));
    }

    public function show(string $id)
    {
        return $this->json(ClientModel::toDto($this->clients->findOwned($this->companyId(), $this->id($id))));
    }

    /**
     * Date-wise sales, receipts and running balance for one customer.
     */
    public function ledger(string $id)
    {
        $client = $this->clients->findOwned($this->companyId(), $this->id($id));
        $get    = $this->request->getGet();
        $range  = ['from' => null, 'to' => null];
        foreach (['from', 'to'] as $key) {
            if (array_key_exists($key, $get)) {
                if (! is_string($get[$key]) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $get[$key]) !== 1) {
                    // Any invalid value means no range at all (same as the Node ledgerQuerySchema fallback).
                    $range = ['from' => null, 'to' => null];

                    break;
                }
                $range[$key] = $get[$key];
            }
        }

        return $this->json(['client' => ClientModel::toDto($client), ...(new LedgerService())->getLedger($client, $range['from'], $range['to'])]);
    }

    public function create()
    {
        $id = $this->clients->insert([...ClientModel::toRow($this->validatedClient()), 'company_id' => $this->companyId()]);

        return $this->json(ClientModel::toDto($this->clients->findOwned($this->companyId(), (int) $id)), 201);
    }

    public function update(string $id)
    {
        $row = $this->clients->findOwned($this->companyId(), $this->id($id));
        $this->clients->update($row['id'], ClientModel::toRow($this->validatedClient()));
        (new LedgerService())->settleInvoices((int) $row['id']);

        return $this->json(ClientModel::toDto($this->clients->findOwned($this->companyId(), (int) $row['id'])));
    }

    /**
     * Invoices keep their own copy of the client's details, so deleting a client never changes them.
     * Receipts don't, so a customer with receipts stays (their ledger would lose entries).
     */
    public function delete(string $id)
    {
        $row = $this->clients->findOwned($this->companyId(), $this->id($id));
        if (db_connect()->table('receipts')->where('client_id', $row['id'])->countAllResults() > 0) {
            throw new HttpError(409, 'This customer has receipts. Delete their receipts first.');
        }
        $this->clients->delete($row['id']);

        return $this->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedClient(): array
    {
        return $this->validated('client', self::CLEANERS, static function (array $data, array $errors): array {
            $valid = ! isset($errors['gstin']) && ! isset($errors['stateCode']);
            if ($valid && $data['gstin'] !== null && ! str_starts_with($data['gstin'], $data['stateCode'])) {
                return ['gstin' => 'GSTIN must start with the selected state code.'];
            }

            return [];
        });
    }
}
