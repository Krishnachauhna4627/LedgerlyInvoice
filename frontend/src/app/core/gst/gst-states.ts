// GST state codes. 25 and 28 are retired and intentionally missing. Keep in sync with backend/src/lib/gst.js.
export const GST_STATES: readonly { code: string; name: string }[] = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'],
  ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
  ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'],
  ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'],
  ['35', 'Andaman and Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
  ['97', 'Other Territory'], ['99', 'Centre Jurisdiction'],
].map(([code, name]) => ({ code, name }));

export function stateName(code: string | null | undefined): string {
  return GST_STATES.find((s) => s.code === code)?.name ?? '';
}

// "Punjab (03)" — how a state is shown on invoices.
export function stateLabel(code: string | null | undefined): string {
  return code ? `${stateName(code)} (${code})` : '';
}

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Common GST slabs, offered as suggestions on rate inputs.
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];
