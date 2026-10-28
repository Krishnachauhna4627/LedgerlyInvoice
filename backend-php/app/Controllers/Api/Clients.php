<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
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

    public function create()
    {
        $id = $this->clients->insert([...ClientModel::toRow($this->validatedClient()), 'company_id' => $this->companyId()]);

        return $this->json(ClientModel::toDto($this->clients->findOwned($this->companyId(), (int) $id)), 201);
    }

    public function update(string $id)
    {
        $row = $this->clients->findOwned($this->companyId(), $this->id($id));
        $this->clients->update($row['id'], ClientModel::toRow($this->validatedClient()));

        return $this->json(ClientModel::toDto($this->clients->findOwned($this->companyId(), (int) $row['id'])));
    }

    /**
     * Invoices keep their own copy of the client's details, so deleting a client never changes them.
     */
    public function delete(string $id)
    {
        $row = $this->clients->findOwned($this->companyId(), $this->id($id));
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
