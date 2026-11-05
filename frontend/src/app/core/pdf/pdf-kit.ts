import type { jsPDF as JsPdf } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';

// Shared pieces for the PDFs built in the browser (invoice, customer ledger): A4 page sizes,
// a font with the ₹ sign, theme colours and small drawing helpers.

export type Rgb = [number, number, number];
export type AutoTable = (doc: JsPdf, options: UserOptions) => void;

export const PAGE = { width: 210, height: 297 };
export const MARGIN = 12;
export const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
// Room kept at the top of continuation pages (running header) and at the bottom (page footer).
export const TOP_CONTINUED = 20;
export const BOTTOM = 18;
export const GAP = 5;
export const FONT = 'DejaVuSans';
const PT_TO_MM = 0.3528;

const MONEY = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: number) => MONEY.format(Number(n ?? 0));

// Fonts with the ₹ sign (the built-in PDF fonts don't have it). Fetched once, on the first PDF.
let fontCache: Promise<{ regular: string; bold: string }> | null = null;

// A new A4 document with the fonts loaded, plus the autoTable function.
export async function newPdf(title: string, creator: string): Promise<{ doc: JsPdf; autoTable: AutoTable }> {
  // Loaded only when a PDF is made, so they don't weigh down the normal app.
  const [{ jsPDF }, { autoTable }, fonts] = await Promise.all([import('jspdf'), import('jspdf-autotable'), loadFonts()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.addFileToVFS('DejaVuSans.ttf', fonts.regular);
  doc.addFont('DejaVuSans.ttf', FONT, 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
  doc.addFont('DejaVuSans-Bold.ttf', FONT, 'bold');
  doc.setProperties({ title, creator });
  return { doc, autoTable };
}

// Where the last autoTable ended.
export const finalY = (doc: JsPdf): number => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export const lineHeight = (sizePt: number) => sizePt * PT_TO_MM * 1.45;

function loadFonts(): Promise<{ regular: string; bold: string }> {
  fontCache ??= Promise.all([fetchBase64('angular/fonts/DejaVuSans.ttf'), fetchBase64('angular/fonts/DejaVuSans-Bold.ttf')])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((err: unknown) => {
      fontCache = null; // try again next time
      throw err;
    });
  return fontCache;
}

async function fetchBase64(path: string): Promise<string> {
  const response = await fetch(new URL(path, document.baseURI));
  if (!response.ok) throw new Error(`Could not load ${path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// Theme colours, read from the CSS variables so the PDF follows the current theme.
export function themeColors() {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): Rgb => toRgb(style.getPropertyValue(name).trim() || fallback);
  return {
    primary: read('--color-primary', '#4f46e5'),
    primaryHover: read('--color-primary-hover', '#4338ca'),
    primarySoft: read('--color-primary-soft', '#eef2ff'),
    onPrimary: read('--color-on-primary', '#ffffff'),
    surface: read('--color-surface', '#ffffff'),
    surfaceInverse: read('--color-surface-inverse', '#1e2a47'),
    bg: read('--color-bg', '#f8fafc'),
    border: read('--color-border', '#e2e8f0'),
    text: read('--color-text', '#0f172a'),
    muted: read('--color-text-muted', '#64748b'),
  };
}

// Any CSS colour → [r, g, b], using the canvas to normalise it.
function toRgb(color: string): Rgb {
  const parse = (value: string) => {
    const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
    return hex ? ([0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb) : null;
  };
  const direct = parse(color);
  if (direct) return direct;
  const ctx = document.createElement('canvas').getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    const normalised = parse(String(ctx.fillStyle));
    if (normalised) return normalised;
  }
  return [0, 0, 0];
}

export const mix = (a: Rgb, b: Rgb, amountOfA: number): Rgb =>
  a.map((v, i) => Math.round(v * amountOfA + b[i] * (1 - amountOfA))) as Rgb;

// Left-to-right gradient, drawn as thin vertical strips (jsPDF has no simple gradient fill).
export function gradientRect(doc: JsPdf, x: number, y: number, w: number, h: number, from: Rgb, to: Rgb): void {
  const steps = 60;
  const step = w / steps;
  for (let i = 0; i < steps; i++) {
    doc.setFillColor(...mix(to, from, i / (steps - 1)));
    doc.rect(x + i * step, y, step + 0.2, h, 'F');
  }
}
