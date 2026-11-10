<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Quantity of a product in hand when the business starts using the app, in the item's unit.
 * Same precision as invoice line quantities.
 */
class AddOpeningStockToItems extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('opening_stock', 'items')) {
            return;
        }

        $this->forge->addColumn('items', [
            'opening_stock' => [...self::decimal('12,3', 0), 'after' => 'gst_rate'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('items', 'opening_stock');
    }
}
