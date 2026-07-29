/**
 * Save-as-PDF for the evidence document.
 *
 * Deliberately no PDF library. The obvious choices (jsPDF + html2canvas) rasterise the page:
 * the result is an image in a PDF wrapper — unsearchable, unselectable, and dependent on
 * html2canvas re-implementing the layout correctly, with Korean glyph coverage as its own
 * hazard. This document goes to a labour office or a court, where the text needs to be
 * copy-pastable and the Korean has to be right.
 *
 * The browser's own print engine already produces exactly that: vector text, real fonts, proper
 * hangul shaping, selectable content, at a fraction of the bundle. "Save as PDF" is a
 * destination inside the print dialog on every platform IMGEUM targets, so the work is not
 * generating a PDF — it is making the printed output a real paged document (`@page` A4, no
 * split rows, colour preserved) and giving the saved file a name a case officer can file.
 *
 * That name is the reason this helper exists at all: every browser derives the default PDF
 * filename from `document.title`, so the title is swapped for the duration of the dialog.
 */

/** Strip what filesystems and browsers refuse in a filename, keeping hangul intact. */
function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

/**
 * Open the print dialog with `filename` as the suggested PDF name.
 *
 * The title is restored on `afterprint`, plus on a timer: `afterprint` is reliable in Chromium
 * and Safari but not universal, and a tab left permanently renamed after a cancelled dialog is
 * a worse failure than a title that reverts a minute late.
 */
export function printDocument(filename: string): void {
  const previous = document.title;
  let restored = false;

  const restore = () => {
    if (restored) return;
    restored = true;
    document.title = previous;
    window.removeEventListener('afterprint', restore);
  };

  document.title = sanitize(filename);
  window.addEventListener('afterprint', restore);
  window.setTimeout(restore, 60_000);

  window.print();
}

/**
 * `YYYY-MM-DD` in the viewer's own timezone.
 *
 * Not `toISOString()`, which is UTC: a record saved late in the evening in Seoul would carry
 * the previous day's date in its filename, and the date on a filed document is not a detail.
 */
export function localDateStamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
