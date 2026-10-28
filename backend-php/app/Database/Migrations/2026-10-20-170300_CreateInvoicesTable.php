<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Seller and client details are copied onto the invoice when it is saved, so later edits
 * to the company or client never change an issued invoice.
 */
class CreateInvoicesTable extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->tableExists('invoices')) {
            return;
        }

        $this->forge->addField([
            'id'         => self::id(),
            'company_id' => self::foreignId(),
            'client_id'  => self::foreignId(true),

            'invoice_number'       => self::string(40),
            'invoice_date'         => ['type' => 'DATE'],
            'due_date'             => ['type' => 'DATE', 'null' => true],
            'status'               => ['type' => 'ENUM', 'constraint' => ['draft', 'unpaid', 'paid'], 'default' => 'unpaid'],
            'paid_at'              => ['type' => 'TIMESTAMP', 'null' => true],
            'template'             => ['type' => 'ENUM', 'constraint' => ['classic', 'modern', 'minimal'], 'default' => 'classic'],
            'reverse_charge'       => self::boolean(false),
            'irn'                  => self::string(100, true),
            'place_of_supply_code' => self::string(2),
            'is_inter_state'       => self::boolean(),

            'seller_name'       => self::string(150),
            'seller_address'    => ['type' => 'TEXT', 'null' => true],
            'seller_state_code' => self::string(2),
            'seller_gstin'      => self::string(15, true),
            'seller_bank_name'  => self::string(100, true),
            'seller_account_no' => self::string(34, true),
            'seller_ifsc'       => self::string(11, true),
            'seller_terms'      => ['type' => 'TEXT', 'null' => true],

            'client_name'       => self::string(150),
            'client_address'    => ['type' => 'TEXT', 'null' => true],
            'client_state_code' => self::string(2),
            'client_gstin'      => self::string(15, true),

            'sub_total'   => self::decimal('14,2'),
            'total_cgst'  => self::decimal('14,2'),
            'total_sgst'  => self::decimal('14,2'),
            'total_igst'  => self::decimal('14,2'),
            'total_tax'   => self::decimal('14,2'),
            'grand_total' => self::decimal('14,2'),

            ...self::timestamps(),
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['company_id', 'invoice_number'], 'invoices_company_id_invoice_number_unique');
        $this->forge->addKey(['company_id', 'invoice_date'], false, false, 'invoices_company_id_invoice_date_index');
        $this->forge->addForeignKey('company_id', 'companies', 'id', '', 'CASCADE', 'invoices_company_id_foreign');
        $this->forge->addForeignKey('client_id', 'clients', 'id', '', 'SET NULL', 'invoices_client_id_foreign');
        $this->forge->createTable('invoices', false, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('invoices', true);
    }
}
