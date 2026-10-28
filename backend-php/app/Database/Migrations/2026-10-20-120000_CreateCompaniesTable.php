<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

class CreateCompaniesTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        // Already created by the Node (knex) migrations.
        if ($this->db->tableExists('companies')) {
            return;
        }

        $this->forge->addField([
            'id'   => self::id(),
            'name' => self::string(150),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('companies', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('companies', true);
    }
}
