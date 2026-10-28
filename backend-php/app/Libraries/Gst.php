<?php

namespace App\Libraries;

/**
 * GST rules shared by invoices and reports. Port of backend/src/lib/gst.js; the frontend mirrors these
 * in core/gst/ for live previews, but the server's numbers are the ones that get saved.
 */
class Gst
{
    /**
     * GST state codes ('25' and '28' are retired and intentionally missing).
     */
    public const STATE_CODES = [
        '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18',
        '19', '20', '21', '22', '23', '24', '26', '27', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38',
        '97', '99',
    ];

    public const GSTIN_PATTERN = '/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/';

    /**
     * Units of measure for items and invoice lines (GST UQC codes). Mirrored in frontend core/data/units.ts.
     */
    public const UNITS = [
        'PCS', 'NOS', 'SET', 'PRS', 'DOZ', 'BOX', 'PAC', 'BAG', 'BTL', 'CTN', 'ROL',
        'GMS', 'KGS', 'QTL', 'TON', 'MLT', 'LTR', 'CMS', 'MTR', 'SQF', 'SQM', 'UNT', 'OTH',
    ];

    /**
     * Same as the JS Math.round((value + Number.EPSILON) * 100) / 100, so both backends save identical totals.
     */
    public static function round2(float $value): float
    {
        return floor(($value + PHP_FLOAT_EPSILON) * 100 + 0.5) / 100;
    }

    /**
     * Tax for one line. Intra-state GST is split into CGST + SGST; SGST takes the remainder so the
     * two halves always add up to the line's tax exactly.
     *
     * @param array{quantity: float, unitPrice: float, gstRate: float} $line
     *
     * @return array{taxableAmount: float, cgst: float, sgst: float, igst: float, totalTax: float, lineTotal: float}
     */
    public static function calculateLine(array $line, bool $isInterState): array
    {
        $taxableAmount = self::round2($line['quantity'] * $line['unitPrice']);
        $totalTax      = self::round2(($taxableAmount * $line['gstRate']) / 100);
        $cgst          = $isInterState ? 0.0 : self::round2($totalTax / 2);
        $sgst          = $isInterState ? 0.0 : self::round2($totalTax - $cgst);
        $igst          = $isInterState ? $totalTax : 0.0;

        return [
            'taxableAmount' => $taxableAmount,
            'cgst'          => $cgst,
            'sgst'          => $sgst,
            'igst'          => $igst,
            'totalTax'      => $totalTax,
            'lineTotal'     => self::round2($taxableAmount + $totalTax),
        ];
    }

    /**
     * @param list<array<string, mixed>> $lines
     *
     * @return array{isInterState: bool, lines: list<array<string, mixed>>, totals: array<string, float>}
     */
    public static function calculateInvoice(array $lines, string $sellerStateCode, string $placeOfSupplyCode): array
    {
        $isInterState = $placeOfSupplyCode !== $sellerStateCode;
        $calculated   = array_map(static fn (array $line): array => [...$line, ...self::calculateLine($line, $isInterState)], $lines);
        $sum          = static fn (string $key): float => self::round2(array_reduce($calculated, static fn (float $total, array $line): float => $total + $line[$key], 0.0));

        $totals = [
            'subTotal'  => $sum('taxableAmount'),
            'totalCgst' => $sum('cgst'),
            'totalSgst' => $sum('sgst'),
            'totalIgst' => $sum('igst'),
            'totalTax'  => $sum('totalTax'),
        ];
        $totals['grandTotal'] = self::round2($totals['subTotal'] + $totals['totalTax']);

        return ['isInterState' => $isInterState, 'lines' => $calculated, 'totals' => $totals];
    }
}
