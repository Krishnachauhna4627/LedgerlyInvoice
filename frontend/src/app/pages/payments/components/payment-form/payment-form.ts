import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../../../core/api/api-error';
import { ClientService } from '../../../../core/data/client.service';
import { CompanyService } from '../../../../core/data/company.service';
import { BankAccount, Client, ReceiptMode, VendorPayment, VendorPaymentInput } from '../../../../core/data/models';
import { stateLabel } from '../../../../core/gst/gst-states';
import { VendorPaymentService } from '../../../../core/data/vendor-payment.service';
import { bankAccountLabel } from '../../../../core/receipts/receipt-labels';
import { todayIso } from '../../../../core/ui/dates';
import { ToastService } from '../../../../core/ui/toast.service';
import { ClientForm } from '../../../../shared/components/client-form/client-form';
import { Icon } from '../../../../shared/components/icon/icon';
import { Modal } from '../../../../shared/components/modal/modal';
import { PickerOption, SearchPicker } from '../../../../shared/components/search-picker/search-picker';

type Field = 'paymentNumber' | 'clientId' | 'paymentDate' | 'mode' | 'bankAccountId' | 'amount' | 'reference';

const MESSAGES: Record<Field, Record<string, string>> = {
  paymentNumber: { required: 'Payment No. is required.', maxlength: 'Payment No. is too long.' },
  clientId: { required: 'Choose a vendor.' },
  paymentDate: { required: 'Payment date is required.' },
  mode: { required: 'Choose cash or bank.' },
  bankAccountId: {},
  amount: { required: 'Amount is required.', min: 'Amount must be more than 0.', max: 'Amount is too large.' },
  reference: { maxlength: 'Narration is too long.' },
};

// Record / edit money paid to a vendor (payment details only). Emits the saved payment; the parent closes its modal.
@Component({
  selector: 'app-payment-form',
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, SearchPicker, ClientForm],
  templateUrl: './payment-form.html',
  styleUrl: './payment-form.scss',
})
export class PaymentForm implements OnInit {
  private readonly payments = inject(VendorPaymentService);
  private readonly toast = inject(ToastService);

  readonly payment = input<VendorPayment | null>(null);
  readonly saved = output<VendorPayment>();
  readonly cancelled = output();

  // Vendors are picked from the saved parties (the customer list), like on purchases.
  protected readonly clients = signal<Client[]>([]);
  // Vendor name on a payment whose party isn't saved (recorded before vendors were picked, or the party was deleted).
  protected readonly oldVendorName = signal<string | null>(null);
  protected readonly showClientDialog = signal(false);
  private readonly clientId = signal<number | null>(null);
  protected readonly selectedClient = computed(() => this.clients().find((c) => c.id === this.clientId()) ?? null);
  protected readonly clientOptions = computed<PickerOption[]>(() =>
    this.clients().map((c) => ({
      id: c.id,
      label: c.name,
      detail: [c.gstin ?? 'No GSTIN', stateLabel(c.stateCode)].join(' · '),
      keywords: c.gstin ?? '',
    })),
  );
  // The business's bank accounts (primary first), from Business Details.
  protected readonly bankAccounts = signal<BankAccount[]>([]);
  protected readonly bankAccountLabel = (a: BankAccount) => bankAccountLabel(a) ?? a.ifsc ?? `Account ${a.id}`;
  protected readonly form = inject(NonNullableFormBuilder).group({
    paymentNumber: ['', [Validators.required, Validators.maxLength(40)]],
    clientId: [null as number | null, Validators.required],
    paymentDate: [todayIso(), Validators.required],
    mode: ['bank' as ReceiptMode, Validators.required],
    bankAccountId: [null as number | null],
    amount: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(9_999_999_999)]],
    reference: ['', Validators.maxLength(100)],
  });
  protected readonly isBank = signal(true);
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(ClientService)
      .list()
      .subscribe({
        next: (clients) => {
          this.clients.set(clients);
          // Editing a payment whose party isn't saved: ask for the vendor again.
          const p = this.payment();
          if (p && !clients.some((c) => c.id === p.clientId)) {
            this.oldVendorName.set(p.vendorName);
            this.form.controls.clientId.setValue(null);
          }
        },
      });
    this.form.controls.clientId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.clientId.set(id));
    inject(CompanyService)
      .get()
      .subscribe({
        next: (company) => {
          this.bankAccounts.set(company.bankAccounts);
          // A new bank payment comes from the primary account unless the user picks another.
          const control = this.form.controls.bankAccountId;
          if (!this.payment() && control.value === null && !control.dirty) control.setValue(company.bankAccounts[0]?.id ?? null);
        },
      });
    this.form.controls.mode.valueChanges.pipe(takeUntilDestroyed()).subscribe((mode) => this.isBank.set(mode === 'bank'));
  }

  ngOnInit(): void {
    const p = this.payment();
    if (p) {
      this.form.setValue({
        paymentNumber: p.paymentNumber,
        clientId: p.clientId,
        paymentDate: p.paymentDate,
        mode: p.mode,
        bankAccountId: p.bankAccountId,
        amount: p.amount,
        reference: p.reference ?? '',
      });
    } else {
      // Suggest the next number; the user can still change it.
      this.payments.nextNumber().subscribe({
        next: ({ paymentNumber }) => {
          if (!this.form.controls.paymentNumber.value) this.form.controls.paymentNumber.setValue(paymentNumber);
        },
      });
    }
  }

  protected pickClient(id: number): void {
    this.oldVendorName.set(null);
    this.form.controls.clientId.setValue(id);
    this.form.controls.clientId.markAsTouched();
  }

  protected onClientCreated(client: Client): void {
    this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name)));
    this.showClientDialog.set(false);
    this.pickClient(client.id);
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
    const input: VendorPaymentInput = {
      paymentNumber: v.paymentNumber.trim(),
      clientId: v.clientId!,
      paymentDate: v.paymentDate,
      mode: v.mode,
      bankAccountId: v.mode === 'bank' && v.bankAccountId !== null ? Number(v.bankAccountId) : null,
      amount: Number(v.amount),
      reference: v.reference.trim() || null,
    };
    const existing = this.payment();
    this.submitting.set(true);
    this.error.set(null);
    (existing ? this.payments.update(existing.id, input) : this.payments.create(input)).subscribe({
      next: (payment) => {
        this.toast.success(existing ? 'Payment updated' : `Payment ${payment.paymentNumber} saved`);
        this.saved.emit(payment);
      },
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        for (const [field, msg] of Object.entries(fieldErrors)) {
          const control = this.form.get(field);
          control?.setErrors({ server: msg });
          control?.markAsTouched();
        }
        this.error.set(message);
        this.submitting.set(false);
      },
    });
  }
}
