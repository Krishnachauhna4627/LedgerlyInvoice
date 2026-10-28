<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

class CreateClientsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('clients')) {
            return;
        }

        $this->forge->addField([
            'id'         => self::id(),
            'company_id' => self::foreignId(),
            'name'       => self::string(150),
            'address'    => ['type' => 'TEXT', 'null' => true],
            'state_code' => self::string(2),
            'gstin'      => self::string(15, true),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['company_id', 'name'], false, false, 'clients_company_id_name_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'clients_company_id_foreign');
        $this->forge->createTable('clients', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('clients', true);
    }
}
