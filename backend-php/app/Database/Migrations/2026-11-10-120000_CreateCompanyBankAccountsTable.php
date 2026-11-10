<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * A business can have several bank accounts. The first one (lowest position) is the primary account:
 * it is mirrored into companies.bank_name / account_no / ifsc, which invoices snapshot and print.
 * Existing bank details become each company's first account.
 */
class CreateCompanyBankAccountsTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('company_bank_accounts')) {
            return;
        }

        $this->forge->addField([
            'id'         => self::id(),
            'company_id' => self::foreignId(),
            'bank_name'  => self::string(100, true),
            'account_no' => self::string(34, true),
            'ifsc'       => self::string(11, true),
            'position'   => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['company_id', 'position'], false, false, 'company_bank_accounts_company_id_position_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'company_bank_accounts_company_id_foreign');
        $this->forge->createTable('company_bank_accounts', false, ['ENGINE' => 'InnoDB']);

        $this->db->query(<<<'SQL'
            INSERT INTO company_bank_accounts (company_id, bank_name, account_no, ifsc, position)
            SELECT id, bank_name, account_no, ifsc, 0 FROM companies
            WHERE bank_name IS NOT NULL OR account_no IS NOT NULL OR ifsc IS NOT NULL
            SQL);
    }

    public function down()
    {
        $this->forge->dropTable('company_bank_accounts', true);
    }
}
