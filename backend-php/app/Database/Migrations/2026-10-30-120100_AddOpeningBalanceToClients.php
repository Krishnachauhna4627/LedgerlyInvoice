<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * What a customer owed (positive, Dr) or had paid in advance (negative, Cr) before their first invoice here.
 */
class AddOpeningBalanceToClients extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('opening_balance', 'clients')) {
            return;
        }

        $this->forge->addColumn('clients', [
            'opening_balance' => [...self::decimal('14,2', 0), 'after' => 'email'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('clients', 'opening_balance');
    }
}
