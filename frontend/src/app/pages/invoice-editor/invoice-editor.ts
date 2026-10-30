import { Component, computed, inject, signal } from '@angular/core';
import { Modal } from '../../shared/components/modal/modal';
import { ClientForm } from '../../shared/components/client-form/client-form';
import { ItemForm } from '../../shared/components/item-form/item-form';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, map, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { CompanyService } from '../../core/data/company.service';
import { ItemService } from '../../core/data/item.service';
import { Client, Company, Invoice, InvoiceInput, InvoiceStatus, InvoiceTemplate, Item } from '../../core/data/models';
import { amountInWords } from '../../core/gst/amount-in-words';
import { calculateInvoice } from '../../core/gst/gst';
import { GST_STATES, stateLabel } from '../../core/gst/gst-states';
import { InvoiceService } from '../../core/invoices/invoice.service';
import { addDays, todayIso } from '../../core/ui/dates';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { LineItems } from './components/line-items/line-items';
import { PickerOption, SearchPicker } from './components/search-picker/search-picker';
import { TotalsSummary } from './components/totals-summary/totals-summary';

type Mode = 'new' | 'edit' | 'duplicate';

const DUE_IN_DAYS = 30;

const positive: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  Number(c.value) > 0 ? null : { positive: true };

const dueAfterInvoice: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const invoiceDate = group.get('invoiceDate')?.value;
  const dueDate = group.get('dueDate')?.value;
  return invoiceDate && dueDate && dueDate < invoiceDate ? { dueBeforeInvoice: true } : null;
};

// Messages for client-side validator keys; server messages arrive as `server`.
const MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  maxlength: 'This is too long.',
  min: "This can't be negative.",
  max: 'This must be 100 or less.',
  positive: 'Quantity must be more than 0.',
};

const FIELD_REQUIRED: Record<string, string> = {
  clientId: 'Choose a customer.',
  invoiceNumber: 'Invoice number is required.',
  invoiceDate: 'Invoice date is required.',
  description: 'Choose a product/service for this line.',
  quantity: 'Quantity is required.',
  unitPrice: 'Rate is required.',
  gstRate: 'GST % is required.',
};

// Create, edit and duplicate an invoice (/invoices/new, /invoices/:id/edit, /invoices/new?from=:id).
@Component({
  selector: 'app-invoice-editor-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, InrPipe, PageHeader, SearchPicker, Modal, ClientForm, ItemForm, LineItems, TotalsSummary],
  templateUrl: './invoice-editor.html',
  styleUrl: './invoice-editor.scss',
})
export class InvoiceEditor {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invoices = inject(InvoiceService);
  private readonly clientService = inject(ClientService);
  private readonly toast = inject(ToastService);

  protected readonly states = GST_STATES;
  protected readonly stateLabel = stateLabel;
  protected readonly templates: { value: InvoiceTemplate; label: string }[] = [
    { value: 'classic', label: 'Classic' },
    { value: 'modern', label: 'Modern' },
    { value: 'minimal', label: 'Minimal' },
  ];

  private readonly invoiceId = Number(this.route.snapshot.paramMap.get('id')) || null;
  private readonly duplicateFrom = Number(this.route.snapshot.queryParamMap.get('from')) || null;
  // A duplicate becomes a plain new invoice once it is saved (see startNextInvoice).
  protected readonly mode = signal<Mode>(this.invoiceId ? 'edit' : this.duplicateFrom ? 'duplicate' : 'new');

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly company = signal<Company | null>(null);
  protected readonly clients = signal<Client[]>([]);
  protected readonly items = signal<Item[]>([]);
  // The invoice being edited (edit mode only).
  protected readonly existing = signal<Invoice | null>(null);
  // Client details copied on an invoice whose saved client has since been deleted.
  protected readonly orphanClient = signal<Invoice['client'] | null>(null);

  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showClientDialog = signal(false);
  // Index of the line that asked for "New product/service", or null when the dialog is closed.
  protected readonly newItemLine = signal<number | null>(null);
  // The invoice saved just before the form was cleared for the next one.
  protected readonly lastSaved = signal<Invoice | null>(null);

  protected readonly form = this.fb.group(
    {
      clientId: this.fb.control<number | null>(null, Validators.required),
      invoiceNumber: ['', [Validators.required, Validators.maxLength(40)]],
      invoiceDate: [todayIso(), Validators.required],
      dueDate: [addDays(todayIso(), DUE_IN_DAYS)],
      placeOfSupplyCode: [''],
      template: this.fb.control<InvoiceTemplate>('classic'),
      reverseCharge: [false],
      lines: this.fb.array([this.lineGroup()]),
    },
    { validators: dueAfterInvoice },
  );

