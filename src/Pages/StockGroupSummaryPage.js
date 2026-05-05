import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Download,
  Filter,
  Package2,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import {
  buildReportReturnState,
  navigateBackFromReport,
} from "../utils/reportNavigation";

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatRate(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function startOfMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = "01";
  return `${year}-${month}-${day}`;
}

function getId(value) {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
}

function normalizeReport(payload) {
  const source = payload?.data || payload?.report || payload || {};
  const rawRows = Array.isArray(source) ? source : source.rows || source.items || source.groups || [];

  const rows = rawRows.map((row) => {
    const id = getId(row.id || row._id);
    const parentId = getId(row.parentId || row.parent || row.groupId || row.parentGroup);

    return {
      ...row,
      id,
      parentId,
      type: row.type || (row.hasChildren || row.children?.length ? "group" : "item"),
      name: row.name || row.stockGroupName || row.itemName || row.particulars || "Unnamed",
      alias: row.alias || row.sku || "",
      groupName: row.groupName || "",
      level: Number(row.level || 0),
      hasChildren: Boolean(row.hasChildren || row.children?.length),
      metrics: {
        openingQty: row.metrics?.openingQty ?? row.openingQty,
        openingRate: row.metrics?.openingRate ?? row.openingRate,
        openingValue: row.metrics?.openingValue ?? row.openingValue,

        inwardQty: row.metrics?.inwardQty ?? row.inwardQty,
        inwardRate: row.metrics?.inwardRate ?? row.inwardRate,
        inwardValue: row.metrics?.inwardValue ?? row.inwardValue,

        outwardQty: row.metrics?.outwardQty ?? row.outwardQty,
        outwardRate: row.metrics?.outwardRate ?? row.outwardRate,
        outwardValue: row.metrics?.outwardValue ?? row.outwardValue,

        closingQty: row.metrics?.closingQty ?? row.closingQty,
        closingRate: row.metrics?.closingRate ?? row.closingRate,
        closingValue: row.metrics?.closingValue ?? row.closingValue,
      },
    };
  });

  const rowIds = new Set(rows.map((row) => String(row.id)));

  return {
    rows: rows.map((row) => ({
      ...row,
      parentId: row.parentId && rowIds.has(String(row.parentId)) ? row.parentId : "",
    })),
    totals: source.totals || payload?.totals || {},
  };
}

