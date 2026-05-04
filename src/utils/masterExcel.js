import * as XLSX from "xlsx";
import {
  exportWorkbookToFile,
  normalizeExcelNameKey,
  normalizeExcelText,
  normalizeImportedExcelDate,
} from "./voucherExcel";

export function readWorkbookFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: "array" });
        resolve(workbook);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function worksheetToObjects(workbook, preferredSheetName) {
  const sheet =
    workbook.Sheets[preferredSheetName] ||
    workbook.Sheets[workbook.SheetNames.find((name) => name !== "Instructions")] ||
    workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error("The workbook does not contain a readable sheet.");
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
  });
}

export function normalizeExcelBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = normalizeExcelText(value).toLowerCase();
  if (!text) return fallback;
  return ["yes", "true", "1", "y"].includes(text);
}

export function normalizeExcelNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = normalizeExcelText(value).replace(/,/g, "");
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildNameMap(rows = [], selectors = []) {
  const map = new Map();
  rows.forEach((row) => {
    selectors.forEach((selector) => {
      const value = selector(row);
      const key = normalizeExcelNameKey(value);
      if (key) {
        map.set(key, row);
      }
    });
  });
  return map;
}

export function resolveNamedOption(map, rawValue, label) {
  const text = normalizeExcelText(rawValue);
  if (!text) return null;
  const row = map.get(normalizeExcelNameKey(text));
  if (!row) {
    throw new Error(`${label} "${text}" was not found.`);
  }
  return row;
}

export function exportMasterWorkbook({
  sheetName,
  filename,
  headers,
  sampleRows = [],
  instructions = [],
  referenceSheets = [],
}) {
  const workbook = XLSX.utils.book_new();
  const instructionRows = [
    ["How to use this file"],
    ...instructions.map((line) => [line]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(instructionRows),
    "Instructions",
  );

  const dataRows = sampleRows.length > 0 ? sampleRows : [Object.fromEntries(headers.map((header) => [header, ""]))];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(dataRows, { header: headers }),
    sheetName,
  );

  referenceSheets.forEach(({ name, rows }) => {
    if (!rows?.length) return;
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      name,
    );
  });

  exportWorkbookToFile(workbook, filename);
}

export function toInputDate(value) {
  return normalizeImportedExcelDate(value);
}
