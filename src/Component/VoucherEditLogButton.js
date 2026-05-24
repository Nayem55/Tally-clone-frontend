import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { FileClock, X } from "lucide-react";
import api from "../api/api";

const IGNORED_PATHS = new Set([
  "_id",
  "companyId",
  "voucherTypeId",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "deletedAt",
  "deletedBy",
  "isDeleted",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenSnapshot(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    if (value.length === 0 && prefix) {
      output[prefix] = [];
      return output;
    }
    value.forEach((entry, index) => {
      const key = prefix ? `${prefix}[${index + 1}]` : `[${index + 1}]`;
      flattenSnapshot(entry, key, output);
    });
    return output;
  }

  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      if (entry === undefined) return;
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenSnapshot(entry, nextPrefix, output);
    });
    return output;
  }

  if (prefix) {
    output[prefix] = value;
  }
  return output;
}

function formatDateTime(value) {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD-MMM-YY HH:mm") : "-";
}

function formatScalar(value, lookups, path = "") {
  if (value === null || value === undefined || value === "") return "-";

  if (path.endsWith(".ledgerId") || path.endsWith(".customerLedger") || path.endsWith(".supplierLedger")) {
    return lookups.ledgerMap.get(String(value)) || String(value);
  }
  if (path.endsWith(".itemId")) {
    return lookups.itemMap.get(String(value)) || String(value);
  }
  if (path.endsWith(".voucherTypeId")) {
    return lookups.voucherTypeMap.get(String(value)) || String(value);
  }
  if (typeof value === "number") {
    return value.toLocaleString("en-IN", {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const parsed = dayjs(text);
    if (parsed.isValid()) return parsed.format("DD-MMM-YY HH:mm");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = dayjs(text);
    if (parsed.isValid()) return parsed.format("DD-MMM-YY");
  }
  return text;
}

function getSectionTitle(path = "") {
  const lineMatch = path.match(/^lines\[(\d+)\]\.(.+)$/);
  if (lineMatch) return `Accounting Allocations - ${lineMatch[1]}`;

  const inventoryMatch = path.match(/^inventoryLines\[(\d+)\]\.(.+)$/);
  if (inventoryMatch) return `Inventory Entries - ${inventoryMatch[1]}`;

  const customerMatch = path.match(/^customerSnapshot\.(.+)$/);
  if (customerMatch) return "Customer Details";

  const commercialMatch = path.match(/^commercialMeta\.(.+)$/);
  if (commercialMatch) return "Commercial Summary";

  const posMatch = path.match(/^posMeta\.(.+)$/);
  if (posMatch) return "POS Summary";

  const salesMatch = path.match(/^salesMeta\.(.+)$/);
  if (salesMatch) return "Sales Person Details";

  return "Voucher Header";
}

function getFieldLabel(path = "") {
  const mapping = [
    [/^number$/, "Voucher No."],
    [/^voucherName$/, "Voucher Name"],
    [/^date$/, "Date"],
    [/^narration$/, "Narration"],
    [/^referenceNo$/, "Reference No."],
    [/^customerSnapshot\.name$/, "Customer Name"],
    [/^customerSnapshot\.phone$/, "Phone"],
    [/^customerSnapshot\.address$/, "Address"],
    [/^commercialMeta\.subtotal$/, "Subtotal"],
    [/^commercialMeta\.lineDiscountTotal$/, "Line Discount"],
    [/^commercialMeta\.invoiceDiscount$/, "Invoice Discount"],
    [/^commercialMeta\.additionalCharges$/, "Additional Charges"],
    [/^commercialMeta\.totalAmount$/, "Total Amount"],
    [/^salesMeta\.employeeName$/, "Sales Person"],
    [/^salesMeta\.employeeNumber$/, "Sales Person Code"],
    [/^salesMeta\.employeeId$/, "Sales Person"],
    [/^lines\[\d+\]\.ledgerId$/, "Ledger Name"],
    [/^lines\[\d+\]\.debit$/, "Debit Amount"],
    [/^lines\[\d+\]\.credit$/, "Credit Amount"],
    [/^inventoryLines\[\d+\]\.itemName$/, "Stock Item Name"],
    [/^inventoryLines\[\d+\]\.qty$/, "Actual Quantity"],
    [/^inventoryLines\[\d+\]\.billedQty$/, "Billed Quantity"],
    [/^inventoryLines\[\d+\]\.rate$/, "Rate"],
    [/^inventoryLines\[\d+\]\.amount$/, "Amount"],
    [/^inventoryLines\[\d+\]\.discount$/, "Discount"],
    [/^inventoryLines\[\d+\]\.discountValue$/, "Discount Value"],
    [/^inventoryLines\[\d+\]\.discountType$/, "Discount Type"],
    [/^inventoryLines\[\d+\]\.groupName$/, "Group Name"],
    [/^inventoryLines\[\d+\]\.stockCategoryName$/, "Category Name"],
    [/^inventoryLines\[\d+\]\.godownName$/, "Godown"],
    [/^inventoryLines\[\d+\]\.toGodownName$/, "To Godown"],
  ];

  const found = mapping.find(([pattern]) => pattern.test(path));
  if (found) return found[1];

  const cleaned = path.replace(/\[(\d+)\]/g, " $1").split(".").pop() || path;
  return cleaned
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildDiffGroups(row, lookups) {
  const beforeFlat = flattenSnapshot(row?.before || {});
  const afterFlat = flattenSnapshot(row?.after || {});
  const paths = Array.from(
    new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]),
  )
    .filter((path) => !IGNORED_PATHS.has(path))
    .sort();

  const grouped = new Map();
  paths.forEach((path) => {
    const beforeValue = beforeFlat[path];
    const afterValue = afterFlat[path];
    if (JSON.stringify(beforeValue ?? null) === JSON.stringify(afterValue ?? null)) return;

    const section = getSectionTitle(path);
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section).push({
      path,
      label: getFieldLabel(path),
      beforeValue: formatScalar(beforeValue, lookups, path),
      afterValue: formatScalar(afterValue, lookups, path),
    });
  });

  return Array.from(grouped.entries()).map(([title, entries]) => ({ title, entries }));
}

