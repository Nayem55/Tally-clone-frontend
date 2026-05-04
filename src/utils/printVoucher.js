function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function buildLegacyPrintableMarkup(clone, title) {
  const styles = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #eef2f7; color: #0f172a; font-family: "Segoe UI", Arial, sans-serif; }
    body { padding: 24px; }
    .print-page { width: 210mm; max-width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #d9e2ec; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12); }
    .print-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 24px; border-bottom: 2px solid #1d4ed8; background: #fff; }
    .print-brand { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .print-topbar h1 { margin: 6px 0 0; font-size: 28px; line-height: 1.2; color: #0f172a; font-weight: 700; }
    .print-actions { display: flex; gap: 10px; }
    .print-actions button { border: 1px solid #cbd5e1; background: #fff; color: #0f172a; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .print-actions button.primary { border-color: #1d4ed8; background: #1d4ed8; color: #fff; }
    .print-root { padding: 20px 24px 24px; background: #fff; }
    [data-print-header='true'] { border-bottom: 0 !important; background: transparent !important; padding: 0 0 16px !important; }
    [data-print-title='true'] { margin: 0; font-size: 0 !important; line-height: 0 !important; }
    [data-print-subtitle='true'] { margin: 0; color: #475569 !important; font-size: 13px !important; line-height: 1.5 !important; }
    [data-print-layout='true'] { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
    [data-print-sidebar='true'] { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; background: transparent !important; border-left: 0 !important; padding: 0 !important; order: -1; }
    [data-print-card='true'] { border: 1px solid #dbe3ef !important; background: #f8fafc !important; padding: 14px 16px !important; box-shadow: none !important; }
    [data-print-card='true'] h3 { margin: 0 0 10px; color: #1e3a8a !important; font-size: 14px !important; font-weight: 700 !important; text-transform: uppercase; letter-spacing: 0.04em; }
    [data-print-main='true'] { background: transparent !important; padding: 0 !important; display: flex; flex-direction: column; gap: 16px; }
    [data-print-panel='true'] { border: 1px solid #dbe3ef !important; background: #fff !important; padding: 16px !important; box-shadow: none !important; break-inside: avoid; }
    [data-print-panel-title='true'] { margin: 0 0 14px; font-size: 15px !important; color: #0f172a !important; font-weight: 700 !important; text-transform: uppercase; letter-spacing: 0.03em; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    .print-field-value { display: inline-block; min-width: 24px; padding: 4px 0; color: #0f172a; font-size: 13px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 12.5px; }
    thead th { background: #f8fafc; color: #334155; font-weight: 700; text-align: left; border-bottom: 1px solid #cbd5e1; border-top: 1px solid #cbd5e1; padding: 9px 10px; }
    tbody td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
    tfoot td { border-top: 1px solid #cbd5e1; padding: 9px 10px; font-weight: 700; }
    .print-root p, .print-root span, .print-root div, .print-root td, .print-root th, .print-root label { word-break: break-word; }
    @media print {
      html, body { background: #fff; padding: 0; }
      .print-page { width: auto; border: 0; box-shadow: none; }
      .print-actions { display: none !important; }
      .print-root { padding: 14mm; }
      [data-print-panel='true'], [data-print-card='true'] { break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="print-page">
          <div class="print-topbar">
            <div>
              <div class="print-brand">Accounting Voucher Print</div>
              <h1>${escapeHtml(title)}</h1>
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

function buildProfessionalVoucherMarkup(data) {
  const companyName = data.companyName || "Company";
  const companyMeta = (data.companyMeta || []).filter(Boolean);
  const billToLines = (data.billToLines || []).filter(Boolean);
  const infoRows = (data.infoRows || []).filter((row) => row?.label && row?.value);
  const totals = (data.totals || []).filter((row) => row?.label);
  const items = data.items || [];
  const notes = (data.notes || []).filter((row) => row?.label && row?.value);

  const tableColumns = [
    { key: "sl", label: "SL", align: "center", width: "48px" },
    { key: "item", label: "Particulars", align: "left" },
    { key: "qty", label: "Qty", align: "right", width: "80px" },
    { key: "rate", label: "Rate", align: "right", width: "110px" },
    ...(items.some((row) => row.discount)
      ? [{ key: "discount", label: "Discount", align: "right", width: "110px" }]
      : []),
    { key: "amount", label: "Amount", align: "right", width: "140px" },
  ];

  const itemRows = items
    .map((row, index) => {
      const discountColumn = tableColumns.some((column) => column.key === "discount")
        ? `<td class="ta-right">${escapeHtml(row.discount || "")}</td>`
        : "";
      return `
        <tr>
          <td class="ta-center">${index + 1}</td>
          <td>
            <div class="item-name">${escapeHtml(row.name || "-")}</div>
            ${row.subtext ? `<div class="item-subtext">${escapeHtml(row.subtext)}</div>` : ""}
          </td>
          <td class="ta-right">${escapeHtml(row.qty || "-")}</td>
          <td class="ta-right">${escapeHtml(row.rate || "-")}</td>
          ${discountColumn}
          <td class="ta-right amount">${escapeHtml(row.amount || "-")}</td>
        </tr>
      `;
    })
    .join("");

  const totalsMarkup = totals
    .map(
      (row) => `
        <div class="total-row ${row.emphasis ? "total-emphasis" : ""}">
          <span>${escapeHtml(row.label)}</span>
          <span>${escapeHtml(row.value)}</span>
        </div>
      `
    )
    .join("");

  const notesMarkup = notes.length
    ? `
      <div class="notes-grid">
        ${notes
          .map(
            (row) => `
              <div class="note-block">
                <div class="note-label">${escapeHtml(row.label)}</div>
                <div class="note-value">${escapeHtml(row.value)}</div>
              </div>
            `
          )
          .join("")}
      </div>
    `
    : "";

  const styles = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #edf1f7; color: #101828; font-family: Arial, Helvetica, sans-serif; }
    body { padding: 24px; }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      max-width: 100%;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 24px 70px rgba(16, 24, 40, 0.14);
      border: 1px solid #d0d7e2;
    }
    .sheet-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 18px 22px 0;
    }
    .sheet-actions button {
      border: 1px solid #cad3df;
      background: #fff;
      color: #172b4d;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
    }
    .sheet-actions .primary {
      background: #1f5eff;
      border-color: #1f5eff;
      color: #fff;
    }
    .sheet-body { padding: 18px 22px 28px; }
    .company-strip {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      border-bottom: 2px solid #101828;
      padding-bottom: 14px;
    }
    .company-name {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      margin: 0 0 6px;
    }
    .company-meta {
      color: #344054;
      font-size: 12px;
      line-height: 1.65;
    }
    .voucher-title-wrap {
      text-align: right;
      min-width: 180px;
    }
    .voucher-title {
      font-size: 30px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin: 0;
    }
    .voucher-subtitle {
      margin-top: 6px;
      color: #475467;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 260px;
      gap: 18px;
      margin-top: 18px;
    }
    .box {
      border: 1px solid #d6dde8;
      min-height: 132px;
    }
    .box-head {
      border-bottom: 1px solid #d6dde8;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #344054;
      text-transform: uppercase;
      background: #f8fafc;
    }
    .box-body { padding: 12px 14px; }
    .bill-to-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 7px;
      color: #101828;
    }
    .bill-to-line, .note-value {
      font-size: 13px;
      line-height: 1.65;
      color: #101828;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .info-row {
      display: grid;
      grid-template-columns: 120px 12px 1fr;
      gap: 8px;
      font-size: 13px;
      align-items: start;
    }
    .info-row .label { color: #475467; font-weight: 700; }
    .info-row .value { color: #101828; font-weight: 700; }
    .table-wrap {
      margin-top: 18px;
      border: 1px solid #101828;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead th {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #101828;
      padding: 10px 8px;
      border-right: 1px solid #101828;
      border-bottom: 1px solid #101828;
      background: #fff;
    }
    thead th:last-child, tbody td:last-child { border-right: 0; }
    tbody td {
      font-size: 13px;
      padding: 10px 8px;
      border-right: 1px solid #d0d5dd;
      border-bottom: 1px solid #d0d5dd;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: 0; }
    .ta-right { text-align: right; }
    .ta-center { text-align: center; }
    .item-name { font-weight: 700; color: #101828; }
    .item-subtext { margin-top: 4px; font-size: 11px; color: #667085; }
    .amount { font-weight: 700; }
    .totals-section {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 310px;
      gap: 18px;
      margin-top: 18px;
      align-items: start;
    }
    .notes-grid {
      display: grid;
      gap: 12px;
    }
    .note-block {
      border: 1px solid #d6dde8;
      min-height: 72px;
    }
    .note-label {
      border-bottom: 1px solid #d6dde8;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #475467;
      background: #f8fafc;
    }
    .note-value {
      padding: 10px 12px;
      white-space: pre-wrap;
    }
    .totals-card {
      border: 1px solid #101828;
      padding: 10px 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #e4e7ec;
      font-size: 13px;
      color: #101828;
    }
    .total-row:last-child { border-bottom: 0; }
    .total-row span:last-child { font-weight: 700; }
    .total-emphasis {
      font-size: 16px;
      font-weight: 700;
      padding-top: 12px;
    }
    .footer-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #101828;
      font-size: 12px;
      color: #475467;
    }
    .footer-strip strong {
      display: block;
      margin-bottom: 4px;
      color: #101828;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    @media print {
      html, body { background: #fff; padding: 0; }
      .sheet {
        width: auto;
        min-height: 0;
        box-shadow: none;
        border: 0;
      }
      .sheet-actions { display: none !important; }
      .sheet-body { padding: 10mm 12mm 12mm; }
    }
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(data.documentTitle || data.voucherTypeLabel || "Voucher Print")}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="sheet">
          <div class="sheet-actions">
            <button onclick="window.close()">Close</button>
            <button class="primary" onclick="window.print()">Print</button>
          </div>
          <div class="sheet-body">
            <div class="company-strip">
              <div>
                <h1 class="company-name">${escapeHtml(companyName)}</h1>
                <div class="company-meta">${companyMeta.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>
              </div>
              <div class="voucher-title-wrap">
                <h2 class="voucher-title">${escapeHtml(data.voucherTypeLabel || "Voucher")}</h2>
                <div class="voucher-subtitle">${escapeHtml(data.voucherSubtitle || "Voucher Print Preview")}</div>
              </div>
            </div>

            <div class="meta-grid">
              <section class="box">
                <div class="box-head">${escapeHtml(data.billToLabel || "Party Details")}</div>
                <div class="box-body">
                  <div class="bill-to-title">${escapeHtml(data.billToName || "-")}</div>
                  ${billToLines.map((line) => `<div class="bill-to-line">${escapeHtml(line)}</div>`).join("")}
                </div>
              </section>
              <section class="box">
                <div class="box-head">Voucher Information</div>
                <div class="box-body">
                  <div class="info-grid">
                    ${infoRows
                      .map(
                        (row) => `
                          <div class="info-row">
                            <span class="label">${escapeHtml(row.label)}</span>
                            <span>:</span>
                            <span class="value">${escapeHtml(row.value)}</span>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                </div>
              </section>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    ${tableColumns
                      .map(
                        (column) =>
                          `<th class="${column.align === "right" ? "ta-right" : column.align === "center" ? "ta-center" : ""}" ${
                            column.width ? `style="width:${column.width}"` : ""
                          }>${escapeHtml(column.label)}</th>`
                      )
                      .join("")}
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </div>

            <div class="totals-section">
              <div>${notesMarkup}</div>
              <div class="totals-card">${totalsMarkup}</div>
            </div>

            <div class="footer-strip">
              <div>
                <strong>Prepared From</strong>
                ${escapeHtml(data.footerLeft || "System Generated Voucher")}
              </div>
              <div>
                <strong>Report Date</strong>
                ${escapeHtml(data.footerCenter || new Date().toLocaleDateString("en-GB"))}
              </div>
              <div>
                <strong>Currency</strong>
                ${escapeHtml(data.footerRight || "-")}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function openWindowWithMarkup(markup, autoPrint = false) {
  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(markup);
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

async function openPrintableWindow(node, title = "Voucher Print", autoPrint = false) {
  if (!node) return false;
  const clone = node.cloneNode(true);
  cleanPrintableClone(clone);
  return openWindowWithMarkup(buildLegacyPrintableMarkup(clone, title), autoPrint);
}

export function buildSalesFamilyPrintData({
  company,
  voucherTypeLabel,
  voucherSubtitle,
  voucherNumber,
  voucherDate,
  partyLabel,
  partyName,
  partyMeta = [],
  accountLabel,
  accountName,
  rows = [],
  totals = [],
  narration,
  currencySymbol,
}) {
  const companyMeta = [
    company?.mailingName && company?.mailingName !== company?.name ? company.mailingName : "",
    company?.address,
    [company?.city, company?.state, company?.postalCode].filter(Boolean).join(", "),
    company?.country,
    [company?.telephone || company?.phone, company?.mobile].filter(Boolean).join(" | "),
    [company?.email, company?.website].filter(Boolean).join(" | "),
  ].filter(Boolean);

  return {
    documentTitle: `${voucherTypeLabel || "Voucher"} - ${voucherNumber || "Preview"}`,
    voucherTypeLabel: voucherTypeLabel || "Voucher",
    voucherSubtitle: voucherSubtitle || "Print Preview",
    companyName: company?.name || company?.mailingName || "Company",
    companyMeta,
    billToLabel: partyLabel || "Party Details",
    billToName: partyName || "-",
    billToLines: partyMeta,
    infoRows: [
      { label: "Voucher No", value: voucherNumber || "-" },
      { label: "Date", value: voucherDate || "-" },
      { label: accountLabel || "Ledger", value: accountName || "-" },
    ],
    items: rows.map((row) => ({
      name: row.name,
      subtext: row.subtext,
      qty: row.qty,
      rate: row.rate,
      discount: row.discount,
      amount: row.amount,
    })),
    totals,
    notes: narration ? [{ label: "Narration", value: narration }] : [],
    footerLeft: "Voucher Preview",
    footerCenter: new Date().toLocaleDateString("en-GB"),
    footerRight: currencySymbol || "-",
  };
}

export async function previewVoucherDocument(data) {
  return openWindowWithMarkup(buildProfessionalVoucherMarkup(data), false);
}

export async function printVoucherDocument(data) {
  return openWindowWithMarkup(buildProfessionalVoucherMarkup(data), true);
}

function buildPosInvoiceMarkup(data) {
  const companyName = data.companyName || "Company";
  const companyLines = (data.companyLines || []).filter(Boolean);
  const items = data.items || [];
  const payments = (data.payments || []).filter((row) => row?.label);
  const footerLines = (data.footerLines || []).filter(Boolean);

  const styles = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #eef2f7; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    body { padding: 0 24px 24px; }
    .sheet { width: 88mm; max-width: 100%; margin: 0 auto; background: #fff; border: 1px solid #d1d5db; box-shadow: 0 14px 40px rgba(15, 23, 42, 0.16); }
    .sheet-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 0 14px 0; }
    .sheet-actions button { border: 1px solid #cbd5e1; background: #fff; color: #0f172a; padding: 8px 12px; font-size: 11px; font-weight: 700; cursor: pointer; }
    .sheet-actions .primary { border-color: #2563eb; background: #2563eb; color: #fff; }
    .sheet-body { padding: 6px 14px 18px; }
    .center { text-align: center; }
    .company-name { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
    .company-line { font-size: 11px; line-height: 1.45; margin: 0; }
    .title { text-align: center; font-size: 15px; font-weight: 700; margin: 8px 0 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    .meta-line { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; line-height: 1.55; margin: 0; }
    .meta-stack { margin-bottom: 8px; }
    .buyer-line { font-size: 11px; line-height: 1.55; margin: 8px 0; border-top: 1px dashed #111827; border-bottom: 1px dashed #111827; padding: 6px 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 8px; }
    th, td { font-size: 10.5px; padding: 4px 2px; vertical-align: top; word-wrap: break-word; }
    thead th { border-bottom: 1px solid #111827; border-top: 1px solid #111827; text-align: left; font-weight: 700; }
    tbody td { border-bottom: 1px dashed #d1d5db; }
    tbody tr:last-child td { border-bottom: 0; }
    .sl { width: 18px; }
    .qty { width: 34px; text-align: right; }
    .rate { width: 52px; text-align: right; }
    .amount { width: 60px; text-align: right; }
    .desc { width: auto; }
    .summary-block { margin-top: 10px; border-top: 1px solid #111827; border-bottom: 1px solid #111827; padding: 6px 0; }
    .summary-line { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 11px; line-height: 1.55; }
    .summary-line.total { font-size: 13px; font-weight: 700; margin-top: 2px; }
    .payment-block { margin-top: 8px; font-size: 11px; }
    .payment-line { display: flex; justify-content: space-between; gap: 10px; line-height: 1.55; }
    .customer-foot { margin-top: 8px; font-size: 11px; line-height: 1.55; }
    .footer-text { margin-top: 10px; font-size: 10px; line-height: 1.5; text-align: center; }
    @media print {
      html, body { background: #fff; padding: 0; }
      .sheet { width: auto; max-width: none; border: 0; box-shadow: none; }
      .sheet-actions { display: none !important; }
      .sheet-body { padding: 8mm 6mm 10mm; }
    }
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(data.documentTitle || "POS Invoice")}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="sheet">
          <div class="sheet-actions">
            <button onclick="window.close()">Close</button>
            <button class="primary" onclick="window.print()">Print</button>
          </div>
          <div class="sheet-body">
            <div class="center">
              <div class="company-name">${escapeHtml(companyName)}</div>
              ${companyLines.map((line) => `<p class="company-line">${escapeHtml(line)}</p>`).join("")}
            </div>
            <div class="title">${escapeHtml(data.voucherTitle || "Invoice")}</div>
            <div class="meta-stack">
              <div class="meta-line"><span>Bill No. : ${escapeHtml(data.billNo || "-")}</span><span>Time : ${escapeHtml(data.timeText || "-")}</span></div>
              <div class="meta-line"><span>Date : ${escapeHtml(data.dateText || "-")}</span><span>User : ${escapeHtml(data.userName || "Admin")}</span></div>
            </div>
            <div class="buyer-line">Buyer (Bill to) : ${escapeHtml(data.buyerLine || "POS Sales")}</div>
            <table>
              <thead>
                <tr>
                  <th class="sl">Sl</th>
                  <th class="desc">Description</th>
                  <th class="qty">Qty</th>
                  <th class="rate">Rate</th>
                  <th class="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((row, index) => `
                  <tr>
                    <td class="sl">${index + 1}</td>
                    <td class="desc">${escapeHtml(row.description || "-")}</td>
                    <td class="qty">${escapeHtml(row.qty || "-")}</td>
                    <td class="rate">${escapeHtml(row.rate || "-")}</td>
                    <td class="amount">${escapeHtml(row.amount || "-")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div class="summary-block">
              ${data.discountLine ? `<div class="summary-line"><span>${escapeHtml(data.discountLine.label)}</span><span>${escapeHtml(data.discountLine.value)}</span></div>` : ""}
              ${data.redeemLine ? `<div class="summary-line"><span>${escapeHtml(data.redeemLine.label)}</span><span>${escapeHtml(data.redeemLine.value)}</span></div>` : ""}
              <div class="summary-line total">
                <span>Total Tk</span>
                <span>${escapeHtml(data.totalText || "-")}${data.totalQtyText ? ` ${escapeHtml(data.totalQtyText)}` : ""}</span>
              </div>
            </div>
            <div class="payment-block">
              ${payments.map((row) => `<div class="payment-line"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`).join("")}
            </div>
            ${data.customerLine ? `<div class="customer-foot">${escapeHtml(data.customerLine)}</div>` : ""}
            <div class="footer-text">
              ${footerLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function previewPosInvoiceDocument(data) {
  return openWindowWithMarkup(buildPosInvoiceMarkup(data), false);
}

export async function printPosInvoiceDocument(data) {
  return openWindowWithMarkup(buildPosInvoiceMarkup(data), true);
}

export async function printVoucherNode(node, title = "Voucher Print") {
  return openPrintableWindow(node, title, true);
}

export async function previewVoucherNode(node, title = "Voucher Print") {
  return openPrintableWindow(node, title, false);
}
