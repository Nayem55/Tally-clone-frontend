import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookText,
  Building2,
  CalendarDays,
  ChevronDown,
  Download,
  Filter,
  GitCompareArrows,
  Printer,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { formatCurrencyAmount } from "../utils/currency";
import {
  exportProfitLossExcel,
  exportProfitLossPdf,
} from "../utils/financialStatementExport";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import {
  buildReportReturnState,
  navigateBackFromReport,
} from "../utils/reportNavigation";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatSignedAmount(value, company) {
  const amount = Number(value || 0);
  const formatted = formatCurrencyAmount(Math.abs(amount), company);
  return amount < 0 ? `(${formatted})` : formatted;
}

function groupRowsByGroupName(rows) {
  const grouped = new Map();

  (rows || []).forEach((row) => {
    const key = row.groupName || "Ungrouped";
    const current = grouped.get(key) || { groupName: key, amount: 0, ledgers: [] };
    current.amount += Number(row.amount || 0);
    current.ledgers.push(row);
    grouped.set(key, current);
  });

  return [...grouped.values()].map((group) => ({
    ...group,
    ledgers: group.ledgers.sort((left, right) =>
      left.ledgerName.localeCompare(right.ledgerName)
    ),
  }));
}

function MetricCard({ icon: Icon, title, value, helper, iconClass = "", valueClass = "" }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)] sm:px-5 sm:py-5">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-50 ${iconClass} sm:h-14 sm:w-14`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-slate-600">{title}</p>
          <p className={`mt-1 text-[16px] font-semibold ${valueClass || "text-slate-900"}`}>{value}</p>
          {helper ? <p className="mt-1 text-[13px] text-slate-500">{helper}</p> : null}
        </div>
      </div>
    </article>
  );
}

function StatementPanel({ icon: Icon, title, children, totalLabel, totalValue, totalNegative }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3 text-[#1a59d1]">
          <Icon className="h-5 w-5" />
          <h2 className="text-[16px] font-semibold uppercase tracking-wide">{title}</h2>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </div>

      <div className="space-y-7 px-4 py-4 text-[14px] sm:px-6 sm:py-5">{children}</div>

      <div className={`mx-4 mb-4 rounded-xl px-4 py-4 text-[15px] font-semibold sm:px-5 ${totalNegative ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-900"}`}>
        <div className="flex items-center justify-between">
          <span>{totalLabel}</span>
          <span>{totalValue}</span>
        </div>
      </div>
    </section>
  );
}