export default function StockGroupSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || startOfMonth());
  const [toDate, setToDate] = useState(searchParams.get("to") || new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [report, setReport] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(false);
  const requestedCompanyId = searchParams.get("companyId") || "";
  const requestedGroupId = searchParams.get("groupId") || "";

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      const list = response.data?.data || response.data || [];
      setCompanies(list);

      if (list.length > 0) {
        setCompanyId((current) => current || requestedCompanyId || list[0]._id || list[0].id);
      }
    }

    loadCompanies();
  }, [requestedCompanyId]);

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;

      setLoading(true);

      try {
        const response = await api.get(
          `/companies/${companyId}/reports/stock-group-summary`,
          {
            params: { from: fromDate, to: toDate },
          }
        );

        const normalized = normalizeReport(response.data);
        setReport(normalized);
      } catch (error) {
        console.error("Stock group summary load failed:", error);
        setReport({ rows: [], totals: {} });
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [companyId, fromDate, requestedGroupId, toDate]);

  const selectedCompany = companies.find(
    (company) => String(company._id || company.id) === String(companyId)
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = report.rows || [];
    const levelRows = rows.filter((row) =>
      requestedGroupId ? String(row.parentId || "") === String(requestedGroupId) : !row.parentId,
    );

    if (!query) return levelRows;
    return levelRows.filter((row) =>
      [row.name, row.alias, row.groupName].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(query),
      ),
    );
  }, [report.rows, requestedGroupId, search]);
  const activeGroup = useMemo(
    () => (requestedGroupId ? (report.rows || []).find((row) => String(row.id) === String(requestedGroupId)) : null),
    [report.rows, requestedGroupId],
  );
  useReportFocusRestore(containerRef, [visibleRows, companyId, fromDate, toDate, requestedGroupId]);
  useReportKeyboardNav(containerRef, [visibleRows, companyId, fromDate, toDate, requestedGroupId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  const totals = report.totals || {};

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <Boxes className="h-3.5 w-3.5" />
                Inventory Books
              </div>

              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                {activeGroup ? `${activeGroup.name} Summary` : "Stock Group Summary"}
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                {activeGroup
                  ? "Drill into the selected stock group without loading nested rows inside the same table."
                  : "Review stock groups with opening, inwards, outwards, and closing balances."}
              </p>
              {activeGroup ? (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
                  onClick={() => navigateBackFromReport(navigate, location)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>

              <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />

              <div className="flex items-end gap-3">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Filter className="h-4 w-4" />
                  More Filters
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<Package2 className="h-5 w-5" />}
            title="Total Opening Balance"
            value={formatCurrencyAmount(totals.openingValue, selectedCompany)}
            qty={`${formatQty(totals.openingQty)} pcs`}
          />

          <SummaryCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Total Inwards"
            value={formatCurrencyAmount(totals.inwardValue, selectedCompany)}
            qty={`${formatQty(totals.inwardQty)} pcs`}
          />

          <SummaryCard
            icon={<TrendingDown className="h-5 w-5" />}
            title="Total Outwards"
            value={formatCurrencyAmount(totals.outwardValue, selectedCompany)}
            qty={`${formatQty(totals.outwardQty)} pcs`}
          />

          <SummaryCard
            icon={<Boxes className="h-5 w-5" />}
            title="Total Closing Balance"
            value={formatCurrencyAmount(totals.closingValue, selectedCompany)}
            qty={`${formatQty(totals.closingQty)} pcs`}
          />
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Stock Group-wise Details
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Open a group or item on its own screen for smoother navigation and larger data.
              </p>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Search group or item..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1450px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th rowSpan="2" className="px-4 py-3 text-left font-medium">
                    Particulars
                  </th>
                  <th colSpan="3" className="px-4 py-3 text-center font-medium">
                    Opening Balance
                  </th>
                  <th colSpan="3" className="px-4 py-3 text-center font-medium">
                    Inwards
                  </th>
                  <th colSpan="3" className="px-4 py-3 text-center font-medium">
                    Outwards
                  </th>
                  <th colSpan="3" className="px-4 py-3 text-center font-medium">
                    Closing Balance
                  </th>
                </tr>

                <tr>
                  {[
                    "Quantity",
                    "Rate",
                    "Value",
                    "Quantity",
                    "Rate",
                    "Value",
                    "Quantity",
                    "Rate",
                    "Value",
                    "Quantity",
                    "Rate",
                    "Value",
                  ].map((label, index) => (
                    <th key={`${label}-${index}`} className="px-4 py-3 text-right font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row) => {
                  const isGroup = row.type === "group";
                  const metrics = row.metrics || {};

                  return (
                    <tr
                      key={`${row.type}-${row.id}`}
                      className={`border-t border-slate-100 ${
                        isGroup ? "bg-slate-50/60" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${Number(row.level || 0) * 18}px` }}
                        >
                          <span className="w-3" />

                          <div>
                            {isGroup ? (
                              <button
                                type="button"
                                data-report-nav="true"
                                data-focus-key={`sg-group-${row.id}`}
                                className="rounded px-1 text-left font-medium text-slate-900 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                                onClick={() =>
                                  navigate(
                                    `/reports/inventory-books/stock-group-summary?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&groupId=${encodeURIComponent(row.id)}`,
                                    {
                                      state: buildReportReturnState(location, `sg-group-${row.id}`),
                                    },
                                  )
                                }
                              >
                                {row.name}
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-report-nav="true"
                                data-focus-key={`sg-item-${row.id}`}
                                className="rounded px-1 text-left font-medium text-slate-700 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                                onClick={() =>
                                  navigate(
                                    `/reports/inventory-books/stock-item?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&itemId=${encodeURIComponent(row.id)}`,
                                    {
                                      state: buildReportReturnState(location, `sg-item-${row.id}`),
                                    },
                                  )
                                }
                              >
                                {row.name}
                              </button>
                            )}

                            {!isGroup && row.alias ? (
                              <p className="text-xs text-slate-400">{row.alias}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {formatQty(metrics.openingQty)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatRate(metrics.openingRate)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {formatCurrencyAmount(metrics.openingValue, selectedCompany)}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {formatQty(metrics.inwardQty)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatRate(metrics.inwardRate)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {formatCurrencyAmount(metrics.inwardValue, selectedCompany)}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-rose-700">
                        {formatQty(metrics.outwardQty)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatRate(metrics.outwardRate)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {formatCurrencyAmount(metrics.outwardValue, selectedCompany)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatQty(metrics.closingQty)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatRate(metrics.closingRate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrencyAmount(metrics.closingValue, selectedCompany)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {loading ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Loading stock group summary...
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No stock groups or items matched this view.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, value, qty }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">{icon}</div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{qty}</p>
        </div>
      </div>
    </article>
  );
}
