// Opens a PDF made in the browser in a new tab (works on phones, where printing often doesn't).
// Call it straight from a click handler: the tab is opened before the PDF is made, because
// browsers block tabs opened later. If the tab is blocked or closed, the PDF downloads instead.
// Throws (after closing the tab) if the PDF can't be made.
export async function openPdfInNewTab(make: () => Promise<Blob>, fileName: string): Promise<void> {
  const tab = window.open('', '_blank');
  tab?.document.write('<title>Preparing PDF…</title><p style="font-family:sans-serif">Preparing PDF…</p>');

  let url: string;
  try {
    url = URL.createObjectURL(await make());
  } catch (err) {
    tab?.close();
    throw err;
  }

  if (tab && !tab.closed) {
    tab.location.href = url;
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/[^\w-]+/g, '-')}.pdf`;
    link.click();
  }
  // Give the new tab time to load it before freeing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Sends a PDF made in the browser as a file attachment (WhatsApp, Gmail, etc.) using the
// device's share sheet. Nothing is uploaded to our server. Where file sharing isn't supported
// (most desktop browsers) the PDF is downloaded instead so it can be attached by hand.
// Returns 'shared', 'downloaded' or 'cancelled'. Throws if the PDF can't be made.
export async function sharePdf(make: () => Promise<Blob>, fileName: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = `${fileName.replace(/[^\w-]+/g, '-')}.pdf`;
  const file = new File([await make()], name, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // Otherwise (e.g. the click "expired" while the PDF was being made) fall back to a download.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
