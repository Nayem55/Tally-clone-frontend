import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import SearchableSelect from "../Component/SearchableSelect";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";

function summarizeSnapshot(value) {
  if (!value || typeof value !== "object") return "-";
  const pairs = Object.entries(value)
    .filter(([, entry]) => entry !== null && entry !== undefined && entry !== "")
    .slice(0, 4)
    .map(([key, entry]) => `${key}: ${typeof entry === "object" ? "[...]" : String(entry)}`);
  return pairs.length ? pairs.join(" | ") : "-";
}

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
    const entries = Object.entries(value).filter(
      ([, entry]) => entry !== undefined,
    );
    if (entries.length === 0 && prefix) {
      output[prefix] = {};
      return output;
    }
    entries.forEach(([key, entry]) => {
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

function prettifyLabel(path = "") {
  return String(path || "")
    .replace(/\[(\d+)\]/g, " $1")
    .split(".")
    .map((part) =>
      part
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(" > ");
}

function formatDiffValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? `[${value.length} items]` : "[]";
  if (isPlainObject(value)) return "[Object]";

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const parsed = dayjs(text);
    if (parsed.isValid()) return parsed.format("DD-MM-YYYY HH:mm:ss");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = dayjs(text);
    if (parsed.isValid()) return parsed.format("DD-MM-YYYY");
  }
  return text;
}

function buildDiffEntries(before, after) {
  const beforeFlat = flattenSnapshot(before || {});
  const afterFlat = flattenSnapshot(after || {});
  const paths = Array.from(
    new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]),
  ).sort();

  return paths
    .map((path) => {
      const beforeValue = beforeFlat[path];
      const afterValue = afterFlat[path];
      const changed =
        JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null);
      return {
        path,
        label: prettifyLabel(path),
        beforeValue,
        afterValue,
        changed,
      };
    })
    .filter((entry) => entry.changed);
}

function extractRecordHighlights(row) {
  const source = row?.after || row?.before || {};
  const candidates = [
    ["Voucher", source.voucherName],
    ["Voucher No.", source.number],
    ["Ledger", source.ledgerName || source.customerLedgerName || source.supplierLedgerName],
    ["Group", source.groupName],
    ["Item", source.itemName],
    ["Stock Group", source.stockGroup || source.stockGroupName],
    ["Customer", source.customerName],
    ["Supplier", source.supplierName],
    ["Employee", source.employeeName],
    ["Date", source.date ? formatDiffValue(source.date) : ""],
  ];

  return candidates.filter(([, value]) => value);
}

