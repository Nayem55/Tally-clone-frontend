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

export default function AuditLogPage() {
  const { companyId, selectedCompany } = useActiveCompany();
  const [rows, setRows] = useState([]);
  const [actorOptions, setActorOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
