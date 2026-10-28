<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Per-line unit of measure and a short narration shown under the item name (e.g. "Chain, 22K").
 */
class AddUnitAndNarrationToInvoiceItems extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('narration', 'invoice_items')) {
            return;
        }

        $this->forge->addColumn('invoice_items', [
            'narration' => [...self::string(500, true), 'after' => 'description'],
            'unit'      => [...self::string(10, true), 'after' => 'quantity'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('invoice_items', ['unit', 'narration']);
    }
}
