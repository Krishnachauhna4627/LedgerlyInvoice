<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Purchase bills from vendors (the "Purchases" page): vendor, date, items bought (purchase_items) and
 * totals calculated on the server. How they were paid lives in vendor_payments, like invoices / receipts.
 */
class CreatePurchasesTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('purchases')) {
            return;
        }

        $this->forge->addField([
            'id'              => self::id(),
            'company_id'      => self::foreignId(),
            'purchase_number' => self::string(40),
            'vendor_name'     => self::string(150),
            'purchase_date'   => ['type' => 'DATE'],
            'note'            => self::string(500, true),
            'sub_total'       => self::decimal('14,2', 0),
            'total_tax'       => self::decimal('14,2', 0),
            'grand_total'     => self::decimal('14,2', 0),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['company_id', 'purchase_number'], 'purchases_company_id_purchase_number_unique');
        $this->forge->addKey(['company_id', 'purchase_date'], false, false, 'purchases_company_id_purchase_date_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'purchases_company_id_foreign');
        $this->forge->createTable('purchases', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('purchases', true);
    }
}