function LedgerBlock({ heading, rows, company, negative = false, onRowClick }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-slate-900">{heading}</h3>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <button
            key={`${row.label}-${row.ledgerId || "total"}`}
            type="button"
            data-report-nav={row.ledgerId ? "true" : undefined}
            data-focus-key={row.ledgerId ? `pl-ledger-${row.ledgerId}` : undefined}
            className={`flex w-full items-center justify-between gap-4 rounded-lg text-left text-[14px] transition ${
              row.ledgerId ? "cursor-pointer px-2 py-1 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none" : ""
            }`}
            onClick={() => {
              if (row.ledgerId) onRowClick?.(row);
            }}
          >
            <span className={row.ledgerId ? "font-medium text-blue-700" : "text-slate-700"}>
              {row.label}
            </span>
            <span className={negative || Number(row.value || 0) < 0 ? "text-rose-600" : "text-slate-900"}>
              {formatSignedAmount(row.value, company)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProfitLoss() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const today = new Date();
  const monthStart = formatLocalDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = formatLocalDateInput(
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
  );

  const { companyId, selectedCompany } = useActiveCompany();
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [ledgerFilter, setLedgerFilter] = useState("");
  const [reportView, setReportView] = useState("Detailed");
  const [costCenter, setCostCenter] = useState("All");
  const [report, setReport] = useState({ incomes: [], expenses: [], totals: {}, trading: {} });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      setLoading(true);
      try {
        const response = await api.get(`/companies/${companyId}/reports/profit-loss`, {
          params: { from: fromDate, to: toDate },
        });
        setReport(response.data);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [companyId, fromDate, toDate]);

  const incomeGroups = useMemo(() => groupRowsByGroupName(report.incomes || []), [report.incomes]);
  const expenseGroups = useMemo(() => groupRowsByGroupName(report.expenses || []), [report.expenses]);

  const ledgerOptions = useMemo(() => {
    const ledgers = [...(report.incomes || []), ...(report.expenses || [])];
    return ledgers
      .map((row) => ({ value: String(row.ledgerId), label: row.ledgerName }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [report.incomes, report.expenses]);

  const filteredIncomeGroups = useMemo(() => {
    if (!ledgerFilter) return incomeGroups;
    return incomeGroups
      .map((group) => ({
        ...group,
        ledgers: group.ledgers.filter((ledger) => String(ledger.ledgerId) === ledgerFilter),
      }))
      .filter((group) => group.ledgers.length > 0);
  }, [incomeGroups, ledgerFilter]);

  const filteredExpenseGroups = useMemo(() => {
    if (!ledgerFilter) return expenseGroups;
    return expenseGroups
      .map((group) => ({
        ...group,
        ledgers: group.ledgers.filter((ledger) => String(ledger.ledgerId) === ledgerFilter),
      }))
      .filter((group) => group.ledgers.length > 0);
  }, [expenseGroups, ledgerFilter]);

  const sales = Number(report.trading?.netSales || 0);
  const grossProfit = Number(report.trading?.grossProfit || 0);
  const expenses = Number(report.totals?.netExpense || 0);
  const netProfit = Number(report.totals?.netProfit || 0);
  const netPurchases = Number(report.trading?.netPurchases || 0);
  const costOfGoodsSold = Number(report.trading?.costOfGoodsSold || 0);

  function rowsFromLedgers(ledgers = [], fallbackLabel, fallbackValue, sign = 1) {
    if (Array.isArray(ledgers) && ledgers.length > 0) {
      return ledgers.map((ledger) => ({
        label: ledger.ledgerName || fallbackLabel,
        value: Number(ledger.amount || 0) * sign,
        ledgerId: ledger.ledgerId,
        ledgerName: ledger.ledgerName || fallbackLabel,
      }));
    }
    return [{ label: fallbackLabel, value: Number(fallbackValue || 0) * sign }];
  }

  function openLedgerDetail(row) {
    if (!row?.ledgerId || !companyId) return;
    const params = new URLSearchParams({
      companyId,
      ledgerId: String(row.ledgerId),
      ledgerName: row.ledgerName || row.label || "Ledger Detail",
      from: fromDate,
      to: toDate,
    });
    navigate(`/reports/account-books/ledger-detail?${params.toString()}`, {
      state: buildReportReturnState(location, `pl-ledger-${row.ledgerId}`),
    });
  }

  useReportKeyboardNav(
    containerRef,
    [
      companyId,
      fromDate,
      toDate,
      ledgerFilter,
      reportView,
      costCenter,
      report?.totals,
      report?.trading,
    ],
    {
      onExit: () => navigateBackFromReport(navigate, location),
    },
  );

  function handleExportPdf() {
    exportProfitLossPdf({
      report,
      company: selectedCompany,
      fromDate,
      toDate,
      incomeGroups: filteredIncomeGroups,
      expenseGroups: filteredExpenseGroups,
    });
  }

  function handleExportExcel() {
    exportProfitLossExcel({
      report,
      company: selectedCompany,
      fromDate,
      toDate,
      incomeGroups: filteredIncomeGroups,
      expenseGroups: filteredExpenseGroups,
    });
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f7f9fc] px-4 py-5 text-slate-900 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1380px]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-5">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                {Array.isArray(location?.state?.reportTrail) && location.state.reportTrail.length > 0 ? (
                  <button
                    type="button"
                    data-report-nav="true"
                    data-focus-key="profit-loss-back"
                    className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                    onClick={() => navigateBackFromReport(navigate, location)}
                  >
                    Back
                  </button>
                ) : null}
                <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900">
                  Profit &amp; Loss Statement
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-slate-500">
                  <span>Period : {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}</span>
                  <span>Company : <span className="font-medium text-slate-700">{selectedCompany?.name || "-"}</span></span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm sm:min-w-[268px] sm:w-auto">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  <input
                    type="date"
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] outline-none"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] outline-none"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </div>
                <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-medium text-slate-700 shadow-sm sm:min-w-[180px] sm:w-auto">
                  {selectedCompany?.name || "No company selected"}
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm sm:w-auto"
                >
                  <GitCompareArrows className="h-4 w-4" />
                  Compare
                </button>
                <button
                  type="button"
                  data-report-nav="true"
                  data-focus-key="profit-loss-export-pdf"
                  onClick={handleExportPdf}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1463ff] px-5 text-[14px] font-medium text-white shadow-sm sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </button>
                <button
                  type="button"
                  data-report-nav="true"
                  data-focus-key="profit-loss-export-excel"
                  onClick={handleExportExcel}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
                <button
                  type="button"
                  data-report-nav="true"
                  data-focus-key="profit-loss-print"
                  onClick={() => window.print()}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm sm:w-11"
                >
                  <Printer className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={ShoppingCart}
                title="Sales"
                value={formatCurrencyAmount(sales, selectedCompany)}
                helper="Current period"
                iconClass="text-blue-600"
              />
              <MetricCard
                icon={BarChart3}
                title="Gross Profit"
                value={formatSignedAmount(grossProfit, selectedCompany)}
                helper={grossProfit >= 0 ? "Profit" : "Loss"}
                valueClass={grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
                iconClass="text-emerald-600"
              />
                <MetricCard
                icon={Wallet}
                title="Expenses"
                value={formatSignedAmount(expenses, selectedCompany)}
                helper="Expense nature ledgers"
                iconClass="text-amber-500"
              />
              <MetricCard
                icon={BookText}
                title="Net Profit / Loss"
                value={formatSignedAmount(netProfit, selectedCompany)}
                helper={`${Number(report.totals?.profitMargin || 0).toFixed(2)}% margin`}
                valueClass={netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
                iconClass="text-rose-500"
              />
            </section>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                Loading profit and loss...
              </div>
            ) : (
              <>
                <section className="grid gap-6 xl:grid-cols-2">
                  <StatementPanel
                    icon={ArrowIcon}
                    title="Trading Account"
                    totalLabel="Gross Profit"
                    totalValue={formatSignedAmount(report.trading?.grossProfit, selectedCompany)}
                    totalNegative={Number(report.trading?.grossProfit || 0) < 0}
                  >
                    <LedgerBlock
                      heading="Sales"
                      rows={[
                        ...rowsFromLedgers(
                          report.trading?.salesLedgers,
                          "Sales Account",
                          report.trading?.sales,
                        ),
                        ...rowsFromLedgers(
                          report.trading?.salesReturnLedgers,
                          "Sales Return",
                          report.trading?.salesReturns,
                          -1,
                        ),
                        { label: "Net Sale Amount", value: report.trading?.netSales },
                      ]}
                      company={selectedCompany}
                      onRowClick={openLedgerDetail}
                    />
                    <LedgerBlock
                      heading="Cost of Goods Sold"
                      rows={[
                        { label: "Opening Stock", value: report.trading?.openingStock },
                        ...rowsFromLedgers(
                          report.trading?.purchaseLedgers,
                          "Add: Purchase Accounts",
                          report.trading?.purchases,
                        ).map((row) => ({
                          ...row,
                          label: row.ledgerId ? `Add: ${row.label}` : row.label,
                        })),
                        ...rowsFromLedgers(
                          report.trading?.purchaseReturnLedgers,
                          "Less: Purchase Return",
                          report.trading?.purchaseReturns,
                          -1,
                        ).map((row) => ({
                          ...row,
                          label: row.ledgerId ? `Less: ${row.label}` : row.label,
                        })),
                        { label: "Net Purchase Amount", value: netPurchases },
                        { label: "Less: Closing Stock", value: -Number(report.trading?.closingStock || 0) },
                        { label: "COGS: ", value: costOfGoodsSold },
                      ]}
                      company={selectedCompany}
                      onRowClick={openLedgerDetail}
                    />
                  </StatementPanel>

                  <StatementPanel
                    icon={BookText}
                    title="Income Statement"
                    totalLabel="Net Profit / Loss"
                    totalValue={formatSignedAmount(report.totals?.netProfit, selectedCompany)}
                    totalNegative={Number(report.totals?.netProfit || 0) < 0}
                  >
                    <LedgerBlock
                      heading="Other Income"
                      rows={
                        filteredIncomeGroups.flatMap((group) =>
                          group.ledgers.map((ledger) => ({
                            label: ledger.ledgerName,
                            value: ledger.amount,
                          }))
                        ).length > 0
                          ? filteredIncomeGroups.flatMap((group) =>
                              group.ledgers.map((ledger) => ({
                                label: ledger.ledgerName,
                                value: ledger.amount,
                              }))
                            )
                          : [{ label: "Other Income", value: 0 }]
                      }
                      company={selectedCompany}
                    />
                    <LedgerBlock
                      heading="Expenses"
                      rows={
                        filteredExpenseGroups.flatMap((group) =>
                          group.ledgers.map((ledger) => ({
                            label: ledger.ledgerName,
                            value: ledger.amount,
                          }))
                        )
                      }
                      company={selectedCompany}
                    />
                  </StatementPanel>
                </section>

                <section className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:px-6">
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 text-center">
                    {[
                      ["Sales", formatCurrencyAmount(sales, selectedCompany)],
                      ["Gross Profit", formatSignedAmount(grossProfit, selectedCompany)],
                      ["Expenses", formatSignedAmount(expenses, selectedCompany)],
                      ["Net Profit / Loss", formatSignedAmount(netProfit, selectedCompany)],
                      ["Net Profit Margin", `${Number(report.totals?.profitMargin || 0).toFixed(2)}%`],
                    ].map(([label, value]) => (
                      <div key={label} className="border-b border-slate-200 pb-3 last:border-b-0 sm:border-b-0 md:border-r md:border-slate-200 md:pb-0 md:last:border-r-0">
                        <p className="text-[13px] text-slate-500">{label}</p>
                        <p className={`mt-2 text-[16px] font-semibold ${String(value).includes("(") ? "text-rose-600" : "text-slate-900"}`}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>

          <aside className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-6">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-slate-700" />
              <h2 className="text-[15px] font-semibold uppercase tracking-wide text-slate-700">
                Filters
              </h2>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Date Range</label>
                <div className="rounded-xl border border-slate-200 px-3 py-3 text-[13px] text-slate-700">
                  {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Company</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px] font-medium text-slate-700">
                    {selectedCompany?.name || "No company selected"}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Report View</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] outline-none"
                  value={reportView}
                  onChange={(event) => setReportView(event.target.value)}
                >
                  <option>Detailed</option>
                  <option>Summary</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Cost Center</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] outline-none"
                  value={costCenter}
                  onChange={(event) => setCostCenter(event.target.value)}
                >
                  <option>All</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Ledger Filter</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] outline-none"
                  value={ledgerFilter}
                  onChange={(event) => setLedgerFilter(event.target.value)}
                >
                  <option value="">All Ledgers</option>
                  {ledgerOptions.map((ledger) => (
                    <option key={ledger.value} value={ledger.value}>
                      {ledger.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="w-full rounded-xl bg-[#1463ff] px-4 py-3 text-[14px] font-medium text-white shadow-sm"
              >
                Apply Filter
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] font-medium text-slate-700"
                onClick={() => {
                  setLedgerFilter("");
                  setReportView("Detailed");
                  setCostCenter("All");
                  setFromDate(monthStart);
                  setToDate(monthEnd);
                }}
              >
                Clear Filter
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ArrowIcon(props) {
  return <GitCompareArrows {...props} />;
}
