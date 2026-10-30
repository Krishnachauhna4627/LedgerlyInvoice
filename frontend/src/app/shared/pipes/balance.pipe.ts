import { Pipe, PipeTransform } from '@angular/core';
import { InrPipe } from './inr.pipe';

const inr = new InrPipe();

// Ledger balance: positive = Dr (the customer owes), negative = Cr (advance).
// {{ 44000 | balance }} → ₹44,000.00 Dr   ·   {{ -1200 | balance: false }} → 1,200.00 Cr   ·   0 → ₹0.00
@Pipe({ name: 'balance' })
export class BalancePipe implements PipeTransform {
  transform(value: number | null | undefined, symbol = true): string {
    const n = Number(value ?? 0);
    const amount = inr.transform(Math.abs(n), symbol);
    return n > 0 ? `${amount} Dr` : n < 0 ? `${amount} Cr` : amount;
  }
}
