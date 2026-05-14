import * as XLSX from "xlsx";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import autoTable from "jspdf-autotable";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
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

function createWorkbook(title, company, fromDate, toDate, scope) {
  const workbook = XLSX.utils.book_new();
  const metaRows = [
    [title],
    [""],
    ["Company", company?.name || "-"],
    ["Period", `${formatDate(fromDate)} to ${formatDate(toDate)}`],
  ];
  if (scope) {
    metaRows.push(["Scope", scope]);
  }
  const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
  metaSheet["!cols"] = [{ wch: 18 }, { wch: 42 }];
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

function createPdf(title, company, fromDate, toDate, scope, landscape = true) {
  const doc = new jsPDF(landscape ? "l" : "p", "mm", "a4");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Company: ${company?.name || "-"}`, 14, 23);
  doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 28);
  if (scope) {
    doc.text(`Scope: ${scope}`, 14, 33);
  }
  return doc;
}

function savePdf(doc, title, company) {
  doc.save(`${buildFileBase(title, company?.name)}.pdf`);
}

function saveWorkbook(workbook, title, company) {
  XLSX.writeFile(workbook, `${buildFileBase(title, company?.name)}.xlsx`);
}

export function exportInventoryReportExcel({
  title,
  company,
  fromDate,
  toDate,
  scope = "",
  summary = [],
  columns = [],
  rows = [],
  sheetName = "Report",
}) {
  const workbook = createWorkbook(title, company, fromDate, toDate, scope);

  if (summary.length) {
    appendSheet(
      workbook,
      "Highlights",
      [
        ["Metric", "Value"],
        ...summary.map((item) => [item.label, item.value]),
      ],
      [26, 24],
    );
  }

  appendSheet(
    workbook,
    sheetName,
    [
      columns.map((column) => column.label),
      ...rows.map((row) => columns.map((column) => row[column.key] ?? "")),
    ],
    columns.map((column) => column.width || 18),
  );

  saveWorkbook(workbook, title, company);
}

export function exportInventoryReportPdf({
  title,
  company,
  fromDate,
  toDate,
  scope = "",
  summary = [],
  columns = [],
  rows = [],
  landscape = true,
}) {
  const doc = createPdf(title, company, fromDate, toDate, scope, landscape);
  let startY = scope ? 39 : 34;

  if (summary.length) {
    autoTable(doc, {
      startY,
      head: [["Metric", "Value"]],
      body: summary.map((item) => [item.label, item.value]),
      styles: { fontSize: 9, cellPadding: 2.6, lineColor: [220, 226, 235] },
      headStyles: { fillColor: [20, 99, 255], textColor: 255, fontStyle: "bold" },
      theme: "grid",
      tableWidth: 110,
    });
    startY = doc.lastAutoTable.finalY + 6;
  }

  autoTable(doc, {
    startY,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => row[column.key] ?? "")),
    styles: { fontSize: 8.4, cellPadding: 2.4, lineColor: [220, 226, 235] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    theme: "grid",
  });

  savePdf(doc, title, company);
}

export { formatMoney, formatNumber, formatDate };
