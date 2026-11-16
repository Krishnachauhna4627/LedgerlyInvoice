import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { CompanyService } from '../../core/data/company.service';
import { ItemService } from '../../core/data/item.service';
import { Client, Item, PurchaseInput, PurchaseLine } from '../../core/data/models';
import { PurchaseService } from '../../core/data/purchase.service';
import { calculateLine, round2 } from '../../core/gst/gst';
import { stateLabel } from '../../core/gst/gst-states';
import { todayIso } from '../../core/ui/dates';
import { ToastService } from '../../core/ui/toast.service';
import { ClientForm } from '../../shared/components/client-form/client-form';
import { Icon } from '../../shared/components/icon/icon';
import { ItemForm } from '../../shared/components/item-form/item-form';
import { LineItems } from '../../shared/components/line-items/line-items';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PickerOption, SearchPicker } from '../../shared/components/search-picker/search-picker';
import { InrPipe } from '../../shared/pipes/inr.pipe';

const positive: ValidatorFn = (c: AbstractControl): ValidationErrors | null => (Number(c.value) > 0 ? null : { positive: true });

const MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  maxlength: 'This is too long.',
  min: "This can't be negative.",
  max: 'This must be 100 or less.',
  positive: 'Quantity must be more than 0.',
};

const FIELD_REQUIRED: Record<string, string> = {
  purchaseNumber: 'Purchase No. is required.',
  clientId: 'Choose a vendor.',
  purchaseDate: 'Purchase date is required.',
  description: 'Choose an item for this line.',
  quantity: 'Quantity is required.',
  unitPrice: 'Rate is required.',
  gstRate: 'GST % is required.',
};

// Record / edit a purchase bill from a vendor with the items bought (/purchases/new, /purchases/:id/edit).
// What was paid for it is recorded separately on /payments.
@Component({
  selector: 'app-purchase-editor-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, InrPipe, PageHeader, Modal, ItemForm, LineItems, SearchPicker, ClientForm],
  templateUrl: './purchase-editor.html',
  styleUrl: './purchase-editor.scss',
})
export class PurchaseEditor {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(PurchaseService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly purchaseId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || null;

  protected readonly title = this.purchaseId ? 'Edit Purchase' : 'Record Purchase';
  protected readonly items = signal<Item[]>([]);
  // Vendors are picked from the saved parties (the customer list), like the customer on an invoice.
  protected readonly clients = signal<Client[]>([]);
  private readonly companyStateCode = signal<string | null>(null);
  // Vendor name on a bill whose party isn't saved (recorded before vendors were picked, or the party was deleted).
  protected readonly oldVendorName = signal<string | null>(null);
  protected readonly showClientDialog = signal(false);
  protected readonly stateLabel = stateLabel;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  // Line index waiting for a product created in the "new product/service" modal.
  protected readonly newItemLine = signal<number | null>(null);

  protected readonly form = this.fb.group({
    purchaseNumber: ['', [Validators.required, Validators.maxLength(40)]],
    clientId: this.fb.control<number | null>(null, Validators.required),
    purchaseDate: [todayIso(), Validators.required],
    note: ['', Validators.maxLength(500)],
    lines: this.fb.array([this.lineGroup()]),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
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

  // Live preview; the server recalculates on save. IGST when the vendor is in another state than the
  // business, CGST + SGST otherwise (same rule as PurchaseModel::savePurchase()).
  protected readonly calculation = computed(() => {
    const ours = this.companyStateCode();
    const isInterState = !!ours && !!this.selectedClient() && this.selectedClient()!.stateCode !== ours;
    const lines = this.value().lines.map((l) => calculateLine(l, isInterState));
    const sum = (key: 'taxableAmount' | 'cgst' | 'sgst' | 'igst' | 'totalTax') => round2(lines.reduce((t, l) => t + l[key], 0));
    const subTotal = sum('taxableAmount');
    const totalTax = sum('totalTax');
    return {
      lines, isInterState, subTotal, totalTax,
      totalCgst: sum('cgst'), totalSgst: sum('sgst'), totalIgst: sum('igst'),
      grandTotal: round2(subTotal + totalTax),
    };
  });

  constructor() {
    forkJoin({
      items: inject(ItemService).list(),
      clients: inject(ClientService).list(),
      company: inject(CompanyService).get(),
      purchase: this.purchaseId ? this.service.get(this.purchaseId) : of(null),
      next: this.purchaseId ? of(null) : this.service.nextNumber().pipe(map((r) => r.purchaseNumber)),
    }).subscribe({
      next: ({ items, clients, company, purchase, next }) => {
        this.items.set(items);
        this.clients.set(clients);
        this.companyStateCode.set(company.stateCode || null);
        if (purchase) {
          const saved = clients.some((c) => c.id === purchase.clientId);
          this.oldVendorName.set(saved ? null : purchase.vendorName);
          this.form.patchValue({
            purchaseNumber: purchase.purchaseNumber,
            clientId: saved ? purchase.clientId : null,
            purchaseDate: purchase.purchaseDate,
            note: purchase.note ?? '',
          });
          this.lines.clear();
          for (const line of purchase.lines) this.lines.push(this.lineGroup(line));
        } else {
          this.form.patchValue({ purchaseNumber: next ?? '' });
        }
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected get lines() {
    return this.form.controls.lines;
  }

  private lineGroup(line?: Partial<PurchaseLine>) {
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

  protected pickClient(id: number): void {
    if (!this.clients().some((c) => c.id === id)) return;
    this.oldVendorName.set(null);
    this.form.patchValue({ clientId: id });
    this.form.controls.clientId.markAsTouched();
  }

  protected onClientCreated(client: Client): void {
    this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name)));
    this.showClientDialog.set(false);
    this.pickClient(client.id);
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
    line.controls.description.markAsTouched();
  }

  protected onItemCreated(item: Item): void {
    this.items.update((list) => [...list, item].sort((a, b) => a.name.localeCompare(b.name)));
    const index = this.newItemLine();
    this.newItemLine.set(null);
    if (index !== null) this.applyItem(index, item.id);
  }

  protected addLine(): void {
    this.lines.push(this.lineGroup());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) this.lines.removeAt(index);
  }

  // Error text for a control path such as 'clientId' or 'lines.0.quantity'.
  protected readonly errorFor = (path: string): string | null => {
    const control = this.form.get(path);
    if (!control?.errors || !(control.touched || this.submitted())) return null;
    const errors = control.errors;
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

    const v = this.form.getRawValue();
    const input: PurchaseInput = {
      purchaseNumber: v.purchaseNumber.trim(),
      clientId: v.clientId!,
      purchaseDate: v.purchaseDate,
      note: v.note.trim() || null,
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
    const request$ = this.purchaseId ? this.service.update(this.purchaseId, input) : this.service.create(input);
    request$.subscribe({
      next: (saved) => {
        this.toast.success(`Purchase ${saved.purchaseNumber} saved`);
        this.router.navigateByUrl('/purchases');
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
}
