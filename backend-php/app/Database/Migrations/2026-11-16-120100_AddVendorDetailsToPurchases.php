<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Purchases pick their vendor from the parties list (clients), like invoices pick a customer, and keep a snapshot
 * of the vendor's GSTIN and state (vendor_name stays the snapshot of the name). Bill totals gain the CGST / SGST /
 * IGST split, backfilled from the lines (see AddGstSplitToPurchaseItems).
 */
class AddVendorDetailsToPurchases extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('client_id', 'purchases')) {
            return;
        }

        $this->forge->addColumn('purchases', [
            'client_id'         => [...self::foreignId(true), 'after' => 'purchase_number'],
            'vendor_gstin'      => [...self::string(15, true), 'after' => 'vendor_name'],
            'vendor_state_code' => [...self::string(2, true), 'after' => 'vendor_gstin'],
            'total_cgst'        => [...self::decimal('14,2', 0), 'after' => 'sub_total'],
            'total_sgst'        => [...self::decimal('14,2', 0), 'after' => 'total_cgst'],
            'total_igst'        => [...self::decimal('14,2', 0), 'after' => 'total_sgst'],
        ]);
        $this->db->query(<<<'SQL'
            ALTER TABLE purchases ADD CONSTRAINT purchases_client_id_foreign
            FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL
            SQL);
        $this->db->query(<<<'SQL'
            UPDATE purchases p
            JOIN (SELECT purchase_id, SUM(cgst) AS cgst, SUM(sgst) AS sgst, SUM(igst) AS igst FROM purchase_items GROUP BY purchase_id) l
              ON l.purchase_id = p.id
            SET p.total_cgst = l.cgst, p.total_sgst = l.sgst, p.total_igst = l.igst
            SQL);
    }

    public function down()
    {
        $this->forge->dropForeignKey('purchases', 'purchases_client_id_foreign');
        $this->forge->dropColumn('purchases', ['client_id', 'vendor_gstin', 'vendor_state_code', 'total_cgst', 'total_sgst', 'total_igst']);
    }
}
