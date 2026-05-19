import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, CalendarRange, Download, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import { exportInventoryReportExcel, exportInventoryReportPdf } from "../utils/inventoryReportExport";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";

const LEVEL_CONFIG = {
  group: {
    title: "Group Analysis Details",
    searchLabel: "Group / Ledger",
    searchPlaceholder: "Search child group or ledger...",
  },
  ledger: {
    title: "Ledger Analysis Details",
    searchLabel: "Ledger",
    searchPlaceholder: "Search ledger...",
  },
  voucher: {
    title: "Ledger Voucher Details",
    searchLabel: "Voucher / Item",
    searchPlaceholder: "Search voucher, item, or date...",
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

const NET_PURCHASE_QTY = "Net Purchase / Inward Qty";
const NET_PURCHASE_RATE = "Net Purchase / Inward Rate";
const NET_PURCHASE_VALUE = "Net Purchase / Inward Value";
const NET_SALES_QTY = "Net Sales / Outward Qty";
const NET_SALES_RATE = "Net Sales / Outward Rate";
const NET_SALES_VALUE = "Net Sales / Outward Value";

export default function PartyMovementDetailPage({ level = "ledger" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const view = LEVEL_CONFIG[level] || LEVEL_CONFIG.ledger;
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || defaultMonthStart());
  const [toDate, setToDate] = useState(searchParams.get("to") || todayValue());
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [report, setReport] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(false);
  const requestedCompanyId = searchParams.get("companyId") || "";
  const groupId = searchParams.get("groupId") || "";
  const ledgerId = searchParams.get("ledgerId") || "";
  const groupName = searchParams.get("groupName") || "";
  const ledgerName = searchParams.get("ledgerName") || "";

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
      if (!companyId) return;
      setLoading(true);
      try {
        const response = await api.get(`/companies/${companyId}/reports/party-movement-detail`, {
          params: {
            from: fromDate,
            to: toDate,
            level,
            groupId,
            ledgerId,
            groupName,
            ledgerName,
          },
        });
        setReport(response.data || { rows: [], totals: {} });
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [companyId, fromDate, toDate, level, groupId, ledgerId, groupName, ledgerName]);

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
  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (sum, row) => {
          const metrics = row.metrics || row;
          sum.openingQty += Number(metrics.openingQty || 0);
          sum.openingValue += Number(metrics.openingValue || 0);
          sum.inwardQty += Number(metrics.inwardQty || 0);
          sum.inwardValue += Number(metrics.inwardValue || 0);
          sum.outwardQty += Number(metrics.outwardQty || 0);
          sum.outwardValue += Number(metrics.outwardValue || 0);
          sum.closingQty += Number(metrics.closingQty || 0);
          sum.closingValue += Number(metrics.closingValue || 0);
          return sum;
        },
        {
          openingQty: 0,
          openingValue: 0,
          inwardQty: 0,
          inwardValue: 0,
          outwardQty: 0,
          outwardValue: 0,
          closingQty: 0,
          closingValue: 0,
        },
      ),
    [filteredRows],
  );

  useReportFocusRestore(containerRef, [filteredRows, companyId, fromDate, toDate, level, groupId, ledgerId, groupName, ledgerName]);
  useReportKeyboardNav(containerRef, [filteredRows, companyId, fromDate, toDate, level, groupId, ledgerId, groupName, ledgerName], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function handleExportPdf() {
    exportInventoryReportPdf({
      title: view.title,
      company: selectedCompany,
      fromDate,
      toDate,
      scope: [groupName, ledgerName].filter(Boolean).join(" | "),
      summary: [
        { label: NET_PURCHASE_VALUE, value: formatCurrencyAmount(totals.inwardValue, selectedCompany) },
        { label: NET_SALES_VALUE, value: formatCurrencyAmount(totals.outwardValue, selectedCompany) },
        { label: "Net Movement", value: formatCurrencyAmount(Number(totals.inwardValue || 0) - Number(totals.outwardValue || 0), selectedCompany) },
      ],
      columns: [
        { key: "name", label: "Particulars", width: 28 },
        { key: "context", label: "Context", width: 22 },
        { key: "inwardQty", label: NET_PURCHASE_QTY, width: 14 },
        { key: "inwardRate", label: NET_PURCHASE_RATE, width: 16 },
        { key: "inwardValue", label: NET_PURCHASE_VALUE, width: 16 },
        { key: "outwardQty", label: NET_SALES_QTY, width: 14 },
        { key: "outwardRate", label: NET_SALES_RATE, width: 16 },
        { key: "outwardValue", label: NET_SALES_VALUE, width: 16 },
      ],
      rows: filteredRows.map((row) => ({
        name: row.name,
        context: row.secondaryLabel || groupName || "-",
        inwardQty: formatQty(row.metrics?.inwardQty),
        inwardRate: formatRate(row.metrics?.inwardRate),
        inwardValue: formatCurrencyAmount(row.metrics?.inwardValue, selectedCompany),
        outwardQty: formatQty(row.metrics?.outwardQty),
        outwardRate: formatRate(row.metrics?.outwardRate),
        outwardValue: formatCurrencyAmount(row.metrics?.outwardValue, selectedCompany),
      })),
    });
  }

  function handleExportExcel() {
    exportInventoryReportExcel({
      title: view.title,
      company: selectedCompany,
      fromDate,
      toDate,
      scope: [groupName, ledgerName].filter(Boolean).join(" | "),
      summary: [
        { label: NET_PURCHASE_VALUE, value: formatCurrencyAmount(totals.inwardValue, selectedCompany) },
        { label: NET_SALES_VALUE, value: formatCurrencyAmount(totals.outwardValue, selectedCompany) },
        { label: "Net Movement", value: formatCurrencyAmount(Number(totals.inwardValue || 0) - Number(totals.outwardValue || 0), selectedCompany) },
      ],
      columns: [
        { key: "name", label: "Particulars", width: 28 },
        { key: "context", label: "Context", width: 22 },
        { key: "inwardQty", label: NET_PURCHASE_QTY, width: 14 },
        { key: "inwardRate", label: NET_PURCHASE_RATE, width: 16 },
        { key: "inwardValue", label: NET_PURCHASE_VALUE, width: 16 },
        { key: "outwardQty", label: NET_SALES_QTY, width: 14 },
        { key: "outwardRate", label: NET_SALES_RATE, width: 16 },
        { key: "outwardValue", label: NET_SALES_VALUE, width: 16 },
      ],
      rows: filteredRows.map((row) => ({
        name: row.name,
        context: row.secondaryLabel || groupName || "-",
        inwardQty: Number(row.metrics?.inwardQty || 0),
        inwardRate: Number(row.metrics?.inwardRate || 0),
        inwardValue: Number(row.metrics?.inwardValue || 0),
        outwardQty: Number(row.metrics?.outwardQty || 0),
        outwardRate: Number(row.metrics?.outwardRate || 0),
        outwardValue: Number(row.metrics?.outwardValue || 0),
      })),
    });
  }

  function buildNextPath(row) {
    const shared = `companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
    if (level === "group") {
      if (row.rowType === "group") {
        return `/reports/inventory-books/party-details/group?${shared}&groupId=${encodeURIComponent(row.id)}&groupName=${encodeURIComponent(row.name)}`;
      }
      return `/reports/inventory-books/party-item-movement?${shared}${groupId ? `&partyGroupId=${encodeURIComponent(groupId)}&partyGroupName=${encodeURIComponent(groupName)}` : ""}&partyLedgerId=${encodeURIComponent(row.id)}&partyLedgerName=${encodeURIComponent(row.name)}`;
    }
    if (level === "ledger") {
      return `/reports/inventory-books/party-item-movement?${shared}${groupId ? `&partyGroupId=${encodeURIComponent(groupId)}&partyGroupName=${encodeURIComponent(groupName)}` : ""}&partyLedgerId=${encodeURIComponent(row.id)}&partyLedgerName=${encodeURIComponent(row.name)}`;
    }
    return "";
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <BarChart3 className="h-3.5 w-3.5" />
                {ledgerName || groupName || "Group Analysis"}
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{view.title}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Review item-wise stock movement through accounting groups and ledgers without expanding nested rows inline.
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
              <div className="xl:col-span-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1463ff] px-5 text-[14px] font-medium text-white shadow-sm"
                  onClick={handleExportPdf}
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm"
                  onClick={handleExportExcel}
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title={NET_PURCHASE_VALUE}
            value={formatCurrencyAmount(totals.inwardValue, selectedCompany)}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="text-emerald-700"
          />
          <SummaryCard
            title={NET_SALES_VALUE}
            value={formatCurrencyAmount(totals.outwardValue, selectedCompany)}
            icon={<TrendingDown className="h-5 w-5" />}
            tone="text-rose-700"
          />
          <SummaryCard
            title="Net Movement"
            value={formatCurrencyAmount(Number(totals.inwardValue || 0) - Number(totals.outwardValue || 0), selectedCompany)}
            icon={<BarChart3 className="h-5 w-5" />}
            tone="text-slate-900"
          />
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{view.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {level === "group"
                ? "Drill from accounting groups to ledgers, then open item-wise stock movement for the selected ledger."
                : "Open a ledger to review its item-wise opening, inward, outward, and closing movement."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 text-left font-medium">Particulars</th>
                  <th colSpan={3} className="px-4 py-3 text-center font-medium">Net Purchase / Inwards</th>
                  <th colSpan={3} className="px-4 py-3 text-center font-medium">Net Sales / Outwards</th>
                </tr>
                <tr>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        data-report-nav="true"
                        data-focus-key={`pmd-${level}-${row.id}`}
                        className="rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                        onClick={() =>
                          navigate(buildNextPath(row), {
                            state: buildReportReturnState(location, `pmd-${level}-${row.id}`),
                          })
                        }
                      >
                        <p className="font-medium text-slate-900">{row.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.secondaryLabel || (row.rowType === "group" ? "Child group" : "Ledger")}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatQty(row.metrics?.inwardQty)}</td>
                    <td className="px-4 py-3 text-right">{formatRate(row.metrics?.inwardRate)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.metrics?.inwardValue, selectedCompany)}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{formatQty(row.metrics?.outwardQty)}</td>
                    <td className="px-4 py-3 text-right">{formatRate(row.metrics?.outwardRate)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.metrics?.outwardValue, selectedCompany)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">Loading party movement details...</div>
          ) : filteredRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No rows matched this detail view.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
