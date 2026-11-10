<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * The business bank account a bank receipt was paid into. Null for cash receipts, for receipts made
 * before this column existed, and when the account is later removed in Settings.
 */
class AddBankAccountIdToReceipts extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('bank_account_id', 'receipts')) {
            return;
        }

        $this->forge->addColumn('receipts', [
            'bank_account_id' => [...self::foreignId(true), 'after' => 'mode'],
        ]);
        $this->db->query(<<<'SQL'
            ALTER TABLE receipts ADD CONSTRAINT receipts_bank_account_id_foreign
            FOREIGN KEY (bank_account_id) REFERENCES company_bank_accounts (id) ON DELETE SET NULL
            SQL);
    }

    public function down()
    {
        $this->forge->dropForeignKey('receipts', 'receipts_bank_account_id_foreign');
        $this->forge->dropColumn('receipts', 'bank_account_id');
    }
}
