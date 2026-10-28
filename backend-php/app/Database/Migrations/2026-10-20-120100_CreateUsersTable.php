<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

class CreateUsersTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('users')) {
            return;
        }

        $this->forge->addField([
            'id'            => self::id(),
            'company_id'    => self::foreignId(),
            'name'          => self::string(100),
            'username'      => self::string(30),
            'phone'         => self::string(20),
            'password_hash' => self::string(255),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('username', 'users_username_unique');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'users_company_id_foreign');
        $this->forge->createTable('users', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('users', true);
    }
}
