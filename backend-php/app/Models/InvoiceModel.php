<?php

namespace App\Models;

use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Model;

/**
 * Seller and client details are copied onto the invoice when it is saved, so later edits
 * to the company or client never change an issued invoice.
 */
class InvoiceModel extends Model
{
    protected $table      = 'invoices';
    protected $returnType = 'array';

    /**
     * "Overdue" is not stored: it's an unpaid invoice whose due date has passed.
     *
     * @param array<string, mixed> $row
     */
    public static function displayStatus(array $row): string
    {
        return $row['status'] === 'unpaid' && $row['due_date'] && $row['due_date'] < today() ? 'overdue' : $row['status'];
    }

    /**
     * SQL for the same rule, for filtering lists.
     */
    public static function whereDisplayStatus(BaseBuilder $query, string $status): BaseBuilder
    {
        if ($status === 'overdue') {
            return $query->where('invoices.status', 'unpaid')->where('due_date IS NOT NULL')->where('due_date <', today());
        }
        if ($status === 'unpaid') {
            return $query->where('invoices.status', 'unpaid')
                ->groupStart()->where('due_date', null)->orWhere('due_date >=', today())->groupEnd();
        }

        return $query->where('invoices.status', $status);
    }

    /**
     * Number of lines, as a select column for invoice lists.
     */
    public static function itemCountColumn(): string
    {
        return '(SELECT COUNT(*) FROM invoice_items WHERE invoice_items.invoice_id = invoices.id) AS item_count';
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public static function toListDto(array $row): array
    {
        return [
            'id'            => (int) $row['id'],
            'invoiceNumber' => $row['invoice_number'],
            'invoiceDate'   => $row['invoice_date'],
            'dueDate'       => $row['due_date'],
            'status'        => $row['status'],
            'displayStatus' => self::displayStatus($row),
            'clientId'      => $row['client_id'] === null ? null : (int) $row['client_id'],
            'clientName'    => $row['client_name'],
            'clientGstin'   => $row['client_gstin'],
            'itemCount'     => (int) ($row['item_count'] ?? 0),
            'subTotal'      => (float) $row['sub_total'],
            'totalTax'      => (float) $row['total_tax'],
            'grandTotal'    => (float) $row['grand_total'],
        ];
    }

    /**
     * @param array<string, mixed>       $row
     * @param list<array<string, mixed>> $lines
     *
     * @return array<string, mixed>
     */
    public static function toDetailDto(array $row, array $lines): array
    {
        return [
            ...self::toListDto([...$row, 'item_count' => count($lines)]),
            'paidAt'            => iso_timestamp($row['paid_at']),
            'template'          => $row['template'],
            'reverseCharge'     => (bool) $row['reverse_charge'],
            'placeOfSupplyCode' => $row['place_of_supply_code'],
            'isInterState'      => (bool) $row['is_inter_state'],
            'seller'            => [
                'name'      => $row['seller_name'],
                'address'   => $row['seller_address'],
                'stateCode' => $row['seller_state_code'],
                'gstin'     => $row['seller_gstin'],
                'phone'     => $row['seller_phone'],
                'email'     => $row['seller_email'],
                'bankName'  => $row['seller_bank_name'],
                'accountNo' => $row['seller_account_no'],
                'ifsc'      => $row['seller_ifsc'],
                'terms'     => $row['seller_terms'],
                // Not snapshotted (it's an image); always the company's current signature.
                'signature' => $row['signature'] ?? null,
            ],
            'client' => [
                'name'      => $row['client_name'],
                'address'   => $row['client_address'],
                'stateCode' => $row['client_state_code'],
                'gstin'     => $row['client_gstin'],
            ],
            'totals' => [
                'subTotal'   => (float) $row['sub_total'],
                'totalCgst'  => (float) $row['total_cgst'],
                'totalSgst'  => (float) $row['total_sgst'],
                'totalIgst'  => (float) $row['total_igst'],
                'totalTax'   => (float) $row['total_tax'],
                'grandTotal' => (float) $row['grand_total'],
            ],
            'lines' => array_map(static fn (array $l): array => [
                'id'            => (int) $l['id'],
                'itemId'        => $l['item_id'] === null ? null : (int) $l['item_id'],
                'description'   => $l['description'],
                'narration'     => $l['narration'],
                'hsnSac'        => $l['hsn_sac'],
                'quantity'      => (float) $l['quantity'],
                'unit'          => $l['unit'],
                'unitPrice'     => (float) $l['unit_price'],
                'gstRate'       => (float) $l['gst_rate'],
                'taxableAmount' => (float) $l['taxable_amount'],
                'cgst'          => (float) $l['cgst'],
                'sgst'          => (float) $l['sgst'],
                'igst'          => (float) $l['igst'],
                'totalTax'      => (float) $l['total_tax'],
                'lineTotal'     => (float) $l['line_total'],
            ], $lines),
        ];
    }
}
