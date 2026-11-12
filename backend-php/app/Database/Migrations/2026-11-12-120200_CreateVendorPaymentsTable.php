<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Money paid to a vendor (the "Payments" page): payment details only — vendor, date, amount, cash or
 * bank and a short narration. The goods bought are recorded separately as purchases.
 */
class CreateVendorPaymentsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('vendor_payments')) {
            return;
        }

        $this->forge->addField([
            'id'              => self::id(),
            'company_id'      => self::foreignId(),
            'payment_number'  => self::string(40),
            'vendor_name'     => self::string(150),
            'payment_date'    => ['type' => 'DATE'],
            'mode'            => ['type' => 'ENUM', 'constraint' => ['cash', 'bank']],
            'bank_account_id' => self::foreignId(true),
            'amount'          => self::decimal('14,2'),
            'reference'       => self::string(100, true),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['company_id', 'payment_number'], 'vendor_payments_company_id_payment_number_unique');
        $this->forge->addKey(['company_id', 'payment_date'], false, false, 'vendor_payments_company_id_payment_date_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'vendor_payments_company_id_foreign');
        $this->forge->addForeignKey('bank_account_id', 'company_bank_accounts', 'id', '', 'SET NULL', 'vendor_payments_bank_account_id_foreign');
        $this->forge->createTable('vendor_payments', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('vendor_payments', true);
    }
}
