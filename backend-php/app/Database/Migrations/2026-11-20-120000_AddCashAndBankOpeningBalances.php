<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Opening balances for the cash & bank book: cash in hand on the company, and one per bank account
 * (money there before using the app). Receipts add to them, vendor payments take away.
 */
class AddCashAndBankOpeningBalances extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if (! $this->db->fieldExists('cash_opening_balance', 'companies')) {
            $this->forge->addColumn('companies', [
                'cash_opening_balance' => [...self::decimal('14,2', 0), 'after' => 'ifsc'],
            ]);
        }
        if (! $this->db->fieldExists('opening_balance', 'company_bank_accounts')) {
            $this->forge->addColumn('company_bank_accounts', [
                'opening_balance' => [...self::decimal('14,2', 0), 'after' => 'ifsc'],
            ]);
        }
    }

    public function down()
    {
        $this->forge->dropColumn('companies', 'cash_opening_balance');
        $this->forge->dropColumn('company_bank_accounts', 'opening_balance');
    }
}
