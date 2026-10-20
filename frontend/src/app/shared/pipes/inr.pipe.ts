import { Pipe, PipeTransform } from '@angular/core';

const FORMAT = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const PLAIN = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// {{ 123456.5 | inr }} → ₹1,23,456.50   ·   {{ 123456.5 | inr: false }} → 1,23,456.50
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, symbol = true): string {
    const n = Number(value ?? 0);
    return symbol ? FORMAT.format(n) : PLAIN.format(n);
  }
}
