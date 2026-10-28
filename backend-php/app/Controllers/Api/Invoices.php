<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\InvoiceService;
use Config\Validation;

/**
 * /api/invoices — port of modules/invoices/invoices.routes.js (+ invoices.validation.js cleaning).
 */
class Invoices extends BaseController
{
    private const CLEANERS = [
        'clientId'          => ['number'],
        'invoiceNumber'     => ['trim'],
        'invoiceDate'       => [],
        'dueDate'           => [],
        'placeOfSupplyCode' => [],
        'reverseCharge'     => ['default:false'],
        'template'          => ['default:"classic"'],
        'status'            => ['default:"unpaid"'],
        'lines'             => [],
        'lines.*'           => [
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

    private const SORTS = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc', 'number_asc', 'number_desc', 'status'];

    private InvoiceService $invoices;

    public function __construct()
    {
        $this->invoices = new InvoiceService();
    }

    public function index()
    {
        return $this->json($this->invoices->listInvoices($this->companyId(), $this->listQuery()));
    }

    public function count()
    {
        return $this->json(['count' => $this->invoices->count($this->companyId())]);
    }

    public function nextNumber()
    {
        return $this->json(['invoiceNumber' => $this->invoices->nextInvoiceNumber($this->companyId())]);
    }

    public function show(string $id)
    {
        return $this->json($this->invoices->getInvoice($this->companyId(), $this->id($id)));
    }

    public function create()
    {
        return $this->json($this->invoices->createInvoice($this->companyId(), $this->validatedInvoice()), 201);
    }

    public function update(string $id)
    {
        $id = $this->id($id);

        return $this->json($this->invoices->updateInvoice($this->companyId(), $id, $this->validatedInvoice()));
    }

    public function setStatus(string $id)
    {
        $id     = $this->id($id);
        $status = $this->validated('invoiceStatus', ['status' => []])['status'];

        return $this->json($this->invoices->setInvoiceStatus($this->companyId(), $id, $status));
    }

    public function delete(string $id)
    {
        $this->invoices->deleteInvoice($this->companyId(), $this->id($id));

        return $this->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedInvoice(): array
    {
        return $this->validated('invoice', self::CLEANERS, static function (array $data, array $errors): array {
            $datesValid = ! isset($errors['invoiceDate']) && ! isset($errors['dueDate']);
            if ($datesValid && $data['dueDate'] !== null && $data['dueDate'] < $data['invoiceDate']) {
                return ['dueDate' => "Due date can't be before the invoice date."];
            }

            return [];
        });
    }

    /**
     * List filters from the query string. Any invalid value means no filters at all
     * (same as the Node listQuerySchema fallback).
     *
     * @return array{search?: string, from?: string, to?: string, status?: string, sort: string, limit?: int}
     */
    private function listQuery(): array
    {
        $get      = $this->request->getGet();
        $query    = ['sort' => 'date_desc'];
        $fallback = ['sort' => 'date_desc'];
        $isDate   = static fn ($v): bool => is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) === 1;

        if (array_key_exists('search', $get)) {
            if (! is_string($get['search']) || mb_strlen(trim($get['search'])) > 100) {
                return $fallback;
            }
            $query['search'] = trim($get['search']);
        }
        foreach (['from', 'to'] as $key) {
            if (array_key_exists($key, $get)) {
                if (! $isDate($get[$key])) {
                    return $fallback;
                }
                $query[$key] = $get[$key];
            }
        }
        if (array_key_exists('status', $get)) {
            if (! in_array($get['status'], [...Validation::INVOICE_STATUSES, 'overdue'], true)) {
                return $fallback;
            }
            $query['status'] = $get['status'];
        }
        if (array_key_exists('sort', $get)) {
            if (! in_array($get['sort'], self::SORTS, true)) {
                return $fallback;
            }
            $query['sort'] = $get['sort'];
        }
        if (array_key_exists('limit', $get)) {
            $limit = is_string($get['limit']) ? trim($get['limit']) : null;
            if ($limit === null || preg_match('/^\d+$/', $limit) !== 1 || (int) $limit < 1 || (int) $limit > 1000) {
                return $fallback;
            }
            $query['limit'] = (int) $limit;
        }

        return $query;
    }
}