  // Form value as a signal so totals and client details recompute as the user types.
  protected readonly value = signal(this.form.getRawValue());

  protected readonly selectedClient = computed(() => {
    const id = this.value().clientId;
    return this.clients().find((c) => c.id === id) ?? null;
  });

  protected readonly clientOptions = computed<PickerOption[]>(() =>
    this.clients().map((c) => ({
      id: c.id,
      label: c.name,
      detail: [c.gstin ?? 'No GSTIN', stateLabel(c.stateCode)].join(' · '),
      keywords: c.gstin ?? '',
    })),
  );

  protected readonly sellerStateCode = computed(() => this.company()?.stateCode ?? null);

  protected readonly calculation = computed(() => {
    const v = this.value();
    const placeOfSupply = v.placeOfSupplyCode || this.selectedClient()?.stateCode || null;
    return calculateInvoice(v.lines, this.sellerStateCode(), placeOfSupply, v.reverseCharge);
  });

  protected readonly words = computed(() => amountInWords(this.calculation().totals.grandTotal));

  protected readonly title = computed(() => {
    if (this.mode() === 'edit') return `Edit ${this.existing()?.invoiceNumber ?? 'invoice'}`;
    return this.mode() === 'duplicate' ? 'Duplicate invoice' : 'New invoice';
  });