function buildHighlights(row) {
  const source = row?.after || row?.before || {};
  const candidates = [
    ["Voucher", source.voucherName],
    ["Voucher No.", source.number],
    ["Date", source.date ? formatDateTime(source.date) : ""],
    ["Narration", source.narration],
  ];
  return candidates.filter(([, value]) => value);
}

export default function VoucherEditLogButton({
  companyId,
  voucherId,
  voucherTitle = "Voucher",
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lookups, setLookups] = useState({
    ledgerMap: new Map(),
    itemMap: new Map(),
    voucherTypeMap: new Map(),
  });

  useEffect(() => {
    if (!open || !companyId || !voucherId) return;
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setErrorMessage("");
      try {
        const [auditResponse, ledgerResponse, itemResponse, voucherTypeResponse] =
          await Promise.all([
            api.get(`/companies/${companyId}/audit-logs`, {
              params: {
                entityType: "voucher",
                entityId: voucherId,
              },
            }),
            api.get(`/companies/${companyId}/ledgers/with-balances`),
            api.get(`/companies/${companyId}/items`),
            api.get(`/companies/${companyId}/voucher-types`),
          ]);

        if (cancelled) return;

        const auditRows = (auditResponse.data?.rows || [])
          .filter((row) => String(row.entityId || "") === String(voucherId))
          .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

        setRows(auditRows);
        setSelectedIndex(0);
        setLookups({
          ledgerMap: new Map(
            (ledgerResponse.data || []).map((entry) => [String(entry._id), entry.name || "-"]),
          ),
          itemMap: new Map(
            (itemResponse.data || []).map((entry) => [String(entry._id), entry.name || "-"]),
          ),
          voucherTypeMap: new Map(
            (voucherTypeResponse.data || []).map((entry) => [String(entry._id), entry.name || "-"]),
          ),
        });
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error.response?.data?.message || "Unable to load voucher edit history right now.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [open, companyId, voucherId]);

  const selectedRow = rows[selectedIndex] || null;
  const diffGroups = useMemo(
    () => (selectedRow ? buildDiffGroups(selectedRow, lookups) : []),
    [selectedRow, lookups],
  );
  const highlights = useMemo(() => buildHighlights(selectedRow), [selectedRow]);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700"
        onClick={() => setOpen(true)}
      >
        <FileClock className="h-4 w-4" />
        Edit Log
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Edit History
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {voucherTitle} Edit Log
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Review version-to-version changes for this voucher in a clearer Tally-style
                  comparison.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              {loading ? (
                <div className="py-10 text-sm text-slate-500">Loading edit history...</div>
              ) : errorMessage ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  No edit history found for this voucher yet.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {rows.map((row, index) => (
                      <button
                        key={String(row._id)}
                        type="button"
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          index === selectedIndex
                            ? "border-blue-400 bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                        onClick={() => setSelectedIndex(index)}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Version {rows.length - index}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {(row.action || "update").toUpperCase()}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.actor?.name || "System"} | {formatDateTime(row.at)}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedRow ? (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {highlights.map(([label, value]) => (
                            <div key={label}>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {label}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-900">
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-3xl border border-slate-200">
                        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50">
                          <div className="border-r border-slate-200 px-5 py-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                              Before
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              {selectedRow.actor?.name || "System"} | {formatDateTime(selectedRow.at)}
                            </div>
                          </div>
                          <div className="px-5 py-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                              After
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              {selectedRow.actor?.name || "System"} | {formatDateTime(selectedRow.at)}
                            </div>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-200 bg-white">
                          {diffGroups.map((group) => (
                            <div key={group.title}>
                              <div className="bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">
                                {group.title}
                              </div>
                              <div className="divide-y divide-slate-100">
                                {group.entries.map((entry) => (
                                  <div
                                    key={entry.path}
                                    className="grid grid-cols-[260px_1fr_1fr] items-stretch"
                                  >
                                    <div className="border-r border-slate-100 px-5 py-3">
                                      <div className="text-sm font-semibold text-slate-900">
                                        {entry.label}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400">{entry.path}</div>
                                    </div>
                                    <div className="border-r border-slate-100 bg-rose-50 px-5 py-3 text-sm text-rose-800">
                                      {entry.beforeValue}
                                    </div>
                                    <div className="bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
                                      {entry.afterValue}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
