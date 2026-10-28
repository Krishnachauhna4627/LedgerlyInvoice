<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Seller (business) details printed on every invoice.
 */
class AddSellerDetailsToCompanies extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('address', 'companies')) {
            return;
        }

        $this->forge->addColumn('companies', [
            'address'    => ['type' => 'TEXT', 'null' => true],
            'state_code' => self::string(2, true),
            'gstin'      => self::string(15, true),
            'bank_name'  => self::string(100, true),
            'account_no' => self::string(34, true),
            'ifsc'       => self::string(11, true),
            'terms'      => ['type' => 'TEXT', 'null' => true],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('companies', ['address', 'state_code', 'gstin', 'bank_name', 'account_no', 'ifsc', 'terms']);
    }
}
