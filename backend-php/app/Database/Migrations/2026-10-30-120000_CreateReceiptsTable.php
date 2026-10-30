<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Money received from a customer (on account, not linked to one invoice). A customer with receipts
 * can't be deleted, so their ledger never loses entries.
 */
class CreateReceiptsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('receipts')) {
            return;
        }

        $this->forge->addField([
            'id'         => self::id(),
            'company_id' => self::foreignId(),
            'client_id'  => self::foreignId(),

            'receipt_date' => ['type' => 'DATE'],
            'mode'         => ['type' => 'ENUM', 'constraint' => ['cash', 'bank']],
            'amount'       => self::decimal('14,2'),
            'reference'    => self::string(100, true),
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['company_id', 'receipt_date'], false, false, 'receipts_company_id_receipt_date_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'receipts_company_id_foreign');
        $this->forge->addForeignKey('client_id', 'clients', 'id', '', '', 'receipts_client_id_foreign');
        $this->forge->createTable('receipts', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('receipts', true);
    }
}
