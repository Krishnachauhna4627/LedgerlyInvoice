<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * The items bought in a purchase payment. Like invoice lines, each keeps its own copy of the item's
 * details, so editing or deleting a saved product doesn't change past purchases.
 */
class CreatePurchasePaymentItemsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('purchase_payment_items')) {
            return;
        }

        $this->forge->addField([
            'id'                  => self::id(),
            'purchase_payment_id' => self::foreignId(),
            'item_id'             => self::foreignId(true),
            'position'            => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
            'description'         => self::string(200),
            'narration'           => self::string(500, true),
            'hsn_sac'             => self::string(20, true),
            'quantity'            => self::decimal('12,3'),
            'unit'                => self::string(10, true),
            'unit_price'          => self::decimal('14,2'),
            'gst_rate'            => self::decimal('5,2'),
            'taxable_amount'      => self::decimal('14,2'),
            'total_tax'           => self::decimal('14,2'),
            'line_total'          => self::decimal('14,2'),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['purchase_payment_id', 'position'], false, false, 'purchase_payment_items_purchase_payment_id_position_index');
        $this->forge->addForeignKey('purchase_payment_id', 'purchase_payments', 'id', '', 'CASCADE', 'purchase_payment_items_purchase_payment_id_foreign');
        $this->forge->addForeignKey('item_id', 'items', 'id', '', 'SET NULL', 'purchase_payment_items_item_id_foreign');
        $this->forge->createTable('purchase_payment_items', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('purchase_payment_items', true);
    }
}
