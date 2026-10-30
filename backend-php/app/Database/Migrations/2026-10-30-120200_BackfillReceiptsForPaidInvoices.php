<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Invoices marked paid before receipts existed get a matching bank receipt (dated the invoice date),
 * so customer ledgers don't show them as still due. Skips invoices that already have one, so it is
 * safe when the Node backend's copy of this migration runs on the same database.
 */
class BackfillReceiptsForPaidInvoices extends Migration
{
    // Compared as utf8mb4_bin: tables created by the two backends can have different default collations.
    private const REFERENCE = "CONCAT('Invoice ', i.invoice_number, ' (marked paid)') COLLATE utf8mb4_bin";

    public function up()
    {
        $reference = self::REFERENCE;
        $this->db->query(<<<SQL
            INSERT INTO receipts (company_id, client_id, receipt_date, mode, amount, reference)
            SELECT i.company_id, i.client_id, i.invoice_date, 'bank', i.grand_total, {$reference}
            FROM invoices i
            WHERE i.status = 'paid' AND i.client_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM receipts r WHERE r.client_id = i.client_id AND r.reference COLLATE utf8mb4_bin = {$reference}
              )
            SQL);
    }

    public function down()
    {
        $reference = self::REFERENCE;
        $this->db->query("DELETE r FROM receipts r JOIN invoices i ON i.client_id = r.client_id AND r.reference COLLATE utf8mb4_bin = {$reference}");
    }
}
