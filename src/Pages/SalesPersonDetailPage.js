import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, CalendarRange, Search, TrendingDown } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";

const LEVEL_CONFIG = {
  group: {
    title: "Sales Person Stock Group Analysis",
    searchLabel: "Stock Group",
    searchPlaceholder: "Search stock group...",
  },
  category: {
    title: "Sales Person Category Analysis",
    searchLabel: "Stock Category",
    searchPlaceholder: "Search stock category...",
  },
  item: {
    title: "Sales Person Item Analysis",
    searchLabel: "Stock Item",
    searchPlaceholder: "Search item...",
  },
  voucher: {
    title: "Sales Person Voucher Details",
    searchLabel: "Voucher / Customer / Item",
    searchPlaceholder: "Search voucher, customer, or item...",
  },
};

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

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultMonthStart() {
  const now = new Date();
  return formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function todayValue() {
  return formatLocalDateInput(new Date());
}

function SummaryCard({ title, value, tone = "text-slate-900", icon }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">{icon}</div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
        </div>
      </div>
    </article>
  );
}

export default function SalesPersonDetailPage({ level = "group" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const view = LEVEL_CONFIG[level] || LEVEL_CONFIG.group;
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || defaultMonthStart());
  const [toDate, setToDate] = useState(searchParams.get("to") || todayValue());
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [report, setReport] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(false);
  const requestedCompanyId = searchParams.get("companyId") || "";
  const salesPersonId = searchParams.get("salesPersonId") || "";
  const salesPersonName = searchParams.get("salesPersonName") || "";
  const groupId = searchParams.get("groupId") || "";
  const groupName = searchParams.get("groupName") || "";
  const category = searchParams.get("category") || "";
  const itemId = searchParams.get("itemId") || "";
  const itemName = searchParams.get("itemName") || "";

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      const list = response.data || [];
      setCompanies(list);
      if (list.length > 0) {
        setCompanyId((current) => current || requestedCompanyId || list[0]._id);
      }
    }
    loadCompanies();
  }, [requestedCompanyId]);

  useEffect(() => {
    async function loadReport() {
      if (!companyId || !salesPersonId) return;
      setLoading(true);
      try {
        const response = await api.get(`/companies/${companyId}/reports/sales-person-drill`, {
          params: {
            from: fromDate,
            to: toDate,
            salesPersonId,
            level,
            groupId,
            category,
            itemId,
          },
        });
        setReport(response.data || { rows: [], totals: {} });
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [companyId, fromDate, toDate, salesPersonId, level, groupId, category, itemId]);

  const selectedCompany = companies.find((company) => String(company._id) === String(companyId));

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return report.rows || [];
    return (report.rows || []).filter((row) =>
      Object.values(row)
        .filter((value) => typeof value === "string" || typeof value === "number")
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [report.rows, search]);

  useReportFocusRestore(containerRef, [filteredRows, companyId, fromDate, toDate, level, salesPersonId, groupId, category, itemId]);
  useReportKeyboardNav(containerRef, [filteredRows, companyId, fromDate, toDate, level, salesPersonId, groupId, category, itemId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function buildNextPath(row) {
    const shared = `companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&salesPersonId=${encodeURIComponent(salesPersonId)}&salesPersonName=${encodeURIComponent(salesPersonName)}`;

    if (level === "group") {
      return `/reports/inventory-books/sales-person-details/category?${shared}&groupId=${encodeURIComponent(row.id)}&groupName=${encodeURIComponent(row.name)}`;
    }
    if (level === "category") {
      return `/reports/inventory-books/sales-person-details/item?${shared}&groupId=${encodeURIComponent(groupId)}&groupName=${encodeURIComponent(groupName)}&category=${encodeURIComponent(row.name)}`;
    }
    if (level === "item") {
      return `/reports/inventory-books/sales-person-details/voucher?${shared}&groupId=${encodeURIComponent(groupId)}&groupName=${encodeURIComponent(groupName)}&category=${encodeURIComponent(category)}&itemId=${encodeURIComponent(row.id)}&itemName=${encodeURIComponent(row.name)}`;
    }
    if (level === "voucher") {
      return buildAlterVoucherPath(companyId, row.voucherId);
    }
    return "";
  }

  const breadcrumbText = [
    salesPersonName || "Sales Person",
    groupName || "",
    category || "",
    itemName || "",
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1550px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <BarChart3 className="h-3.5 w-3.5" />
                Sales Person Analysis
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{view.title}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Sales-only drilldown for {breadcrumbText || "the selected sales person"}. No purchase, opening, or closing stock is mixed into this view.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
                onClick={() => navigateBackFromReport(navigate, location)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  From
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  To
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Search className="h-4 w-4 text-blue-600" />
                  {view.searchLabel}
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={view.searchPlaceholder}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Sales Qty"
            value={formatQty(report.totals?.salesQty)}
            icon={<TrendingDown className="h-5 w-5" />}
            tone="text-rose-700"
          />
          <SummaryCard
            title="Sales Value"
            value={formatCurrencyAmount(report.totals?.salesValue, selectedCompany)}
            icon={<BarChart3 className="h-5 w-5" />}
            tone="text-blue-700"
          />
          <SummaryCard
            title="Invoices"
            value={formatQty(report.totals?.invoiceCount)}
            icon={<CalendarRange className="h-5 w-5" />}
          />
          <SummaryCard
            title="Customers"
            value={formatQty(report.totals?.customerCount)}
            icon={<Search className="h-5 w-5" />}
            tone="text-emerald-700"
          />
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{view.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {level === "voucher"
                ? "Voucher-wise sold items with actual selling rate and value."
                : "Click a row to drill further into the selected salesperson’s sales path."}
            </p>
          </div>

          <div className="overflow-x-auto">
            {level === "voucher" ? (
              <table className="min-w-[1180px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Voucher</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Group</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Sales Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Sale Rate</th>
                    <th className="px-4 py-3 text-right font-medium">Sales Value</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">{row.dateLabel || "-"}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.voucherName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.customerName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.itemName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.groupName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.categoryName}</td>
                      <td className="px-4 py-3 text-right text-rose-700">{formatQty(row.qty)}</td>
                      <td className="px-4 py-3 text-right">{formatRate(row.rate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrencyAmount(row.value, selectedCompany)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          data-report-nav="true"
                          data-focus-key={`spd-${level}-${row.id}`}
                          className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          onClick={() =>
                            navigate(buildNextPath(row), {
                              state: buildReportReturnState(location, `spd-${level}-${row.id}`),
                            })
                          }
                        >
                          Alter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Particulars</th>
                    <th className="px-4 py-3 text-left font-medium">Context</th>
                    <th className="px-4 py-3 text-right font-medium">Invoices</th>
                    <th className="px-4 py-3 text-right font-medium">Customers</th>
                    <th className="px-4 py-3 text-right font-medium">Sales Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Avg Sale Rate</th>
                    <th className="px-4 py-3 text-right font-medium">Sales Value</th>
                    <th className="px-4 py-3 text-right font-medium">Last Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          data-report-nav="true"
                          data-focus-key={`spd-${level}-${row.id}`}
                          className="rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          onClick={() =>
                            navigate(buildNextPath(row), {
                              state: buildReportReturnState(location, `spd-${level}-${row.id}`),
                            })
                          }
                        >
                          <p className="font-medium text-slate-900">{row.name}</p>
                          {row.secondaryLabel ? (
                            <p className="mt-0.5 text-xs text-slate-400">{row.secondaryLabel}</p>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.secondaryLabel || "-"}</td>
                      <td className="px-4 py-3 text-right">{formatQty(row.metrics?.invoiceCount)}</td>
                      <td className="px-4 py-3 text-right">{formatQty(row.metrics?.customerCount)}</td>
                      <td className="px-4 py-3 text-right text-rose-700">{formatQty(row.metrics?.salesQty)}</td>
                      <td className="px-4 py-3 text-right">{formatRate(row.metrics?.averageRate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrencyAmount(row.metrics?.salesValue, selectedCompany)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {row.metrics?.lastSaleOn
                          ? new Date(row.metrics.lastSaleOn).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">Loading sales person details...</div>
          ) : filteredRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No rows matched this salesperson detail view.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
