<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Unit of measure for a saved item (e.g. PCS, KGS, GMS, SET). Optional; copied onto invoice lines.
 */
class AddUnitToItems extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('unit', 'items')) {
            return;
        }

        $this->forge->addColumn('items', ['unit' => [...self::string(10, true), 'after' => 'hsn_sac']]);
    }

    public function down()
    {
        $this->forge->dropColumn('items', 'unit');
    }
}
