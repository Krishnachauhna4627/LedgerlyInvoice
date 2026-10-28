<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Email so users can log in with either their username or their email.
 * Required at signup, but nullable here because accounts created before this have none.
 */
class AddEmailToUsers extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('email', 'users')) {
            return;
        }

        $this->forge->addColumn('users', ['email' => [...self::string(254, true), 'after' => 'username']]);
        $this->forge->addUniqueKey('email', 'users_email_unique');
        $this->forge->processIndexes('users');
    }

    public function down()
    {
        $this->forge->dropKey('users', 'users_email_unique', false);
        $this->forge->dropColumn('users', 'email');
    }
}
