<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Exceptions\HttpError;
use App\Libraries\InvoiceService;
use App\Models\ClientModel;
use App\Models\CompanyModel;
use App\Models\InvoiceModel;
use App\Models\ItemModel;
use CodeIgniter\Database\BaseBuilder;

/**
 * /api/admin — super-user views across every company. Read-only; the only place that skips company scoping.
 * Port of modules/admin/admin.js.
 */
class Admin extends BaseController
{
    public function users()
    {
        $rows = $this->usersQuery()->orderBy('users.created_at', 'desc')->get()->getResultArray();

        return $this->json(array_map(self::toUserDto(...), $rows));
    }

    /**
     * One user with everything their company owns.
     */
    public function user(string $id)
    {
        $row = $this->usersQuery()->where('users.id', $this->id($id))->get()->getRowArray();
        if (! $row) {
            throw new HttpError(404, 'User not found.');
        }
        $companyId = (int) $row['company_id'];
        $invoices  = db_connect()->table('invoices')
            ->select('invoices.*')
            ->select(InvoiceModel::itemCountColumn(), false)
            ->where('company_id', $companyId)
            ->orderBy('invoice_date', 'desc')->orderBy('id', 'desc')
            ->get()->getResultArray();

        return $this->json([
            'user'     => self::toUserDto($row),
            'company'  => CompanyModel::toDto(model(CompanyModel::class)->getRow($companyId)),
            'clients'  => model(ClientModel::class)->listFor($companyId),
            'items'    => model(ItemModel::class)->listFor($companyId),
            'invoices' => array_map(InvoiceModel::toListDto(...), $invoices),
        ]);
    }

    public function invoice(string $id)
    {
        return $this->json((new InvoiceService())->getAnyInvoice($this->id($id)));
    }

    private function usersQuery(): BaseBuilder
    {
        $countFor = static fn (string $table, string $alias): string => "(SELECT COUNT(*) FROM {$table} WHERE {$table}.company_id = users.company_id) AS {$alias}";

        return db_connect()->table('users')
            ->join('companies', 'companies.id = users.company_id')
            ->select('users.id, users.name, users.username, users.email, users.phone, users.is_admin, users.created_at, users.company_id')
            ->select('companies.name AS company_name, companies.gstin AS company_gstin')
            ->select($countFor('clients', 'client_count'), false)
            ->select($countFor('items', 'item_count'), false)
            ->select($countFor('invoices', 'invoice_count'), false)
            // Drafts aren't issued yet, so they don't count as billed.
            ->select("(SELECT SUM(grand_total) FROM invoices WHERE invoices.company_id = users.company_id AND status != 'draft') AS billed_total", false);
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private static function toUserDto(array $row): array
    {
        return [
            'id'        => (int) $row['id'],
            'name'      => $row['name'],
            'username'  => $row['username'],
            'email'     => $row['email'],
            'phone'     => $row['phone'],
            'isAdmin'   => (bool) $row['is_admin'],
            'createdAt' => iso_timestamp($row['created_at']),
            'company'   => ['id' => (int) $row['company_id'], 'name' => $row['company_name'], 'gstin' => $row['company_gstin']],
            'stats'     => [
                'clients'     => (int) $row['client_count'],
                'items'       => (int) $row['item_count'],
                'invoices'    => (int) $row['invoice_count'],
                'billedTotal' => (float) ($row['billed_total'] ?? 0),
            ],
        ];
    }
}
