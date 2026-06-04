import * as XLSX from "xlsx";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import autoTable from "jspdf-autotable";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function slugify(value = "") {
  return String(value || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFileBase(title, companyName) {
  return `${slugify(companyName || "company")}-${slugify(title)}`;
}

function createWorkbook(title, company, fromDate, toDate) {
  const workbook = XLSX.utils.book_new();
  const metaRows = [
    [title],
    [""],
    ["Company", company?.name || "-"],
    ["Period", `${formatDate(fromDate)} to ${formatDate(toDate)}`],
  ];
  const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
  metaSheet["!cols"] = [{ wch: 18 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(workbook, metaSheet, "Summary");
  return workbook;
}

function appendSheet(workbook, name, rows, widths = []) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (widths.length) {
    sheet["!cols"] = widths.map((wch) => ({ wch }));
  }
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function createPdf(title, company, fromDate, toDate) {
  const doc = new jsPDF("p", "mm", "a4");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Company: ${company?.name || "-"}`, 14, 25);
  doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 30);
  return doc;
}

function savePdf(doc, title, company) {
  doc.save(`${buildFileBase(title, company?.name)}.pdf`);
}

function saveWorkbook(workbook, title, company) {
  XLSX.writeFile(workbook, `${buildFileBase(title, company?.name)}.xlsx`);
}

export function exportBalanceSheetExcel({
  report,
  company,
  fromDate,
  toDate,
  detailGroup = "",
  detailSide = "",
  detailRows = [],
}) {
  const workbook = createWorkbook("Balance Sheet", company, fromDate, toDate);
  if (detailGroup) {
    appendSheet(
      workbook,
      "Ledger Details",
      [
        ["Ledger", "Opening", "Closing"],
        ...detailRows.map((row) => [
          row.ledgerName,
          Number(row.openingAmount || 0),
          Number(row.amount || 0),
        ]),
      ],
      [36, 16, 16],
    );
  } else {
    const rows = [
      ["Side", "Particulars", "Opening", "Closing"],
      ...(report.liabilities || []).map((row) => [
        "Liabilities",
        row.groupName,
        Number(row.openingAmount || 0),
        Number(row.amount || 0),
      ]),
      ...(report.assets || []).map((row) => [
        "Assets",
        row.groupName,
        Number(row.openingAmount || 0),
        Number(row.amount || 0),
      ]),
    ];
    appendSheet(workbook, "Balance Sheet", rows, [16, 34, 16, 16]);
  }
  saveWorkbook(workbook, detailGroup ? `${detailGroup} Balance Sheet` : "Balance Sheet", company);
}

export function exportBalanceSheetPdf({
  report,
  company,
  fromDate,
  toDate,
  detailGroup = "",
  detailSide = "",
  detailRows = [],
}) {
  const title = detailGroup ? `${detailGroup} Details` : "Balance Sheet";
  const doc = createPdf(title, company, fromDate, toDate);
  const body = detailGroup
    ? detailRows.map((row) => [
        row.ledgerName,
        formatMoney(row.openingAmount || 0),
        formatMoney(row.amount || 0),
      ])
    : [
        ...((report.liabilities || []).map((row) => [
          "Liabilities",
          row.groupName,
          formatMoney(row.openingAmount || 0),
          formatMoney(row.amount || 0),
        ])),
        ...((report.assets || []).map((row) => [
          "Assets",
          row.groupName,
          formatMoney(row.openingAmount || 0),
          formatMoney(row.amount || 0),
        ])),
      ];

  autoTable(doc, {
    startY: 38,
    head: [detailGroup ? ["Ledger", "Opening", "Closing"] : ["Side", "Particulars", "Opening", "Closing"]],
    body,
    styles: { fontSize: 9, cellPadding: 2.8, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [20, 99, 255], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { cellWidth: detailGroup ? 90 : 74 } },
  });
  savePdf(doc, title, company);
}

export function exportTrialBalanceExcel({
  topRows,
  company,
  fromDate,
  toDate,
}) {
  const workbook = createWorkbook("Trial Balance", company, fromDate, toDate);
  appendSheet(
    workbook,
    "Trial Balance",
    [
      ["Particulars", "Opening Balance", "Debit", "Credit", "Closing Balance"],
      ...topRows.map((row) => [
        row.name,
        Number(row.totals?.openingDebit || 0) - Number(row.totals?.openingCredit || 0),
        Number(row.totals?.debit || 0),
        Number(row.totals?.credit || 0),
        Number(row.totals?.closingDebit || 0) - Number(row.totals?.closingCredit || 0),
      ]),
    ],
    [42, 18, 18, 18, 18],
  );
  saveWorkbook(workbook, "Trial Balance", company);
}

export function exportTrialBalancePdf({
  topRows,
  company,
  fromDate,
  toDate,
}) {
  const doc = createPdf("Trial Balance", company, fromDate, toDate);
  autoTable(doc, {
    startY: 38,
    head: [["Particulars", "Opening Balance", "Debit", "Credit", "Closing Balance"]],
    body: topRows.map((row) => [
      row.name,
      formatMoney(Number(row.totals?.openingDebit || 0) - Number(row.totals?.openingCredit || 0)),
      formatMoney(row.totals?.debit || 0),
      formatMoney(row.totals?.credit || 0),
      formatMoney(Number(row.totals?.closingDebit || 0) - Number(row.totals?.closingCredit || 0)),
    ]),
    styles: { fontSize: 9, cellPadding: 2.8, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [20, 99, 255], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 72 } },
  });
  savePdf(doc, "Trial Balance", company);
}

export function exportProfitLossExcel({
  report,
  company,
  fromDate,
  toDate,
  incomeGroups,
  expenseGroups,
}) {
  const workbook = createWorkbook("Profit And Loss", company, fromDate, toDate);
  appendSheet(
    workbook,
    "Trading",
    [
      ["Particulars", "Amount"],
      ["Sales", Number(report.trading?.sales || 0)],
      ["Sales Return", -Number(report.trading?.salesReturns || 0)],
      ["Net Sale Amount", Number(report.trading?.netSales || 0)],
      ["Opening Stock", Number(report.trading?.openingStock || 0)],
      ["Purchase Accounts", Number(report.trading?.purchases || 0)],
      ["Purchase Return", -Number(report.trading?.purchaseReturns || 0)],
      ["Net Purchase Amount", Number(report.trading?.netPurchases || 0)],
      ["Closing Stock", -Number(report.trading?.closingStock || 0)],
      ["COGS", Number(report.trading?.costOfGoodsSold || 0)],
      ["Gross Profit", Number(report.trading?.grossProfit || 0)],
    ],
    [40, 18],
  );
  appendSheet(
    workbook,
    "Income Statement",
    [
      ["Type", "Group", "Ledger", "Amount"],
      ...incomeGroups.flatMap((group) =>
        group.ledgers.map((ledger) => ["Income", group.groupName, ledger.ledgerName, Number(ledger.amount || 0)]),
      ),
      ...expenseGroups.flatMap((group) =>
        group.ledgers.map((ledger) => ["Expense", group.groupName, ledger.ledgerName, Number(ledger.amount || 0)]),
      ),
      ["", "", "Net Profit / Loss", Number(report.totals?.netProfit || 0)],
    ],
    [14, 26, 34, 18],
  );
  saveWorkbook(workbook, "Profit And Loss", company);
}

export function exportProfitLossPdf({
  report,
  company,
  fromDate,
  toDate,
  incomeGroups,
  expenseGroups,
}) {
  const doc = createPdf("Profit And Loss Statement", company, fromDate, toDate);
  autoTable(doc, {
    startY: 38,
    head: [["Trading Particulars", "Amount"]],
    body: [
      ["Sales", formatMoney(report.trading?.sales || 0)],
      ["Sales Return", formatMoney(-Number(report.trading?.salesReturns || 0))],
      ["Net Sale Amount", formatMoney(report.trading?.netSales || 0)],
      ["Opening Stock", formatMoney(report.trading?.openingStock || 0)],
      ["Purchase Accounts", formatMoney(report.trading?.purchases || 0)],
      ["Purchase Return", formatMoney(-Number(report.trading?.purchaseReturns || 0))],
      ["Net Purchase Amount", formatMoney(report.trading?.netPurchases || 0)],
      ["Closing Stock", formatMoney(-Number(report.trading?.closingStock || 0))],
      ["COGS", formatMoney(report.trading?.costOfGoodsSold || 0)],
      ["Gross Profit", formatMoney(report.trading?.grossProfit || 0)],
    ],
    styles: { fontSize: 9, cellPadding: 2.8, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [20, 99, 255], textColor: 255, fontStyle: "bold" },
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Type", "Group", "Ledger", "Amount"]],
    body: [
      ...incomeGroups.flatMap((group) =>
        group.ledgers.map((ledger) => ["Income", group.groupName, ledger.ledgerName, formatMoney(ledger.amount || 0)]),
      ),
      ...expenseGroups.flatMap((group) =>
        group.ledgers.map((ledger) => ["Expense", group.groupName, ledger.ledgerName, formatMoney(ledger.amount || 0)]),
      ),
      ["", "", "Net Profit / Loss", formatMoney(report.totals?.netProfit || 0)],
    ],
    styles: { fontSize: 8.5, cellPadding: 2.6, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { cellWidth: 45 }, 2: { cellWidth: 60 } },
  });
  savePdf(doc, "Profit And Loss", company);
}

export function exportCashFlowExcel({
  report,
  company,
  fromDate,
  toDate,
}) {
  const workbook = createWorkbook("Cash Flow", company, fromDate, toDate);
  appendSheet(
    workbook,
    "Overview",
    [
      ["Metric", "Amount"],
      ["Opening Balance", Number(report.openingBalance || 0)],
      ["Inflow", Number(report.inflow || 0)],
      ["Outflow", Number(report.outflow || 0)],
      ["Net Flow", Number(report.netFlow || 0)],
      ["Closing Balance", Number(report.closingBalance || 0)],
    ],
    [24, 18],
  );
  appendSheet(
    workbook,
    "Monthly Movement",
    [
      ["Period", "Inflow", "Outflow", "Net"],
      ...(report.monthly || []).map((row) => [
        row.label,
        Number(row.inflow || 0),
        Number(row.outflow || 0),
        Number(row.net || 0),
      ]),
    ],
    [20, 18, 18, 18],
  );
  appendSheet(
    workbook,
    "Ledger Balances",
    [
      ["Ledger", "Opening", "Inflow", "Outflow", "Closing"],
      ...(report.ledgerBalances || []).map((row) => [
        row.ledgerName,
        Number(row.opening || 0),
        Number(row.inflow || 0),
        Number(row.outflow || 0),
        Number(row.closing || 0),
      ]),
    ],
    [36, 18, 18, 18, 18],
  );
  saveWorkbook(workbook, "Cash Flow", company);
}

export function exportCashFlowPdf({
  report,
  company,
  fromDate,
  toDate,
}) {
  const doc = createPdf("Cash Flow Statement", company, fromDate, toDate);
  autoTable(doc, {
    startY: 38,
    head: [["Metric", "Amount"]],
    body: [
      ["Opening Balance", formatMoney(report.openingBalance || 0)],
      ["Inflow", formatMoney(report.inflow || 0)],
      ["Outflow", formatMoney(report.outflow || 0)],
      ["Net Flow", formatMoney(report.netFlow || 0)],
      ["Closing Balance", formatMoney(report.closingBalance || 0)],
    ],
    styles: { fontSize: 9, cellPadding: 2.8, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [20, 99, 255], textColor: 255, fontStyle: "bold" },
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Period", "Inflow", "Outflow", "Net"]],
    body: (report.monthly || []).map((row) => [
      row.label,
      formatMoney(row.inflow || 0),
      formatMoney(row.outflow || 0),
      formatMoney(row.net || 0),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.6, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Ledger", "Opening", "Inflow", "Outflow", "Closing"]],
    body: (report.ledgerBalances || []).map((row) => [
      row.ledgerName,
      formatMoney(row.opening || 0),
      formatMoney(row.inflow || 0),
      formatMoney(row.outflow || 0),
      formatMoney(row.closing || 0),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.6, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 65 } },
  });
  savePdf(doc, "Cash Flow", company);
}
