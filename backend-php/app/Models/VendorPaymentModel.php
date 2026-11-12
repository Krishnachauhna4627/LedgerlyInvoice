<?php

namespace App\Models;

use App\Exceptions\HttpError;
use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\Model;

/**
 * Money paid to a vendor (the "Payments" page): payment details only. The goods bought are purchases.
 */
class VendorPaymentModel extends Model
{
    protected $table         = 'vendor_payments';
    protected $returnType    = 'array';
    protected $allowedFields = ['company_id', 'payment_number', 'vendor_name', 'payment_date', 'mode', 'bank_account_id', 'amount', 'reference'];

    /**
     * This company's payments, with the bank account's name and number.
     */
    private function withBank(int $companyId): BaseBuilder
    {
        return $this->db->table('vendor_payments')
            ->select('vendor_payments.*, bank.bank_name, bank.account_no')
            ->join('company_bank_accounts bank', 'bank.id = vendor_payments.bank_account_id', 'left')
            ->where('vendor_payments.company_id', $companyId);
    }

    /**
     * Next plain number (1, 2, 3...): one more than the highest numeric one.
     */
    public function nextPaymentNumber(int $companyId): string
    {
        $row = $this->db->table('vendor_payments')
            ->select('MAX(CAST(payment_number AS DECIMAL(65,0))) AS highest', false)
            ->where('company_id', $companyId)
            ->where("payment_number REGEXP '^[0-9]+$'", null, false)
            ->get()->getRowArray();

        return number_format((float) ($row['highest'] ?? 0) + 1, 0, '', '');
    }

    /**
     * @return array<string, mixed> the API shape
     */
    public function findOwnedDto(int $companyId, int $id): array
    {
        $row = $this->withBank($companyId)->where('vendor_payments.id', $id)->get()->getRowArray();
        if (! $row) {
            throw new HttpError(404, 'Payment not found.');
        }

        return self::toDto($row);
    }

    /**
     * @param array{from?: string, to?: string, mode?: string} $query
     *
     * @return list<array<string, mixed>>
     */
    public function listFor(int $companyId, array $query): array
    {
        $builder = $this->withBank($companyId)->orderBy('payment_date', 'desc')->orderBy('vendor_payments.id', 'desc');
        if (isset($query['from'])) {
            $builder->where('payment_date >=', $query['from']);
        }
        if (isset($query['to'])) {
            $builder->where('payment_date <=', $query['to']);
        }
        if (isset($query['mode'])) {
            $builder->where('mode', $query['mode']);
        }

        return array_map(self::toDto(...), $builder->get()->getResultArray());
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private static function toDto(array $row): array
    {
        return [
            'id'            => (int) $row['id'],
            'paymentNumber' => $row['payment_number'],
            'vendorName'    => $row['vendor_name'],
            'paymentDate'   => $row['payment_date'],
            // When it was saved (ISO timestamp); the date above has no time.
            'createdAt'     => iso_timestamp($row['created_at'] ?? null),
            'mode'          => $row['mode'],
            'bankAccountId' => $row['bank_account_id'] === null ? null : (int) $row['bank_account_id'],
            'bankAccount'   => ReceiptModel::bankAccountDto($row),
            'amount'        => (float) $row['amount'],
            'reference'     => $row['reference'],
        ];
    }

    /**
     * Validated API fields → columns.
     *
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    public static function toRow(array $body): array
    {
        return [
            'payment_number'  => $body['paymentNumber'],
            'vendor_name'     => $body['vendorName'],
            'payment_date'    => $body['paymentDate'],
            'mode'            => $body['mode'],
            'bank_account_id' => $body['bankAccountId'],
            'amount'          => $body['amount'],
            'reference'       => $body['reference'],
        ];
    }
}
