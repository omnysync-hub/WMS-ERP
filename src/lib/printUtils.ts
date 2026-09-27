/**
 * Utility for isolated, pixel-perfect document printing.
 * Prints targeted document HTML in a clean, isolated frame with active stylesheets loaded,
 * ensuring no background modals, parent drawer transforms, or app chrome leak into the printout.
 */
export function printDocument(elementOrId: HTMLElement | string, docTitle = "Document") {
  if (typeof window === "undefined") return;

  const targetEl =
    typeof elementOrId === "string"
      ? document.getElementById(elementOrId) || document.querySelector(elementOrId)
      : elementOrId;

  if (!targetEl) {
    window.print();
    return;
  }

  // Create a hidden iframe for isolated print rendering
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0; visibility: hidden; z-index: -1;"
  );
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Collect all stylesheets and style tags from current document
  const headStyles = Array.from(
    document.querySelectorAll("link[rel='stylesheet'], style")
  )
    .map((node) => node.outerHTML)
    .join("\n");

  // Clone document element to clean up any unwanted interactive controls
  const clone = targetEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((el) => el.remove());

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${docTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${headStyles}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #ffffff !important;
            color: #18181B !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
          }
          .printable-document {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          tr, td, th {
            page-break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        <div style="padding: 12px;">
          ${clone.outerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Allow styles to compute and trigger print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Print error:", err);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 300);
}
