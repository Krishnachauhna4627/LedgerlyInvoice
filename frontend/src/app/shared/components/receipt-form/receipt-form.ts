import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toApiError } from '../../../core/api/api-error';
import { ClientService } from '../../../core/data/client.service';
import { Client, Receipt, ReceiptInput, ReceiptMode } from '../../../core/data/models';
import { ReceiptService } from '../../../core/data/receipt.service';
import { todayIso } from '../../../core/ui/dates';
import { ToastService } from '../../../core/ui/toast.service';
import { BalancePipe } from '../../pipes/balance.pipe';

type Field = 'clientId' | 'receiptDate' | 'mode' | 'amount' | 'reference';

const MESSAGES: Record<Field, Record<string, string>> = {
  clientId: { required: 'Choose a customer.' },
  receiptDate: { required: 'Receipt date is required.' },
  mode: { required: 'Choose cash or bank.' },
  amount: { required: 'Amount is required.', min: 'Amount must be more than 0.', max: 'Amount is too large.' },
  reference: { maxlength: 'Narration is too long.' },
};

// Record / edit money received from a customer. Emits the saved receipt; the parent closes its modal.
@Component({
  selector: 'app-receipt-form',
  imports: [ReactiveFormsModule, BalancePipe],
  templateUrl: './receipt-form.html',
  styleUrl: './receipt-form.scss',
})
export class ReceiptForm implements OnInit {
  private readonly receipts = inject(ReceiptService);
  private readonly toast = inject(ToastService);

  readonly receipt = input<Receipt | null>(null);
  // Prefill for a new receipt (e.g. from a customer's ledger or an invoice).
  readonly clientId = input<number | null>(null);
  readonly amount = input<number | null>(null);
  readonly saved = output<Receipt>();
  readonly cancelled = output();

  protected readonly clients = signal<Client[]>([]);
  protected readonly form = inject(NonNullableFormBuilder).group({
    clientId: [null as number | null, Validators.required],
    receiptDate: [todayIso(), Validators.required],
    mode: ['bank' as ReceiptMode, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(9_999_999_999)]],
    reference: ['', Validators.maxLength(100)],
  });
  private readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.clients().find((c) => c.id === this.selectedId()) ?? null);
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(ClientService)
      .list()
      .subscribe({
        next: (clients) => this.clients.set(clients),
        error: (err: unknown) => this.error.set(toApiError(err).message),
      });
    this.form.controls.clientId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.selectedId.set(id === null ? null : Number(id)));
  }

  ngOnInit(): void {
    const r = this.receipt();
    if (r) {
      this.form.setValue({
        clientId: r.clientId,
        receiptDate: r.receiptDate,
        mode: r.mode,
        amount: r.amount,
        reference: r.reference ?? '',
      });
    } else {
      this.form.patchValue({ clientId: this.clientId(), amount: this.amount() });
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
    const input: ReceiptInput = {
      clientId: Number(v.clientId),
      receiptDate: v.receiptDate,
      mode: v.mode,
      amount: Number(v.amount),
      reference: v.reference.trim() || null,
    };
    const existing = this.receipt();
    this.submitting.set(true);
    this.error.set(null);
    (existing ? this.receipts.update(existing.id, input) : this.receipts.create(input)).subscribe({
      next: (receipt) => {
        this.toast.success(existing ? 'Receipt updated' : 'Receipt saved');
        this.saved.emit(receipt);
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
