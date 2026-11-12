<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The combined purchase-payment tables are replaced by purchases / purchase_items / vendor_payments
 * (data moved by SplitPurchasePaymentsIntoPurchasesAndPayments).
 */
class DropPurchasePaymentsTables extends Migration
{
    public function up()
    {
        $this->forge->dropTable('purchase_payment_items', true);
        $this->forge->dropTable('purchase_payments', true);
    }

    /**
     * Recreates the old tables and fills them back from purchases, taking the mode and bank account
     * from the payment with the same id (cash when there is none).
     */
    public function down()
    {
        // Migration files aren't autoloaded (their names start with a timestamp).
        require_once __DIR__ . '/2026-11-10-150000_CreatePurchasePaymentsTable.php';
        require_once __DIR__ . '/2026-11-10-150100_CreatePurchasePaymentItemsTable.php';
        (new CreatePurchasePaymentsTable($this->forge))->up();
        (new CreatePurchasePaymentItemsTable($this->forge))->up();

        $this->db->transException(true)->transStart();
        $this->db->query(
            "INSERT INTO purchase_payments (id, company_id, payment_number, vendor_name, purchase_date, mode, bank_account_id, note, sub_total, total_tax, grand_total, created_at, updated_at)
             SELECT p.id, p.company_id, p.purchase_number, p.vendor_name, p.purchase_date, COALESCE(vp.mode, 'cash'), vp.bank_account_id, p.note, p.sub_total, p.total_tax, p.grand_total, p.created_at, p.updated_at
             FROM purchases p
             LEFT JOIN vendor_payments vp ON vp.id = p.id AND vp.company_id = p.company_id",
        );
        $this->db->query(
            'INSERT INTO purchase_payment_items (id, purchase_payment_id, item_id, position, description, narration, hsn_sac, quantity, unit, unit_price, gst_rate, taxable_amount, total_tax, line_total, created_at, updated_at)
             SELECT id, purchase_id, item_id, position, description, narration, hsn_sac, quantity, unit, unit_price, gst_rate, taxable_amount, total_tax, line_total, created_at, updated_at
             FROM purchase_items',
        );
        $this->db->transComplete();
    }
}
