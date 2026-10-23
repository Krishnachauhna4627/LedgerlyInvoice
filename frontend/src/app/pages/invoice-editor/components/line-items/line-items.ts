import { Component, computed, input, output } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { Item } from '../../../../core/data/models';
import { UNITS } from '../../../../core/data/units';
import { LineAmounts } from '../../../../core/gst/gst';
import { GST_RATES } from '../../../../core/gst/gst-states';
import { Icon } from '../../../../shared/components/icon/icon';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';
import { PickerOption, SearchPicker } from '../search-picker/search-picker';

// "Particulars": one row per invoice line (a stacked card on small screens). The parent owns the FormArray.
@Component({
  selector: 'app-line-items',
  imports: [ReactiveFormsModule, Icon, InrPipe, SearchPicker],
  templateUrl: './line-items.html',
  styleUrl: './line-items.scss',
})
export class LineItems {
  readonly lines = input.required<FormArray>();
  readonly items = input.required<Item[]>();
  readonly amounts = input.required<LineAmounts[]>();
  readonly errorFor = input.required<(path: string) => string | null>();

  readonly picked = output<{ index: number; itemId: number }>();
  readonly newItem = output<number>();
  readonly removed = output<number>();
  readonly added = output();

  protected readonly rates = GST_RATES;
  protected readonly units = UNITS;
  protected readonly itemOptions = computed<PickerOption[]>(() =>
    this.items().map((i) => ({
      id: i.id,
      label: i.name,
      detail: [i.hsnSac ? `HSN ${i.hsnSac}` : null, `₹${i.unitPrice}`, `GST ${i.gstRate}%`].filter(Boolean).join(' · '),
      keywords: i.hsnSac ?? '',
    })),
  );

  protected err(index: number, field: string): string | null {
    return this.errorFor()(`lines.${index}.${field}`);
  }
}
