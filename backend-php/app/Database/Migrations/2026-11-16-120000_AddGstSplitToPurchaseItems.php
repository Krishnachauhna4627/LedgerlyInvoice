<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Purchase lines split their GST into CGST + SGST (vendor in our state) or IGST (another state), like invoice lines.
 *
 * Existing lines have no vendor state, so their GST is backfilled as CGST + SGST (SGST takes the remainder, as
 * Gst::calculateLine() does); saving the bill again with a vendor picked recalculates it.
 */
class AddGstSplitToPurchaseItems extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('cgst', 'purchase_items')) {
            return;
        }

        $this->forge->addColumn('purchase_items', [
            'cgst' => [...self::decimal('14,2', 0), 'after' => 'taxable_amount'],
            'sgst' => [...self::decimal('14,2', 0), 'after' => 'cgst'],
            'igst' => [...self::decimal('14,2', 0), 'after' => 'sgst'],
        ]);
        $this->db->query('UPDATE purchase_items SET cgst = ROUND(total_tax / 2, 2), sgst = total_tax - ROUND(total_tax / 2, 2), igst = 0');
    }

    public function down()
    {
        $this->forge->dropColumn('purchase_items', ['cgst', 'sgst', 'igst']);
    }
}
