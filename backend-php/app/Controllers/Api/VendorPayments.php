<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Models\BankAccountModel;
use App\Models\PurchaseModel;
use App\Models\ReceiptModel;
use App\Models\VendorPaymentModel;
use CodeIgniter\Database\Exceptions\DatabaseException;

/**
 * /api/payments — money paid to vendors (the "Payments" page): payment details only.
 */
class VendorPayments extends BaseController
{
    private const CLEANERS = [
        'paymentNumber' => ['trim'],
        'vendorName'    => ['trim'],
        'paymentDate'   => [],
        'mode'          => [],
        'bankAccountId' => ['nullable_number'],
        'amount'        => ['number'],
        'reference'     => ['trim', 'empty_to_null'],
    ];

    private VendorPaymentModel $payments;

    public function __construct()
    {
        $this->payments = model(VendorPaymentModel::class);
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
        return $this->json(model(PurchaseModel::class)->vendorNames($this->companyId()));
    }

    public function create()
    {
        $row = VendorPaymentModel::toRow($this->validatedBody());
        try {
            $id = (int) $this->payments->insert(['company_id' => $this->companyId()] + $row);
        } catch (DatabaseException $e) {
            throw self::duplicateNumberError($e);
        }

        return $this->json($this->payments->findOwnedDto($this->companyId(), $id), 201);
    }

    public function update(string $id)
    {
        $existing = $this->payments->findOwnedDto($this->companyId(), $this->id($id));
        $row      = VendorPaymentModel::toRow($this->validatedBody());
        try {
            $this->payments->update($existing['id'], $row);
        } catch (DatabaseException $e) {
            throw self::duplicateNumberError($e);
        }

        return $this->json($this->payments->findOwnedDto($this->companyId(), $existing['id']));
    }

    public function delete(string $id)
    {
        $existing = $this->payments->findOwnedDto($this->companyId(), $this->id($id));
        $this->payments->delete($existing['id']);

        return $this->noContent();
    }

    private static function duplicateNumberError(DatabaseException $e): \Throwable
    {
        if ($e->getCode() === 1062) {
            return new HttpError(409, 'This payment number is already used.', ['paymentNumber' => 'This payment number is already used.']);
        }

        return $e;
    }

    /**
     * Validated body; cash payments have no bank account, a bank payment's account must be this company's.
     *
     * @return array<string, mixed>
     */
    private function validatedBody(): array
    {
        $body = $this->validated('vendorPayment', self::CLEANERS);
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
