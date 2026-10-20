import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toApiError } from '../../../core/api/api-error';
import { ItemService } from '../../../core/data/item.service';
import { Item, ItemInput } from '../../../core/data/models';
import { GST_RATES } from '../../../core/gst/gst-states';
import { ToastService } from '../../../core/ui/toast.service';

type Field = 'name' | 'hsnSac' | 'unitPrice' | 'gstRate';

const MESSAGES: Record<Field, Record<string, string>> = {
  name: { required: 'Item name is required.', maxlength: 'Item name is too long.' },
  hsnSac: { maxlength: 'HSN/SAC is too long.' },
  unitPrice: { required: 'Rate is required.', min: "Rate can't be negative." },
  gstRate: { required: 'GST % is required.', min: "GST % can't be negative.", max: 'GST % must be 100 or less.' },
};

// Add / edit a saved product or service. Emits the saved item; the parent closes its modal.
@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm implements OnInit {
  private readonly items = inject(ItemService);
  private readonly toast = inject(ToastService);

  readonly item = input<Item | null>(null);
  readonly saved = output<Item>();
  readonly cancelled = output();

  protected readonly rates = GST_RATES;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    hsnSac: ['', Validators.maxLength(20)],
    unitPrice: [0 as number | null, [Validators.required, Validators.min(0)]],
    gstRate: [18 as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const i = this.item();
    if (i) {
      this.form.setValue({ name: i.name, hsnSac: i.hsnSac ?? '', unitPrice: i.unitPrice, gstRate: i.gstRate });
    }
  }

  protected errorFor(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.errors || !(control.touched || this.submitted())) return null;
    if (control.errors['server']) return control.errors['server'];
    return MESSAGES[field][Object.keys(control.errors)[0]] ?? 'Please check this field.';
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const input: ItemInput = {
      name: v.name.trim(),
      hsnSac: v.hsnSac.trim() || null,
      unitPrice: Number(v.unitPrice),
      gstRate: Number(v.gstRate),
    };
    const existing = this.item();
    this.submitting.set(true);
    this.error.set(null);
    (existing ? this.items.update(existing.id, input) : this.items.create(input)).subscribe({
      next: (item) => {
        this.toast.success(existing ? 'Item updated' : 'Item added');
        this.saved.emit(item);
      },
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        for (const [field, msg] of Object.entries(fieldErrors)) this.form.get(field)?.setErrors({ server: msg });
        this.error.set(message);
        this.submitting.set(false);
      },
    });
  }
}
