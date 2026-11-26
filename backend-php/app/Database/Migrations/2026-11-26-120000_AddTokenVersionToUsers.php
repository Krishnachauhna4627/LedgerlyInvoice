<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Login tokens carry the user's token_version ("ver"). Changing or resetting the password adds 1, so every
 * token issued before stops working (all devices are logged out). Tokens without "ver" count as version 0,
 * so sessions that exist when this is deployed keep working.
 */
class AddTokenVersionToUsers extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('token_version', 'users')) {
            return;
        }

        $this->forge->addColumn('users', [
            'token_version' => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0, 'after' => 'password_hash'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', 'token_version');
    }
}
