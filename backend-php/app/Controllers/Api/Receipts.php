<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Libraries\LedgerService;
use App\Models\ClientModel;
use App\Models\ReceiptModel;

/**
 * /api/receipts — port of modules/receipts/receipts.js.
 */
class Receipts extends BaseController
{
    private const CLEANERS = [
        'clientId'    => ['number'],
        'receiptDate' => [],
        'mode'        => [],
        'amount'      => ['number'],
        'reference'   => ['trim', 'empty_to_null'],
    ];

    private ReceiptModel $receipts;
    private LedgerService $ledger;

    public function __construct()
    {
        $this->receipts = model(ReceiptModel::class);
        $this->ledger   = new LedgerService();
    }

    public function index()
    {
        return $this->json($this->receipts->listFor($this->companyId(), $this->listQuery()));
    }

    public function create()
    {
        $body     = $this->validated('receipt', self::CLEANERS);
        $clientId = $this->ownedClientId((int) $body['clientId']);
        $id       = $this->receipts->insert([...ReceiptModel::toRow($body, $clientId), 'company_id' => $this->companyId()]);
        $this->ledger->settleInvoices($clientId);

        return $this->json(ReceiptModel::toDto($this->receipts->findOwned($this->companyId(), (int) $id)), 201);
    }

    public function update(string $id)
    {
        $existing = $this->receipts->findOwned($this->companyId(), $this->id($id));
        $body     = $this->validated('receipt', self::CLEANERS);
        $clientId = $this->ownedClientId((int) $body['clientId']);
        $this->receipts->update($existing['id'], ReceiptModel::toRow($body, $clientId));
        $this->ledger->settleInvoices($clientId);
        if ((int) $existing['client_id'] !== $clientId) {
            $this->ledger->settleInvoices((int) $existing['client_id']);
        }

        return $this->json(ReceiptModel::toDto($this->receipts->findOwned($this->companyId(), (int) $existing['id'])));
    }

    public function delete(string $id)
    {
        $existing = $this->receipts->findOwned($this->companyId(), $this->id($id));
        $this->receipts->delete($existing['id']);
        $this->ledger->settleInvoices((int) $existing['client_id']);

        return $this->noContent();
    }

    /**
     * The receipt's customer must be one of this company's saved customers.
     */
    private function ownedClientId(int $clientId): int
    {
        try {
            return (int) model(ClientModel::class)->findOwned($this->companyId(), $clientId)['id'];
        } catch (HttpError) {
            throw new HttpError(400, 'Please fix the highlighted fields.', ['clientId' => 'Choose a saved customer.']);
        }
    }

    /**
     * List filters from the query string. Any invalid value means no filters at all
     * (same as the Node listQuerySchema fallback).
     *
     * @return array{from?: string, to?: string, clientId?: int, mode?: string}
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
        if (array_key_exists('clientId', $get)) {
            $clientId = is_string($get['clientId']) ? trim($get['clientId']) : '';
            if (preg_match('/^\d+$/', $clientId) !== 1 || (int) $clientId < 1) {
                return [];
            }
            $query['clientId'] = (int) $clientId;
        }
        if (array_key_exists('mode', $get)) {
            if (! in_array($get['mode'], ReceiptModel::MODES, true)) {
                return [];
            }
            $query['mode'] = $get['mode'];
        }

        return $query;
    }
}
