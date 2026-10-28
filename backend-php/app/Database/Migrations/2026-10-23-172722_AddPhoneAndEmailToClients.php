<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Contact details for a client. Optional, so clients saved before this keep working.
 */
class AddPhoneAndEmailToClients extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('phone', 'clients')) {
            return;
        }

        $this->forge->addColumn('clients', [
            'phone' => [...self::string(20, true), 'after' => 'gstin'],
            'email' => [...self::string(254, true), 'after' => 'phone'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('clients', ['email', 'phone']);
    }
}