export default function AuditLogPage() {
  const { companyId, selectedCompany } = useActiveCompany();
  const [rows, setRows] = useState([]);
  const [actorOptions, setActorOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [filters, setFilters] = useState(() => ({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
    action: "",
    entityType: "",
    actorId: "",
    search: "",
  }));

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    async function loadAuditLogs() {
      setLoading(true);
      setErrorMessage("");
      try {
        const response = await api.get(`/companies/${companyId}/audit-logs`, {
          params: {
            from: filters.from,
            to: filters.to,
            action: filters.action,
            entityType: filters.entityType,
            actorId: filters.actorId,
            search: filters.search,
          },
        });
        if (cancelled) return;
        setRows(response.data?.rows || []);
        setActorOptions(response.data?.actorOptions || []);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error.response?.data?.message || "Unable to load audit logs right now.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAuditLogs();
    return () => {
      cancelled = true;
    };
  }, [companyId, filters]);

  const actionOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).sort();
    return values.map((value) => ({ value, label: value }));
  }, [rows]);

  const entityOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.entityType).filter(Boolean))).sort();
    return values.map((value) => ({ value, label: value }));
  }, [rows]);

  const selectedDiffEntries = useMemo(
    () => buildDiffEntries(selectedRow?.before, selectedRow?.after),
    [selectedRow],
  );

  const selectedHighlights = useMemo(
    () => extractRecordHighlights(selectedRow),
    [selectedRow],
  );

  return (
    <div className="space-y-6 p-7">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Utilities
            </p>
            <h1 className="mt-2 text-4xl font-bold text-slate-900">Audit Log</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Review who changed what, when it happened, and which records were affected
              in the selected company.
            </p>
          </div>

          <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Company</span>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {selectedCompany?.name || "No company selected"}
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">From</span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={filters.from}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, from: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">To</span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={filters.to}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, to: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Action</span>
              <SearchableSelect
                options={actionOptions}
                value={filters.action}
                onChange={(value) => setFilters((current) => ({ ...current, action: value }))}
                placeholder="Filter action"
                allowClear
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Module</span>
              <SearchableSelect
                options={entityOptions}
                value={filters.entityType}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, entityType: value }))
                }
                placeholder="Filter module"
                allowClear
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">User</span>
              <SearchableSelect
                options={actorOptions}
                value={filters.actorId}
                onChange={(value) => setFilters((current) => ({ ...current, actorId: value }))}
                placeholder="Filter user"
                allowClear
              />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Search</span>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Search by user, action, or module"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Audit Entries</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Users In Result</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {new Set(rows.map((row) => row.actor?.id).filter(Boolean)).size}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Modules In Result</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {new Set(rows.map((row) => row.entityType).filter(Boolean)).size}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Actions In Result</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {new Set(rows.map((row) => row.action).filter(Boolean)).size}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-semibold text-slate-900">Audit Timeline</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest company audit entries with before/after summaries.
          </p>
        </div>

        {errorMessage ? (
          <div className="px-6 py-4 text-sm text-rose-600">{errorMessage}</div>
        ) : loading ? (
          <div className="px-6 py-8 text-sm text-slate-500">Loading audit log...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            No audit entries found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Time</th>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                  <th className="px-6 py-3 font-semibold">Module</th>
                  <th className="px-6 py-3 font-semibold">Record</th>
                  <th className="px-6 py-3 font-semibold">Before</th>
                  <th className="px-6 py-3 font-semibold">After</th>
                  <th className="px-6 py-3 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={String(row._id)}>
                    <td className="px-6 py-4 text-slate-700">
                      {row.at ? dayjs(row.at).format("DD-MM-YYYY HH:mm:ss") : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {row.actor?.name || "System"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.actor?.role || row.actor?.number || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                        {row.action || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{row.entityType || "-"}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {row.entityId ? String(row.entityId) : "-"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {summarizeSnapshot(row.before)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {summarizeSnapshot(row.after)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                        onClick={() => setSelectedRow(row)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Audit Entry
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {selectedRow.action || "Action"} - {selectedRow.entityType || "Record"}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedRow.at
                    ? dayjs(selectedRow.at).format("DD-MM-YYYY HH:mm:ss")
                    : "-"}{" "}
                  | {selectedRow.actor?.name || "System"} |{" "}
                  {selectedRow.entityId ? String(selectedRow.entityId) : "No record id"}
                </p>
                {selectedHighlights.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedHighlights.map(([label, value]) => (
                      <div
                        key={`${label}-${value}`}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                      >
                        <span className="font-semibold text-slate-900">{label}:</span>{" "}
                        {String(value)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setSelectedRow(null)}
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(90vh-104px)] overflow-auto">
              <div className="grid gap-0 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 lg:grid-cols-[minmax(260px,1.1fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
                <div className="px-6 py-4">Changed Field</div>
                <div className="px-6 py-4 text-rose-700">Before</div>
                <div className="px-6 py-4 text-emerald-700">After</div>
              </div>

              {selectedDiffEntries.length === 0 ? (
                <div className="px-6 py-8 text-sm text-slate-500">
                  No field-level difference was captured for this audit entry.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {selectedDiffEntries.map((entry) => (
                    <div
                      key={entry.path}
                      className="grid gap-0 lg:grid-cols-[minmax(260px,1.1fr)_minmax(220px,1fr)_minmax(220px,1fr)]"
                    >
                      <div className="border-b border-slate-100 bg-white px-6 py-5 lg:border-b-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {entry.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{entry.path}</div>
                      </div>

                      <div className="border-b border-slate-100 bg-rose-50/70 px-6 py-5 lg:border-b-0 lg:border-l lg:border-slate-200">
                        <div className="mb-2 inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                          Removed / Previous
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm leading-6 text-rose-900">
                          {formatDiffValue(entry.beforeValue)}
                        </div>
                      </div>

                      <div className="bg-emerald-50/70 px-6 py-5 lg:border-l lg:border-slate-200">
                        <div className="mb-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          Updated / New
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm leading-6 text-emerald-900">
                          {formatDiffValue(entry.afterValue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
