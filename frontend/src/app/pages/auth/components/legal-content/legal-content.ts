import { Component, input } from '@angular/core';

export type LegalDoc = 'terms' | 'privacy';

export const LEGAL_TITLES: Record<LegalDoc, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
};

// Text of the Terms & Conditions and Privacy Policy, shown in a modal from the signup form.
@Component({
  selector: 'app-legal-content',
  templateUrl: './legal-content.html',
  styleUrl: './legal-content.scss',
})
export class LegalContent {
  readonly doc = input.required<LegalDoc>();
}
