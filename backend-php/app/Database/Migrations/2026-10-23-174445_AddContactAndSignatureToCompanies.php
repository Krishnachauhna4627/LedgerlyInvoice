<?php

namespace App\Database\Migrations;

use App\Database\MigrationHelpers;
use CodeIgniter\Database\Migration;

/**
 * Seller contact details and a signature image, printed on invoices.
 * The signature is a small PNG/JPEG stored as a data URL (resized in the browser before upload).
 */
class AddContactAndSignatureToCompanies extends Migration
{
    use MigrationHelpers;

    public function up()
    {
        if ($this->db->fieldExists('signature', 'companies')) {
            return;
        }

        $this->forge->addColumn('companies', [
            'phone'     => [...self::string(20, true), 'after' => 'gstin'],
            'email'     => [...self::string(254, true), 'after' => 'phone'],
            'signature' => ['type' => 'MEDIUMTEXT', 'null' => true, 'after' => 'terms'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('companies', ['signature', 'email', 'phone']);
    }
}
