import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';

describe('Landing', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the hero headline', async () => {
    const fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('GST Billing');
  });

  it('renders all six features', async () => {
    const fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('#features li').length).toBe(6);
  });
});
