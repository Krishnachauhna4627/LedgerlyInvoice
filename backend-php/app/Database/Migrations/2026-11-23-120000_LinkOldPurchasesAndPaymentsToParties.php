<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Purchases and payments saved before the vendor had to be picked from the parties list have only a typed
 * vendor_name and no client_id, so they show in no party ledger. Link each to the company's party with the same
 * name (ignoring case and surrounding spaces) when there is exactly one; otherwise add the vendor as a new party
 * (GSTIN / state from its latest purchase, else the business's state) and link to that.
 *
 * Data only: down() leaves the links and parties in place (they are correct either way).
 */
class LinkOldPurchasesAndPaymentsToParties extends Migration
{
    public function up()
    {
        $unlinked = $this->db->query(<<<'SQL'
            SELECT company_id, TRIM(vendor_name) AS name FROM purchases WHERE client_id IS NULL AND TRIM(COALESCE(vendor_name, '')) <> ''
            UNION
            SELECT company_id, TRIM(vendor_name) AS name FROM vendor_payments WHERE client_id IS NULL AND TRIM(COALESCE(vendor_name, '')) <> ''
            SQL)->getResultArray();

        $linked = [];
        foreach ($unlinked as $row) {
            $companyId = (int) $row['company_id'];
            $key       = $companyId . "\0" . mb_strtolower($row['name']);
            if (isset($linked[$key])) {
                continue;
            }

            $matches = $this->db->query(
                'SELECT id FROM clients WHERE company_id = ? AND LOWER(TRIM(name)) = LOWER(?)',
                [$companyId, $row['name']],
            )->getResultArray();
            if (count($matches) === 1) {
                $clientId = (int) $matches[0]['id'];
            } elseif ($matches === []) {
                $clientId = $this->createParty($companyId, $row['name']);
            } else {
                // Several parties with that name: can't tell which one, leave it for the user to re-save.
                continue;
            }
            $linked[$key] = $clientId;

            foreach (['purchases', 'vendor_payments'] as $table) {
                $this->db->query(
                    "UPDATE {$table} SET client_id = ? WHERE company_id = ? AND client_id IS NULL AND LOWER(TRIM(vendor_name)) = LOWER(?)",
                    [$clientId, $companyId, $row['name']],
                );
            }
        }
    }

    public function down()
    {
        // Nothing to undo: see the class comment.
    }

    private function createParty(int $companyId, string $name): int
    {
        $latest = $this->db->query(
            'SELECT vendor_gstin, vendor_state_code FROM purchases
             WHERE company_id = ? AND LOWER(TRIM(vendor_name)) = LOWER(?) ORDER BY purchase_date DESC, id DESC LIMIT 1',
            [$companyId, $name],
        )->getRowArray();
        $company = $this->db->query('SELECT state_code FROM companies WHERE id = ?', [$companyId])->getRowArray();

        $this->db->table('clients')->insert([
            'company_id'      => $companyId,
            'name'            => mb_substr($name, 0, 150),
            'gstin'           => $latest['vendor_gstin'] ?? null,
            'state_code'      => $latest['vendor_state_code'] ?? $company['state_code'] ?? '',
            'opening_balance' => 0,
        ]);

        return (int) $this->db->insertID();
    }
}
