export function formatDateForInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function parseFlexibleDateInput(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  const normalized = value.replace(/[./]/g, "-").replace(/\s+/g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : normalized;
  }

  const parts = normalized.split("-");
  if (parts.length !== 3) return "";

  let day;
  let month;
  let year;

  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else {
    [day, month, year] = parts;
  }

  if (!day || !month || !year) return "";
  if (year.length === 2) {
    year = `${Number(year) >= 70 ? 19 : 20}${year}`;
  }

  const iso = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return formatDateForInput(date);
}
