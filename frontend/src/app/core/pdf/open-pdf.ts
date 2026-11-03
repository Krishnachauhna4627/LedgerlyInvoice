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
