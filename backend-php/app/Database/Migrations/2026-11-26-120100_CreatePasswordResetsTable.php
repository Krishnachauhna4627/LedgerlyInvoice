<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * One-time "Forgot password" links. Only a SHA-256 hash of the emailed token is stored, so the database alone
 * can't be used to reset a password. A link works once (used_at) and only until expires_at (UTC).
 */
class CreatePasswordResetsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('password_resets')) {
            return;
        }

        $this->forge->addField([
            'id'         => self::id(),
            'user_id'    => self::foreignId(),
            'token_hash' => ['type' => 'CHAR', 'constraint' => 64, 'null' => false],
            'expires_at' => ['type' => 'DATETIME', 'null' => false],
            'used_at'    => ['type' => 'DATETIME', 'null' => true],
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('token_hash', 'password_resets_token_hash_unique');
        $this->forge->addKey('user_id', false, false, 'password_resets_user_id_index');
        $this->forge->addForeignKey('user_id', 'users', 'id', '', 'CASCADE', 'password_resets_user_id_foreign');
        $this->forge->createTable('password_resets', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('password_resets', true);
    }
}
