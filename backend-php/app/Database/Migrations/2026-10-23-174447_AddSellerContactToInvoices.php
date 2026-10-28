<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Snapshot of the seller's phone and email on each invoice, like the other seller details.
 */
class AddSellerContactToInvoices extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('seller_phone', 'invoices')) {
            return;
        }

        $this->forge->addColumn('invoices', [
            'seller_phone' => [...self::string(20, true), 'after' => 'seller_gstin'],
            'seller_email' => [...self::string(254, true), 'after' => 'seller_phone'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('invoices', ['seller_email', 'seller_phone']);
    }
}
