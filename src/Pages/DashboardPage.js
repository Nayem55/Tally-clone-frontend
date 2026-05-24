import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Landmark,
  LayoutGrid,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  UserSquare2,
  Wallet,
} from "lucide-react";
import api from "../api/api";
import { formatCurrencyAmount } from "../utils/currency";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";

function formatLocalDate(value = new Date()) {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "long",
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function DashboardMetricCard({ title, icon: Icon, value, subtitle, tone }) {
  return (
    <article className="rounded-[18px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-slate-700">{title}</p>
          <p className="mt-2 truncate text-[18px] font-bold leading-none text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-[13px] text-slate-400">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}

function PanelShell({ title, right, children, className = "" }) {
  return (
    <article className={`rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      {children}
    </article>
  );
}

function YearChip() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-500">
      This Year
    </div>
  );
}

function SummaryList({ headerLeft = "Particulars", headerRight = "Closing Balance", rows }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between text-[12px] text-slate-400">
        <span>{headerLeft}</span>
        <span>{headerRight}</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-[14px]">
            <span className="text-slate-700">{row.label}</span>
            <span className="font-semibold text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TrendChart({ series, color }) {
  const width = 430;
  const height = 165;
  const max = Math.max(...series.map((point) => Number(point.value || 0)), 1);
  const stepX = width / Math.max(series.length - 1, 1);
  const points = series
    .map((point, index) => {
      const x = index * stepX;
      const y = height - (Number(point.value || 0) / max) * 128 - 18;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const gridLines = [0, 10, 20, 30, 40];

  return (
    <svg viewBox={`0 0 ${width} ${height + 34}`} className="h-[210px] w-full">
      <defs>
        <linearGradient id={`trend-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridLines.map((line) => {
        const y = height - (line / 40) * 128 - 18;
        return (
          <g key={line}>
            <line x1="18" x2={width} y1={y} y2={y} stroke="#eef2f7" strokeWidth="1" />
            <text x="0" y={y + 4} className="fill-slate-400 text-[11px]">
              {line === 0 ? "0" : `${line}M`}
            </text>
          </g>
        );
      })}
      <polyline fill={`url(#trend-${color.replace("#", "")})`} stroke="none" points={areaPoints} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      {series.map((point, index) => {
        const x = index * stepX;
        const y = height - (Number(point.value || 0) / max) * 128 - 18;
        return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="3" fill={color} />;
      })}
      {series.map((point, index) => (
        <text
          key={`label-${point.label}`}
          x={index * stepX}
          y={height + 20}
          textAnchor="middle"
          className="fill-slate-500 text-[11px]"
        >
          {point.label}
        </text>
      ))}
    </svg>
  );
}

function QuickShortcutsCard() {
  const shortcuts = [
    { key: "F2", label: "Period", icon: CalendarDays, tone: "bg-blue-50 text-blue-600" },
    { key: "F3", label: "Company", icon: Building2, tone: "bg-cyan-50 text-cyan-600" },
    { key: "F4", label: "Contra", icon: ArrowLeftRight, tone: "bg-teal-50 text-teal-600" },
    { key: "F5", label: "Payment", icon: Wallet, tone: "bg-emerald-50 text-emerald-600" },
    { key: "F6", label: "Receipt", icon: CreditCard, tone: "bg-green-50 text-green-600" },
    { key: "F7", label: "Journal", icon: Receipt, tone: "bg-violet-50 text-violet-600" },
    { key: "F8", label: "Sales", icon: ShoppingCart, tone: "bg-amber-50 text-amber-600" },
    { key: "F9", label: "Purchase", icon: ShoppingBag, tone: "bg-rose-50 text-rose-600" },
  ];

  return (
      <PanelShell title="Quick Shortcuts" className="row-span-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <div
              key={shortcut.key}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-center"
            >
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${shortcut.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-[14px] font-semibold text-blue-700">{shortcut.key}</p>
              <p className="mt-1 text-[13px] text-slate-700">{shortcut.label}</p>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[14px] font-semibold text-blue-700"
      >
        View All Shortcuts
      </button>
    </PanelShell>
  );
}

function ActionButton({ children, className = "" }) {
  return (
    <button
      type="button"
      className={`rounded-2xl px-5 py-4 text-[16px] font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const { companies, companyId, selectedCompany } = useActiveCompany();
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    async function loadDashboard() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/reports/dashboard`);
      setDashboard(response.data);
    }
    loadDashboard();
  }, [companyId]);

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-[1520px] space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h1 className="text-[22px] font-semibold text-slate-900 sm:text-[24px]">Dashboard</h1>
              <span className="w-fit max-w-full truncate rounded-xl bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500 sm:text-[18px]">
                {selectedCompany?.name || "No company selected"}
              </span>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:w-fit sm:px-5 sm:py-3.5">
            <div className="flex items-center gap-3 text-slate-700">
              <CalendarDays className="h-5 w-5 text-slate-500" />
              <span className="text-sm font-medium sm:text-[15px]">{formatLocalDate()}</span>
            </div>
          </div>
        </div>

        {dashboard && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <DashboardMetricCard
                title="Cash Balance"
                icon={Wallet}
                value={formatCurrencyAmount(dashboard.cashInHandBalance, selectedCompany)}
                subtitle="Closing Balance"
                tone="bg-emerald-50 text-emerald-600"
              />
              <DashboardMetricCard
                title="Bank Balance"
                icon={Landmark}
                value={formatCurrencyAmount(dashboard.bankBalance, selectedCompany)}
                subtitle="Closing Balance"
                tone="bg-violet-50 text-violet-600"
              />
              <DashboardMetricCard
                title="Inventory Value"
                icon={Package}
                value={formatCurrencyAmount(dashboard.stockValue, selectedCompany)}
                subtitle="Closing Stock Value"
                tone="bg-blue-50 text-blue-600"
              />
              <DashboardMetricCard
                title="Receivables"
                icon={UserSquare2}
                value={formatCurrencyAmount(dashboard.receivables, selectedCompany)}
                subtitle="Total Outstanding"
                tone="bg-amber-50 text-amber-600"
              />
              <DashboardMetricCard
                title="Payables"
                icon={Banknote}
                value={formatCurrencyAmount(dashboard.payables, selectedCompany)}
                subtitle="Total Outstanding"
                tone="bg-rose-50 text-rose-600"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.18fr_1.18fr_1.18fr]">
              <PanelShell title="Sales Trend" right={<YearChip />}>
                <TrendChart series={dashboard.salesTrend || []} color="#2a7be4" />
              </PanelShell>

              <PanelShell title="Purchase Trend" right={<YearChip />}>
                <TrendChart series={dashboard.purchaseTrend || []} color="#18b981" />
              </PanelShell>

              <PanelShell title="Cash In/Out Flow" right={<YearChip />}>
                <div className="mb-3 text-center text-[13px] text-slate-500">For Primary</div>
                <SummaryList
                  headerLeft=""
                  headerRight=""
                  rows={[
                    {
                      label: "Net Inflow",
                      value: formatCurrencyAmount(dashboard.cashFlow?.netInflow, selectedCompany),
                    },
                    {
                      label: "Total Inflow",
                      value: formatCurrencyAmount(dashboard.cashFlow?.totalInflow, selectedCompany),
                    },
                    {
                      label: "Total Outflow",
                      value: formatCurrencyAmount(dashboard.cashFlow?.totalOutflow, selectedCompany),
                    },
                  ]}
                />
                <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-emerald-700">Net Cash Flow</span>
                    <span className="font-bold text-emerald-800">
                      {formatCurrencyAmount(dashboard.cashFlow?.netInflow, selectedCompany)}
                    </span>
                  </div>
                </div>
              </PanelShell>

              {/* <PanelShell title="Top Groups / Ledgers" right={<YearChip />}>
                <div className="mb-3 text-center text-[13px] text-slate-500">
                  For Bank Accounts (Ledger-wise)
                </div>
                <SummaryList
                  rows={(dashboard.topBankLedgers || []).map((row) => ({
                    label: row.ledgerName,
                    value: formatCurrencyAmount(row.closingBalance, selectedCompany),
                  }))}
                />
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-blue-700"
                >
                  View All
                </button>
              </PanelShell> */}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.18fr_1.18fr_1.18fr]">
              <PanelShell title="Assets / Liabilities" right={<YearChip />}>
                <SummaryList
                  rows={[
                    {
                      label: "Current Assets",
                      value: formatCurrencyAmount(
                        dashboard.assetsLiabilities?.currentAssets,
                        selectedCompany
                      ),
                    },
                    {
                      label: "Current Liabilities",
                      value: formatCurrencyAmount(
                        dashboard.assetsLiabilities?.currentLiabilities,
                        selectedCompany
                      ),
                    },
                  ]}
                />
              </PanelShell>

              <PanelShell title="Receivables / Payables" right={<YearChip />}>
                <SummaryList
                  headerRight="Pending Amount"
                  rows={[
                    {
                      label: "Receivables",
                      value: formatCurrencyAmount(
                        dashboard.receivablesPayables?.receivables,
                        selectedCompany
                      ),
                    },
                    {
                      label: "Payables",
                      value: formatCurrencyAmount(
                        dashboard.receivablesPayables?.payables,
                        selectedCompany
                      ),
                    },
                  ]}
                />
              </PanelShell>

              <PanelShell title="Inventory Summary" right={<YearChip />}>
                <div className="mb-3 text-center text-[13px] text-slate-500">For Primary</div>
                <SummaryList
                  headerRight="Value"
                  rows={[
                    {
                      label: `Closing Stock   (${formatNumber(
                        dashboard.inventorySummary?.closingStockQty
                      )})`,
                      value: formatCurrencyAmount(
                        dashboard.inventorySummary?.closingStockValue,
                        selectedCompany
                      ),
                    },
                    {
                      label: `Outwards   (${formatNumber(
                        dashboard.inventorySummary?.outwardQty
                      )})`,
                      value: formatCurrencyAmount(
                        dashboard.inventorySummary?.outwardValue,
                        selectedCompany
                      ),
                    },
                    {
                      label: `Inwards   (${formatNumber(
                        dashboard.inventorySummary?.inwardQty
                      )})`,
                      value: formatCurrencyAmount(
                        dashboard.inventorySummary?.inwardValue,
                        selectedCompany
                      ),
                    },
                  ]}
                />
              </PanelShell>

              {/* <QuickShortcutsCard /> */}

              <PanelShell title="Accounting Ratios" right={<YearChip />}>
                <SummaryList
                  headerRight="Value"
                  rows={[
                    {
                      label: "Inventory Turnover",
                      value: formatNumber(dashboard.accountingRatios?.inventoryTurnover),
                    },
                    {
                      label: "Debt/Equity Ratio",
                      value: `${formatNumber(dashboard.accountingRatios?.debtEquityRatio)} : 1`,
                    },
                    {
                      label: "Receivable Turnover in Days",
                      value: `${formatNumber(
                        dashboard.accountingRatios?.receivableTurnoverDays
                      )} Days`,
                    },
                    {
                      label: "Return on Investment %",
                      value: `${formatNumber(
                        dashboard.accountingRatios?.returnOnInvestment
                      )} %`,
                    },
                  ]}
                />
              </PanelShell>

              <PanelShell title="Cash/Bank Accounts" right={<YearChip />}>
                <SummaryList
                  rows={[
                    {
                      label: "Cash-in-Hand",
                      value: formatCurrencyAmount(
                        dashboard.cashBankAccounts?.cashInHand,
                        selectedCompany
                      ),
                    },
                    {
                      label: "Bank Accounts",
                      value: formatCurrencyAmount(
                        dashboard.cashBankAccounts?.bankAccounts,
                        selectedCompany
                      ),
                    },
                  ]}
                />
              </PanelShell>

              <PanelShell title="Trading Details" right={<YearChip />}>
                <SummaryList
                  headerRight="Amount"
                  rows={[
                    {
                      label: "Gross Profit",
                      value: formatCurrencyAmount(
                        dashboard.tradingDetails?.grossProfit,
                        selectedCompany
                      ),
                    },
                    {
                      label: "Net Loss",
                      value: formatCurrencyAmount(
                        dashboard.tradingDetails?.netLoss,
                        selectedCompany
                      ),
                    },
                    {
                      label: "Sales Accounts",
                      value: formatCurrencyAmount(
                        dashboard.tradingDetails?.salesAccounts,
                        selectedCompany
                      ),
                    },
                    {
                      label: "Purchase Accounts",
                      value: formatCurrencyAmount(
                        dashboard.tradingDetails?.purchaseAccounts,
                        selectedCompany
                      ),
                    },
                  ]}
                />
              </PanelShell>
            </section>

            {/* <section className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.15fr]">
              <ActionButton className="bg-blue-600 text-white">+ Create Voucher</ActionButton>
              <ActionButton className="bg-emerald-50 text-emerald-700">
                Bank Reconciliation
              </ActionButton>
              <ActionButton className="bg-violet-50 text-violet-700">Stock Summary</ActionButton>
              <ActionButton className="border border-slate-200 bg-white text-slate-700">
                Configure Dashboard
              </ActionButton>
            </section> */}
          </>
        )}
      </div>
    </div>
  );
}
