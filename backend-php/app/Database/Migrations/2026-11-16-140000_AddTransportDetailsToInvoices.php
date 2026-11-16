<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Optional vehicle / transport details on an invoice (vehicle no., transporter, mode), printed when filled in.
 */
class AddTransportDetailsToInvoices extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('transport_details', 'invoices')) {
            return;
        }

        $this->forge->addColumn('invoices', [
            'transport_details' => [...self::string(200, true), 'after' => 'place_of_supply_code'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('invoices', 'transport_details');
    }
}