  protected readonly cancelLink = this.invoiceId ? `/invoices/${this.invoiceId}` : '/invoices';

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.value.set(this.form.getRawValue()));

    // Keep the due date 30 days after the invoice date until the user picks one themselves.
    this.form.controls.invoiceDate.valueChanges.pipe(takeUntilDestroyed()).subscribe((date) => {
      const due = this.form.controls.dueDate;
      if (date && !due.dirty) due.setValue(addDays(date, DUE_IN_DAYS), { emitEvent: false });
    });

    this.load();
  }

  protected get lines(): FormArray {
    return this.form.controls.lines;
  }

  private lineGroup(line?: Partial<InvoiceInput['lines'][number]>) {
    return this.fb.group({
      itemId: this.fb.control<number | null>(line?.itemId ?? null),
      description: [line?.description ?? '', [Validators.required, Validators.maxLength(200)]],
      narration: [line?.narration ?? '', Validators.maxLength(500)],
      hsnSac: [line?.hsnSac ?? ''],
      quantity: [line?.quantity ?? 1, [Validators.required, positive]],
      unit: [line?.unit ?? ''],
      unitPrice: [line?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      gstRate: [line?.gstRate ?? 0, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
  }

  private load(): void {
    const source$: Observable<Invoice | null> = this.invoiceId
      ? this.invoices.get(this.invoiceId)
      : this.duplicateFrom
        ? this.invoices.get(this.duplicateFrom)
        : of(null);
    const number$ = this.mode() === 'edit' ? of(null) : this.invoices.nextNumber().pipe(map((r) => r.invoiceNumber));

    forkJoin({
      company: inject(CompanyService).get(),
      clients: this.clientService.list(),
      items: inject(ItemService).list(),
      source: source$,
      number: number$,
    }).subscribe({
      next: ({ company, clients, items, source, number }) => {
        this.company.set(company);
        this.clients.set(clients);
        this.items.set(items);
        if (source) this.fillFrom(source, clients);
        if (number) this.form.controls.invoiceNumber.setValue(number);
        if (this.mode() === 'edit') this.existing.set(source);
        this.value.set(this.form.getRawValue());
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  private fillFrom(invoice: Invoice, clients: Client[]): void {
    const clientExists = clients.some((c) => c.id === invoice.clientId);
    this.orphanClient.set(clientExists ? null : invoice.client);
    const isDuplicate = this.mode() === 'duplicate';
    const invoiceDate = isDuplicate ? todayIso() : invoice.invoiceDate;

    this.lines.clear();
    for (const line of invoice.lines) this.lines.push(this.lineGroup(line));

    this.form.patchValue(
      {
        clientId: clientExists ? invoice.clientId : null,
        invoiceNumber: isDuplicate ? '' : invoice.invoiceNumber,
        invoiceDate,
        dueDate: isDuplicate ? addDays(invoiceDate, DUE_IN_DAYS) : (invoice.dueDate ?? ''),
        placeOfSupplyCode: invoice.placeOfSupplyCode,
        template: invoice.template,
        reverseCharge: invoice.reverseCharge,
      },
      { emitEvent: false },
    );
    // An existing due date is the user's choice; don't auto-move it.
    if (!isDuplicate && invoice.dueDate) this.form.controls.dueDate.markAsDirty();
  }

  protected pickClient(id: number): void {
    const client = this.clients().find((c) => c.id === id);
    if (!client) return;
    this.orphanClient.set(null);
    this.form.patchValue({ clientId: client.id, placeOfSupplyCode: client.stateCode });
    this.form.controls.clientId.markAsTouched();
  }

  protected onClientCreated(client: Client): void {
    this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name)));
    this.showClientDialog.set(false);
    this.pickClient(client.id);
  }

  protected onItemCreated(item: Item): void {
    this.items.update((list) => [...list, item].sort((a, b) => a.name.localeCompare(b.name)));
    const index = this.newItemLine();
    this.newItemLine.set(null);
    if (index !== null) this.applyItem(index, item.id);
  }

  protected applyItem(index: number, itemId: number): void {
    const item = this.items().find((i) => i.id === itemId);
    const line = this.lines.at(index);
    if (!item || !line) return;
    line.patchValue({
      itemId: item.id,
      description: item.name,
      hsnSac: item.hsnSac ?? '',
      unit: item.unit ?? '',
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
    });
    line.get('description')?.markAsTouched();
  }

  protected addLine(): void {
    this.lines.push(this.lineGroup());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) this.lines.removeAt(index);
  }

  // Error text for a control path such as 'invoiceNumber' or 'lines.0.quantity'.
  protected readonly errorFor = (path: string): string | null => {
    const control = this.form.get(path);
    if (!control || !(control.touched || this.submitted())) return null;
    if (path === 'dueDate' && this.form.hasError('dueBeforeInvoice')) {
      return "Due date can't be before the invoice date.";
    }
    const errors = control.errors;
    if (!errors) return null;
    if (errors['server']) return errors['server'];
    const key = Object.keys(errors)[0];
    if (key === 'required') return FIELD_REQUIRED[path.split('.').pop() ?? ''] ?? MESSAGES['required'];
    return MESSAGES[key] ?? 'Please check this field.';
  };

  protected save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.error.set(null);
    if (this.form.invalid) {
      this.error.set('Please fix the highlighted fields.');
      return;
    }
    if (this.saving()) return;

    const existing = this.existing();
    // New invoices (and old drafts) are saved as unpaid; issued invoices keep their paid/unpaid status.
    const status: InvoiceStatus = existing && existing.status !== 'draft' ? existing.status : 'unpaid';
    const v = this.form.getRawValue();
    const input: InvoiceInput = {
      clientId: v.clientId,
      invoiceNumber: v.invoiceNumber.trim(),
      invoiceDate: v.invoiceDate,
      dueDate: v.dueDate || null,
      placeOfSupplyCode: v.placeOfSupplyCode || null,
      reverseCharge: v.reverseCharge,
      template: v.template,
      status,
      lines: v.lines.map((l) => ({
        itemId: l.itemId,
        description: l.description.trim(),
        narration: l.narration.trim() || null,
        hsnSac: l.hsnSac.trim() || null,
        quantity: Number(l.quantity),
        unit: l.unit || null,
        unitPrice: Number(l.unitPrice),
        gstRate: Number(l.gstRate),
      })),
    };

    this.saving.set(true);
    const request$ = this.invoiceId ? this.invoices.update(this.invoiceId, input) : this.invoices.create(input);
    request$.subscribe({
      next: (saved) => {
        this.toast.success(`Invoice ${saved.invoiceNumber} saved.`);
        // Edits open the saved invoice; new bills clear the form so the next one can be made straight away.
        if (this.invoiceId) {
          this.router.navigate(['/invoices', saved.id]);
        } else {
          this.lastSaved.set(saved);
          this.startNextInvoice();
        }
      },
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        for (const [path, fieldMessage] of Object.entries(fieldErrors)) {
          const control = this.form.get(path);
          if (control) {
            control.setErrors({ server: fieldMessage });
            control.markAsTouched();
          }
        }
        this.error.set(message);
        this.saving.set(false);
      },
    });
  }

  // Blank form with the next invoice number; keeps the chosen template.
  private startNextInvoice(): void {
    const template = this.form.controls.template.value;
    this.lines.clear();
    this.lines.push(this.lineGroup());
    this.form.reset({
      clientId: null,
      invoiceNumber: '',
      invoiceDate: todayIso(),
      dueDate: addDays(todayIso(), DUE_IN_DAYS),
      placeOfSupplyCode: '',
      template,
      reverseCharge: false,
    });
    this.orphanClient.set(null);
    this.submitted.set(false);
    this.saving.set(false);
    this.mode.set('new');
    if (this.duplicateFrom) this.router.navigate(['/invoices/new'], { replaceUrl: true });
    window.scrollTo({ top: 0 });

    this.invoices.nextNumber().subscribe({
      next: (r) => {
        if (!this.form.controls.invoiceNumber.dirty) this.form.controls.invoiceNumber.setValue(r.invoiceNumber);
      },
    });
  }
}
