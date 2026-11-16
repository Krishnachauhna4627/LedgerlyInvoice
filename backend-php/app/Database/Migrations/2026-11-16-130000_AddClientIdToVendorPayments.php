<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Payments pick their vendor from the parties list (clients), like purchases. vendor_name stays as the snapshot of
 * the party's name (the payable balance is worked out per vendor name). Null on payments recorded before this, and
 * when the party is deleted.
 */
class AddClientIdToVendorPayments extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('client_id', 'vendor_payments')) {
            return;
        }

        $this->forge->addColumn('vendor_payments', [
            'client_id' => [...self::foreignId(true), 'after' => 'payment_number'],
        ]);
        $this->db->query(<<<'SQL'
            ALTER TABLE vendor_payments ADD CONSTRAINT vendor_payments_client_id_foreign
            FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL
            SQL);
    }

    public function down()
    {
        $this->forge->dropForeignKey('vendor_payments', 'vendor_payments_client_id_foreign');
        $this->forge->dropColumn('vendor_payments', 'client_id');
    }
}
