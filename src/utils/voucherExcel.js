import * as XLSX from "xlsx";
import { formatDateForInput } from "./voucherDates";

export function normalizeExcelText(value = "") {
  return String(value ?? "").trim();
}

export function normalizeExcelNameKey(value = "") {
  return normalizeExcelText(value).toLowerCase();
}

export function normalizeImportedExcelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateForInput(value);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return formatDateForInput(
        new Date(parsed.y, (parsed.m || 1) - 1, parsed.d || 1),
      );
    }
  }
  const text = normalizeExcelText(value);
  if (!text) return formatDateForInput(new Date());
  const normalized = text.replace(/[./]/g, "-");
  const ddmmyyyy = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const directDate = new Date(text);
  if (!Number.isNaN(directDate.getTime())) {
    return formatDateForInput(directDate);
  }
  return text;
}

export function padExcelRows(rows, minRows = 8, factory = () => ["", "", "", "", ""]) {
  const nextRows = [...rows];
  while (nextRows.length < minRows) {
    nextRows.push(factory());
  }
  return nextRows;
}

export function parseWorksheetRows(workbook, preferredSheetName) {
  const sheet =
    workbook.Sheets[preferredSheetName] ||
    workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error("The workbook does not contain a readable sheet.");
  }
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: true,
  });
}

export function parseFieldValueMap(rows, ignoredKeys = []) {
  const ignore = new Set(ignoredKeys.map((key) => normalizeExcelText(key)));
  const valueMap = new Map();
  rows.forEach((row) => {
    const key = normalizeExcelText(row[0]);
    if (!key || ignore.has(key)) return;
    valueMap.set(key, row[1]);
  });
  return valueMap;
}

export function exportWorkbookToFile(workbook, filename) {
  XLSX.writeFile(workbook, filename);
}

