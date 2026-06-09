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
  title = "Inventory Report",
  company,
  fromDate,
  toDate,
  scope,
  summary = [],
  columns = [],
  rows = [],
}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 12;
  const companyName = company?.name || "Company";
  const companyAddress = company?.address || company?.companyAddress || "";
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function safeText(value) {
    return value === null || value === undefined || value === "" ? "-" : String(value);
  }

  function safeFileName(value) {
    return String(value || "inventory-report")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  function getValue(row, key) {
    return row?.[key] ?? "";
  }

  const compactColumns = columns.filter((column) =>
    [
      "particulars",
      "item",
      "group",
      "name",
      "context",
      "openingQty",
      "openingValue",
      "inwardQty",
      "inwardValue",
      "outwardQty",
      "outwardValue",
      "closingQty",
      "closingValue",
    ].includes(column.key)
  );

  const finalColumns =
    columns.length > 9 && compactColumns.length > 0
      ? compactColumns
      : columns;

  const tableHead = [
    finalColumns.map((column) => {
      const labelMap = {
        particulars: "Particulars",
        item: "Item",
        group: "Group",
        name: "Particulars",
        context: "Context",
        openingQty: "Open Qty",
        openingValue: "Open Value",
        inwardQty: "In Qty",
        inwardValue: "In Value",
        outwardQty: "Out Qty",
        outwardValue: "Out Value",
        closingQty: "Close Qty",
        closingValue: "Close Value",
      };

      return labelMap[column.key] || column.label || column.key;
    }),
  ];

  const tableBody = rows.map((row) =>
    finalColumns.map((column) => safeText(getValue(row, column.key)))
  );

  const totalsRow = finalColumns.map((column, index) => {
    if (index === 0) return "TOTAL";

    const key = column.key;
    const total = rows.reduce((sum, row) => {
      const raw = String(row?.[key] || "").replace(/[^\d.-]/g, "");
      const numeric = Number(raw);
      return Number.isFinite(numeric) ? sum + numeric : sum;
    }, 0);

    if (!total) return "";
    return total.toLocaleString("en-IN", {
      minimumFractionDigits: key.toLowerCase().includes("value") ? 2 : 0,
      maximumFractionDigits: 2,
    });
  });

  function drawHeader() {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(companyName, marginX, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (companyAddress) {
      doc.text(companyAddress, marginX, 15);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("INVENTORY REPORT", pageWidth - marginX, 10, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Generated: ${generatedAt}`, pageWidth - marginX, 15, {
      align: "right",
    });
  }

  drawHeader();

  let y = 34;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, marginX, y);

  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${safeText(fromDate)} to ${safeText(toDate)}`, marginX, y);

  if (scope) {
    doc.text(`Scope: ${scope}`, pageWidth - marginX, y, { align: "right" });
  }

  y += 10;

  const cardGap = 4;
  const cardCount = Math.min(summary.length, 4);
  const cardWidth = (pageWidth - marginX * 2 - cardGap * (cardCount - 1)) / cardCount;
  const cardHeight = 18;

  summary.slice(0, 4).forEach((item, index) => {
    const x = marginX + index * (cardWidth + cardGap);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(safeText(item.label), x + 4, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(safeText(item.value), x + 4, y + 13);
  });

  y += cardHeight + 10;

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    foot: rows.length ? [totalsRow] : [],
    theme: "grid",
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.2,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 7.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: finalColumns.reduce((styles, column, index) => {
      styles[index] = {
        halign: ["particulars", "item", "group", "name", "context", "date", "voucher", "direction"].includes(column.key)
          ? "left"
          : "right",
        cellWidth: ["particulars", "item", "name"].includes(column.key)
          ? 45
          : ["group", "context", "voucher"].includes(column.key)
            ? 34
            : column.key === "date"
              ? 22
              : column.key === "direction"
                ? 22
                : "auto",
      };
      return styles;
    }, {}),
    didDrawPage(data) {
      if (data.pageNumber > 1) {
        drawHeader();
      }

      const pageNo = doc.internal.getNumberOfPages();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
      doc.text("Generated from Inventory Management System", marginX, pageHeight - 7);
      doc.text(`Page ${pageNo}`, pageWidth - marginX, pageHeight - 7, {
        align: "right",
      });
    },
  });

  doc.save(`${safeFileName(title)}-${safeFileName(fromDate)}-to-${safeFileName(toDate)}.pdf`);
}

export { formatMoney, formatNumber, formatDate };
