import { Component, input } from '@angular/core';

// Top bar of a logged-in page: title on the left, projected actions on the right.
// Usage: <app-page-header title="Invoices"><button class="btn ...">…</button></app-page-header>
@Component({
  selector: 'app-page-header',
  template: `
    <div class="bar">
      <div class="titles">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
