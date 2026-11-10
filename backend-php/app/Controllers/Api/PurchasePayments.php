<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Models\BankAccountModel;
use App\Models\PurchasePaymentModel;
use App\Models\ReceiptModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

/**
 * /api/purchase-payments — money paid to vendors for purchases (the "Payments" page).
 */
class PurchasePayments extends BaseController
{
    private const CLEANERS = [
        'paymentNumber' => ['trim'],
        'vendorName'    => ['trim'],
        'purchaseDate'  => [],
        'mode'          => [],
        'bankAccountId' => ['nullable_number'],
        'note'          => ['trim', 'empty_to_null'],
        'lines'         => [],
        'lines.*'       => [
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

    private PurchasePaymentModel $payments;

    public function __construct()
    {
        $this->payments = model(PurchasePaymentModel::class);
    }

    public function index()
    {
        return $this->json($this->payments->listFor($this->companyId(), $this->listQuery()));
    }

    public function nextNumber()
    {
        return $this->json(['paymentNumber' => $this->payments->nextPaymentNumber($this->companyId())]);
    }

    public function vendors()
    {
        return $this->json($this->payments->vendorNames($this->companyId()));
    }

    public function show(string $id)
    {
        return $this->json($this->payments->findOwnedDto($this->companyId(), $this->id($id)));
    }

    public function create()
    {
        $id = $this->save(null, $this->validatedBody());

        return $this->json($this->payments->findOwnedDto($this->companyId(), $id), 201);
    }

    public function update(string $id)
    {
        $existing = $this->payments->findOwnedDto($this->companyId(), $this->id($id));
        $this->save($existing['id'], $this->validatedBody());

        return $this->json($this->payments->findOwnedDto($this->companyId(), $existing['id']));
    }

    public function delete(string $id)
    {
        $existing = $this->payments->findOwnedDto($this->companyId(), $this->id($id));
        $this->payments->delete($existing['id']);

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
            $id = $this->payments->savePayment($this->companyId(), $id, $body);
            $db->transComplete();
        } catch (DatabaseException $e) {
            if ($e->getCode() === 1062) {
                throw new HttpError(409, 'This payment number is already used.', ['paymentNumber' => 'This payment number is already used.']);
            }

            throw $e;
        }

        return $id;
    }

    /**
     * Validated body; cash payments have no bank account, a bank payment's account must be this company's.
     *
     * @return array<string, mixed>
     */
    private function validatedBody(): array
    {
        $body = $this->validated('purchasePayment', self::CLEANERS);
        if ($body['mode'] !== 'bank' || $body['bankAccountId'] === null) {
            return ['bankAccountId' => null] + $body;
        }
        $accountId = (int) $body['bankAccountId'];
        if (! model(BankAccountModel::class)->isOwned($this->companyId(), $accountId)) {
            throw new HttpError(400, 'Please fix the highlighted fields.', ['bankAccountId' => 'Choose one of your bank accounts.']);
        }

        return ['bankAccountId' => $accountId] + $body;
    }

    /**
     * List filters from the query string; any invalid value means no filters.
     *
     * @return array{from?: string, to?: string, mode?: string}
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
        if (array_key_exists('mode', $get)) {
            if (! in_array($get['mode'], ReceiptModel::MODES, true)) {
                return [];
            }
            $query['mode'] = $get['mode'];
        }

        return $query;
    }
}
