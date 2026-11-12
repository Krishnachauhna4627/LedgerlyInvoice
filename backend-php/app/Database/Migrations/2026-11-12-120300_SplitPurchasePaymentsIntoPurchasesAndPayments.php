<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Each old purchase payment (items + how it was paid) becomes one purchase with the same items and
 * totals, plus one vendor payment of its grand total in the same mode. Ids are kept, so down() can
 * remove exactly the copied rows.
 */
class SplitPurchasePaymentsIntoPurchasesAndPayments extends Migration
{
    public function up()
    {
        if (! $this->db->tableExists('purchase_payments')) {
            return;
        }

        $this->db->transException(true)->transStart();
        $this->db->query(
            'INSERT INTO purchases (id, company_id, purchase_number, vendor_name, purchase_date, note, sub_total, total_tax, grand_total, created_at, updated_at)
             SELECT id, company_id, payment_number, vendor_name, purchase_date, note, sub_total, total_tax, grand_total, created_at, updated_at
             FROM purchase_payments',
        );
        $this->db->query(
            'INSERT INTO purchase_items (id, purchase_id, item_id, position, description, narration, hsn_sac, quantity, unit, unit_price, gst_rate, taxable_amount, total_tax, line_total, created_at, updated_at)
             SELECT id, purchase_payment_id, item_id, position, description, narration, hsn_sac, quantity, unit, unit_price, gst_rate, taxable_amount, total_tax, line_total, created_at, updated_at
             FROM purchase_payment_items',
        );
        // The narration column is shorter than the old note (100 vs 500 characters).
        $this->db->query(
            'INSERT INTO vendor_payments (id, company_id, payment_number, vendor_name, payment_date, mode, bank_account_id, amount, reference, created_at, updated_at)
             SELECT id, company_id, payment_number, vendor_name, purchase_date, mode, bank_account_id, grand_total, LEFT(note, 100), created_at, updated_at
             FROM purchase_payments
             WHERE grand_total > 0',
        );
        $this->db->transComplete();
    }

    public function down()
    {
        if (! $this->db->tableExists('purchase_payments')) {
            return;
        }

        $this->db->transException(true)->transStart();
        $this->db->query('DELETE FROM vendor_payments WHERE id IN (SELECT id FROM purchase_payments)');
        $this->db->query('DELETE FROM purchases WHERE id IN (SELECT id FROM purchase_payments)');
        $this->db->transComplete();
    }
}
