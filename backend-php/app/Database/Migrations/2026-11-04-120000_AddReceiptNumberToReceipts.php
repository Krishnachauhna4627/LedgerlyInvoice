<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Receipt No., like the invoice number: unique per company. Existing receipts are numbered
 * 1, 2, 3… per company in date order. Nullable so the Node backend (which doesn't set it) can still
 * insert on the shared database; the PHP API always fills it in.
 */
class AddReceiptNumberToReceipts extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('receipt_number', 'receipts')) {
            return;
        }

        $this->forge->addColumn('receipts', [
            'receipt_number' => [...self::string(40, true), 'after' => 'client_id'],
        ]);
        $this->db->query(<<<'SQL'
            UPDATE receipts r
            JOIN (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY receipt_date, id) AS n FROM receipts
            ) numbered ON numbered.id = r.id
            SET r.receipt_number = numbered.n
            SQL);
        $this->db->query('ALTER TABLE receipts ADD UNIQUE KEY receipts_company_id_receipt_number_unique (company_id, receipt_number)');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE receipts DROP INDEX receipts_company_id_receipt_number_unique');
        $this->forge->dropColumn('receipts', 'receipt_number');
    }
}
