<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Saved products / services used to fill invoice lines.
 */
class CreateItemsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('items')) {
            return;
        }

        $this->forge->addField([
            'id'         => self::id(),
            'company_id' => self::foreignId(),
            'name'       => self::string(200),
            'hsn_sac'    => self::string(20, true),
            'unit_price' => self::decimal('12,2', 0),
            'gst_rate'   => self::decimal('5,2', 18),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['company_id', 'name'], false, false, 'items_company_id_name_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'items_company_id_foreign');
        $this->forge->createTable('items', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('items', true);
    }
}
