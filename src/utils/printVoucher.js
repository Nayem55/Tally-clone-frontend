function replaceFormControls(root) {
  root.querySelectorAll("input, textarea, select").forEach((element) => {
    const tag = element.tagName.toLowerCase();
    let value = "";

    if (tag === "select") {
      const selectedOption = element.options[element.selectedIndex];
      value = selectedOption?.text || "";
    } else if (element.type === "checkbox") {
      value = element.checked ? "Yes" : "No";
    } else {
      value = element.value || element.getAttribute("value") || "";
    }

    const replacement = document.createElement(tag === "textarea" ? "div" : "span");
    replacement.className = "print-field-value";
    replacement.textContent = value || "-";

    if (tag === "textarea") {
      replacement.style.whiteSpace = "pre-wrap";
      replacement.style.display = "block";
      replacement.style.minHeight = "48px";
    }

    element.replaceWith(replacement);
  });
}

function cleanPrintableClone(clone) {
  clone.querySelectorAll("[data-print-hide='true'], button, svg").forEach((element) => element.remove());
  replaceFormControls(clone);
}

function buildPrintableMarkup(clone, title) {
  const styles = `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #eef2f7;
      color: #0f172a;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    body { padding: 24px; }
    .print-page {
      width: 210mm;
      max-width: 100%;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #d9e2ec;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
    }
    .print-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      border-bottom: 2px solid #1d4ed8;
      background: #fff;
    }
    .print-brand {
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
    }
    .print-topbar h1 {
      margin: 6px 0 0;
      font-size: 28px;
      line-height: 1.2;
      color: #0f172a;
      font-weight: 700;
    }
    .print-actions {
      display: flex;
      gap: 10px;
    }
    .print-actions button {
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-actions button.primary {
      border-color: #1d4ed8;
      background: #1d4ed8;
      color: #fff;
    }
    .print-root {
      padding: 20px 24px 24px;
      background: #fff;
    }
    [data-print-header='true'] {
      border-bottom: 0 !important;
      background: transparent !important;
      padding: 0 0 16px !important;
    }
    [data-print-title='true'] {
      margin: 0;
      font-size: 0 !important;
      line-height: 0 !important;
    }
    [data-print-subtitle='true'] {
      margin: 0;
      color: #475569 !important;
      font-size: 13px !important;
      line-height: 1.5 !important;
    }
    [data-print-layout='true'] {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 18px;
    }
    [data-print-sidebar='true'] {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      background: transparent !important;
      border-left: 0 !important;
      padding: 0 !important;
      order: -1;
    }
    [data-print-card='true'] {
      border: 1px solid #dbe3ef !important;
      background: #f8fafc !important;
      padding: 14px 16px !important;
      box-shadow: none !important;
    }
    [data-print-card='true'] h3 {
      margin: 0 0 10px;
      color: #1e3a8a !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    [data-print-main='true'] {
      background: transparent !important;
      padding: 0 !important;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    [data-print-panel='true'] {
      border: 1px solid #dbe3ef !important;
      background: #fff !important;
      padding: 16px !important;
      box-shadow: none !important;
      break-inside: avoid;
    }
    [data-print-panel-title='true'] {
      margin: 0 0 14px;
      font-size: 15px !important;
      color: #0f172a !important;
      font-weight: 700 !important;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .print-field-value {
      display: inline-block;
      min-width: 24px;
      padding: 4px 0;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.45;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      font-size: 12.5px;
    }
    thead th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
      border-top: 1px solid #cbd5e1;
      padding: 9px 10px;
    }
    tbody td {
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 10px;
      vertical-align: top;
    }
    tfoot td {
      border-top: 1px solid #cbd5e1;
      padding: 9px 10px;
      font-weight: 700;
    }
    .print-root p,
    .print-root span,
    .print-root div,
    .print-root td,
    .print-root th,
    .print-root label {
      word-break: break-word;
    }
    @media print {
      html, body {
        background: #fff;
        padding: 0;
      }
      .print-page {
        width: auto;
        border: 0;
        box-shadow: none;
      }
      .print-actions {
        display: none !important;
      }
      .print-root {
        padding: 14mm;
      }
      [data-print-panel='true'],
      [data-print-card='true'] {
        break-inside: avoid;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
    }
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="print-page">
          <div class="print-topbar">
            <div>
              <div class="print-brand">Accounting Voucher Print</div>
              <h1>${title}</h1>
            </div>
            <div class="print-actions">
              <button onclick="window.close()">Close</button>
              <button class="primary" onclick="window.print()">Print</button>
            </div>
          </div>
          <div class="print-root">${clone.outerHTML}</div>
        </div>
      </body>
    </html>
  `;
}

async function openPrintableWindow(node, title = "Voucher Print", autoPrint = false) {
  if (!node) return false;

  const clone = node.cloneNode(true);
  cleanPrintableClone(clone);

  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(buildPrintableMarkup(clone, title));
  printWindow.document.close();

  await new Promise((resolve) => {
    const finalize = () => {
      printWindow.focus();
      if (autoPrint) {
        printWindow.print();
      }
      resolve(true);
    };

    if (printWindow.document.readyState === "complete") {
      finalize();
    } else {
      printWindow.onload = finalize;
    }
  });

  return true;
}

export async function printVoucherNode(node, title = "Voucher Print") {
  return openPrintableWindow(node, title, true);
}

export async function previewVoucherNode(node, title = "Voucher Print") {
  return openPrintableWindow(node, title, false);
}
