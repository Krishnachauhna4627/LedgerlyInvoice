<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Super users who can view every user and their company data (see Controllers/Api/Admin).
 */
class AddIsAdminToUsers extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('is_admin', 'users')) {
            return;
        }

        $this->forge->addColumn('users', ['is_admin' => [...self::boolean(false), 'after' => 'password_hash']]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', 'is_admin');
    }
}
