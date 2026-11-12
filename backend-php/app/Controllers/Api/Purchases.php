<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Models\PurchaseModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

/**
 * /api/purchases — purchase bills from vendors with the items bought (the "Purchases" page).
 * What was paid for them is recorded separately in /api/payments.
 */
class Purchases extends BaseController
{
    private const CLEANERS = [
        'purchaseNumber' => ['trim'],
        'vendorName'     => ['trim'],
        'purchaseDate'   => [],
        'note'           => ['trim', 'empty_to_null'],
        'lines'          => [],
        'lines.*'        => [
            'itemId'      => ['nullable_number'],
            'description' => ['trim'],
            'narration'   => ['trim', 'empty_to_null'],
            'hsnSac'      => ['trim', 'empty_to_null'],
            'quantity'    => ['number'],
            'unit'        => ['empty_to_null'],
            'unitPrice'   => ['number'],
            'gstRate'     => ['number'],
        ],
    ];

    private PurchaseModel $purchases;

    public function __construct()
    {
        $this->purchases = model(PurchaseModel::class);
    }

    public function index()
    {
        return $this->json($this->purchases->listFor($this->companyId(), $this->listQuery()));
    }

    public function nextNumber()
    {
        return $this->json(['purchaseNumber' => $this->purchases->nextPurchaseNumber($this->companyId())]);
    }

    public function vendors()
    {
        return $this->json($this->purchases->vendorNames($this->companyId()));
    }

    public function show(string $id)
    {
        return $this->json($this->purchases->findOwnedDto($this->companyId(), $this->id($id)));
    }

    public function create()
    {
        $id = $this->save(null, $this->validated('purchase', self::CLEANERS));

        return $this->json($this->purchases->findOwnedDto($this->companyId(), $id), 201);
    }

    public function update(string $id)
    {
        $existing = $this->purchases->findOwnedDto($this->companyId(), $this->id($id));
        $this->save($existing['id'], $this->validated('purchase', self::CLEANERS));

        return $this->json($this->purchases->findOwnedDto($this->companyId(), $existing['id']));
    }

    public function delete(string $id)
    {
        $existing = $this->purchases->findOwnedDto($this->companyId(), $this->id($id));
        $this->purchases->delete($existing['id']);

        return $this->noContent();
    }

    /**
     * @param array<string, mixed> $body
     */
    private function save(?int $id, array $body): int
    {
        $db = db_connect();
        try {
            $db->transException(true)->transStart();
            $id = $this->purchases->savePurchase($this->companyId(), $id, $body);
            $db->transComplete();
        } catch (DatabaseException $e) {
            if ($e->getCode() === 1062) {
                throw new HttpError(409, 'This purchase number is already used.', ['purchaseNumber' => 'This purchase number is already used.']);
            }

            throw $e;
        }

        return $id;
    }

    /**
     * Date filters from the query string; any invalid value means no filters.
     *
     * @return array{from?: string, to?: string}
     */
    private function listQuery(): array
    {
        $get   = $this->request->getGet();
        $query = [];
        foreach (['from', 'to'] as $key) {
            if (array_key_exists($key, $get)) {
                if (! is_string($get[$key]) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $get[$key]) !== 1) {
                    return [];
                }
                $query[$key] = $get[$key];
            }
        }

        return $query;
    }
}
