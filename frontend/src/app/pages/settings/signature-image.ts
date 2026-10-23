// Turns an uploaded signature photo/scan into a small data URL for the invoice (fits in 600×200 px).
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
// Keep well under the server's limit (company.js MAX_SIGNATURE_LENGTH).
const MAX_LENGTH = 200_000;

export const SIGNATURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export async function signatureDataUrl(file: File): Promise<string> {
  if (!SIGNATURE_TYPES.includes(file.type)) {
    throw new Error('Upload a PNG, JPG or WebP image.');
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read. Try another file.");
  });
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // PNG keeps a transparent background; fall back to JPEG on white if a photo makes it too big.
  let url = canvas.toDataURL('image/png');
  if (url.length > MAX_LENGTH) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    url = canvas.toDataURL('image/jpeg', 0.85);
  }
  if (url.length > MAX_LENGTH) {
    throw new Error('That image is too detailed. Try a smaller or cropped scan of the signature.');
  }
  return url;
}
