import { useEffect, useMemo, useState } from "react";
import { Building2, Search, Shapes } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "./CompanyPicker";

function flattenVisibleRows(rows, expandedSet, query) {
  const normalized = query.trim().toLowerCase();
  const byParent = new Map();

  rows.forEach((row) => {
    const parentKey = row.parentId ? String(row.parentId) : "ROOT";
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(row);
  });

  function matches(row) {
    if (!normalized) return true;
    return [row.name, row.barcode, row.alias]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
  }

  function hasMatchBelow(rowId) {
    const children = byParent.get(String(rowId)) || [];
    return children.some((child) => matches(child) || hasMatchBelow(child.id || child._id));
  }

  function walk(parentId = "ROOT") {
    const current = byParent.get(parentId) || [];
    const output = [];
    current.forEach((row) => {
      const rowId = String(row.id || row._id);
      const visible = matches(row) || hasMatchBelow(rowId);
      if (!visible) return;
      output.push(row);
      const autoExpand = normalized ? true : expandedSet.has(rowId);
      if (autoExpand) {
        output.push(...walk(rowId));
      }
    });
    return output;
  }

  return walk("ROOT");
}

export default function ChartTreeReportPage({
  title,
  subtitle,
  endpoint,
  searchPlaceholder,
  summaryLabel,
  renderMeta,
  rowTypeLabel,
}) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || response.data[0]._id);
      }
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    async function loadRows() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/${endpoint}`);
      const normalizedRows = response.data.map((row) => ({
        ...row,
        id: row.id || row._id,
      }));
      setRows(normalizedRows);
      const rootIds = normalizedRows
        .filter((row) => Number(row.level || 0) <= 1)
        .map((row) => String(row.id));
      setExpandedRows(new Set(rootIds));
    }
    loadRows();
  }, [companyId, endpoint]);

  const selectedCompany = companies.find((company) => company._id === companyId);
  const visibleRows = useMemo(
    () => flattenVisibleRows(rows, expandedRows, search),
    [rows, expandedRows, search],
  );

  const toggleRow = (rowId) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      const key = String(rowId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalGroups = rows.filter((row) => row.type === "group").length;
  const totalLeafRows = rows.filter((row) => row.type !== "group").length;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <Shapes className="h-3.5 w-3.5" />
                Chart of Accounts
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
            </div>
            <div className="space-y-4">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Search className="h-4 w-4 text-blue-600" />
                  Search
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">{summaryLabel}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalGroups.toLocaleString("en-IN")}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">{rowTypeLabel}</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">{totalLeafRows.toLocaleString("en-IN")}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Selected Company</p>
            <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Building2 className="h-4 w-4 text-blue-600" />
              {selectedCompany?.name || "-"}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleRows.map((row) => {
              const rowId = String(row.id);
              const isGroup = row.type === "group";
              const canExpand = rows.some(
                (child) => String(child.parentId || "") === rowId,
              );
              const expanded = expandedRows.has(rowId);

              return (
                <div
                  key={`${row.type}-${rowId}`}
                  className={`flex items-center justify-between gap-4 px-6 py-3 ${
                    isGroup ? "bg-slate-50/70" : "bg-white"
                  }`}
                >
                  <div
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${Number(row.level || 0) * 20}px` }}
                  >
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={() => toggleRow(rowId)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-200"
                      >
                        <span className="sr-only">Toggle row</span>
                        {expanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <div>
                      <p className={`${isGroup ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                        {row.name}
                      </p>
                      {renderMeta ? renderMeta(row) : null}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    {isGroup ? "Group" : row.type === "item" ? "Item" : row.type || "Row"}
                  </div>
                </div>
              );
            })}

            {visibleRows.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No rows matched this view.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
