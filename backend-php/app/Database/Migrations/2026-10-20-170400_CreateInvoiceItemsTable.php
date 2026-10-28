<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Invoice lines. Item details are copied so editing the saved item never changes an invoice.
 */
class CreateInvoiceItemsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('invoice_items')) {
            return;
        }

        $this->forge->addField([
            'id'             => self::id(),
            'invoice_id'     => self::foreignId(),
            'item_id'        => self::foreignId(true),
            'position'       => ['type' => 'INT', 'unsigned' => true],
            'description'    => self::string(200),
            'hsn_sac'        => self::string(20, true),
            'quantity'       => self::decimal('12,3'),
            'unit_price'     => self::decimal('12,2'),
            'gst_rate'       => self::decimal('5,2'),
            'taxable_amount' => self::decimal('14,2'),
            'cgst'           => self::decimal('14,2'),
            'sgst'           => self::decimal('14,2'),
            'igst'           => self::decimal('14,2'),
            'total_tax'      => self::decimal('14,2'),
            'line_total'     => self::decimal('14,2'),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addForeignKey('invoice_id', 'invoices', 'id', '', 'CASCADE', 'invoice_items_invoice_id_foreign');
        $this->forge->addForeignKey('item_id', 'items', 'id', '', 'SET NULL', 'invoice_items_item_id_foreign');
        $this->forge->createTable('invoice_items', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('invoice_items', true);
    }
}
