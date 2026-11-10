<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Money paid to a vendor for a purchase (the "Payments" page): vendor, date, items bought, totals
 * (calculated on the server) and how it was paid.
 */
class CreatePurchasePaymentsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('purchase_payments')) {
            return;
        }

        $this->forge->addField([
            'id'              => self::id(),
            'company_id'      => self::foreignId(),
            'payment_number'  => self::string(40),
            'vendor_name'     => self::string(150),
            'purchase_date'   => ['type' => 'DATE'],
            'mode'            => ['type' => 'ENUM', 'constraint' => ['cash', 'bank']],
            'bank_account_id' => self::foreignId(true),
            'note'            => self::string(500, true),
            'sub_total'       => self::decimal('14,2', 0),
            'total_tax'       => self::decimal('14,2', 0),
            'grand_total'     => self::decimal('14,2', 0),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['company_id', 'payment_number'], 'purchase_payments_company_id_payment_number_unique');
        $this->forge->addKey(['company_id', 'purchase_date'], false, false, 'purchase_payments_company_id_purchase_date_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'purchase_payments_company_id_foreign');
        $this->forge->addForeignKey('bank_account_id', 'company_bank_accounts', 'id', '', 'SET NULL', 'purchase_payments_bank_account_id_foreign');
        $this->forge->createTable('purchase_payments', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('purchase_payments', true);
    }
}
