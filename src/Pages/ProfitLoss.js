import { useEffect, useMemo, useState } from "react";
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
import api from "../api/api";
import { formatCurrencyAmount } from "../utils/currency";

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
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 ${iconClass}`}>
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
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3 text-[#1a59d1]">
          <Icon className="h-5 w-5" />
          <h2 className="text-[16px] font-semibold uppercase tracking-wide">{title}</h2>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </div>

      <div className="space-y-7 px-6 py-5 text-[14px]">{children}</div>

      <div className={`mx-4 mb-4 rounded-xl px-5 py-4 text-[15px] font-semibold ${totalNegative ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-900"}`}>
        <div className="flex items-center justify-between">
          <span>{totalLabel}</span>
          <span>{totalValue}</span>
        </div>
      </div>
    </section>
  );
}

function LedgerBlock({ heading, rows, company, negative = false }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-slate-900">{heading}</h3>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-[14px]">
            <span className="text-slate-700">{row.label}</span>
            <span className={negative ? "text-rose-600" : "text-slate-900"}>
              {formatSignedAmount(row.value, company)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfitLoss() {
  const today = new Date();
  const monthStart = formatLocalDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = formatLocalDateInput(
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
  );

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [ledgerFilter, setLedgerFilter] = useState("");
  const [reportView, setReportView] = useState("Detailed");
  const [costCenter, setCostCenter] = useState("All");
  const [report, setReport] = useState({ incomes: [], expenses: [], totals: {}, trading: {} });
  const [loading, setLoading] = useState(false);

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

  const selectedCompany = companies.find((company) => company._id === companyId);
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

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-6 py-6 text-slate-900">
      <div className="mx-auto max-w-[1380px]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-5">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900">
                  Profit &amp; Loss Statement
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-slate-500">
                  <span>Period : {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}</span>
                  <span>Company : <span className="font-medium text-slate-700">{selectedCompany?.name || "-"}</span></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 min-w-[268px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
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
                <select
                  className="h-11 min-w-[130px] rounded-xl border border-slate-200 bg-white px-4 text-[14px] shadow-sm outline-none"
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                >
                  {companies.map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm"
                >
                  <GitCompareArrows className="h-4 w-4" />
                  Compare
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1463ff] px-5 text-[14px] font-medium text-white shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
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
                value={formatCurrencyAmount(expenses, selectedCompany)}
                helper="Indirect expenses"
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
                        { label: "Sales Account", value: report.trading?.sales },
                        { label: "Sales Return", value: -Number(report.trading?.salesReturns || 0) },
                      ]}
                      company={selectedCompany}
                    />
                    <LedgerBlock
                      heading="Cost of Goods Sold"
                      rows={[
                        { label: "Opening Stock", value: report.trading?.openingStock },
                        { label: "Add: Purchase Accounts", value: report.trading?.purchases },
                        { label: "Less: Closing Stock", value: -Number(report.trading?.closingStock || 0) },
                      ]}
                      company={selectedCompany}
                      negative
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

                <section className="rounded-[22px] border border-slate-200 bg-white px-6 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <div className="grid gap-4 md:grid-cols-5 text-center">
                    {[
                      ["Sales", formatCurrencyAmount(sales, selectedCompany)],
                      ["Gross Profit", formatSignedAmount(grossProfit, selectedCompany)],
                      ["Expenses", formatCurrencyAmount(expenses, selectedCompany)],
                      ["Net Profit / Loss", formatSignedAmount(netProfit, selectedCompany)],
                      ["Net Profit Margin", `${Number(report.totals?.profitMargin || 0).toFixed(2)}%`],
                    ].map(([label, value]) => (
                      <div key={label} className="border-r border-slate-200 last:border-r-0">
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

          <aside className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
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
                  <select
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-[14px] outline-none"
                    value={companyId}
                    onChange={(event) => setCompanyId(event.target.value)}
                  >
                    {companies.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
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
