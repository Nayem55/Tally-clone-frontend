import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Phone, Search, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { formatCurrencyAmount } from "../utils/currency";

const PAGE_SIZE = 50;

function formatPoints(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryCard({ label, value, hint, tone = "slate" }) {
  const toneMap = {
    slate: "text-slate-900",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
  };

  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${toneMap[tone] || toneMap.slate}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </article>
  );
}

export default function CustomerBehaviourOverviewPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [report, setReport] = useState({
    summary: {},
    customers: [],
    companyOptions: [],
  });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

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
        const response = await api.get(
          `/companies/${companyId}/reports/customer-behaviour/overview`,
          {
            params: { from: fromDate, to: toDate, companyFilter },
          },
        );
        setReport(response.data);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [companyId, fromDate, toDate, companyFilter]);

  const selectedCompany = companies.find((company) => company._id === companyId);
  const summary = report.summary || {};

  const filteredCustomers = useMemo(() => {
    const customers = report.customers || [];
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.address, customer.companyName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(trimmed)),
    );
  }, [report.customers, query]);

  useEffect(() => {
    setPage(1);
  }, [query, fromDate, toDate, companyFilter, companyId]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [filteredCustomers, currentPage]);

  function openCustomer(customer) {
    const phone = encodeURIComponent(customer.phone || "");
    navigate(
      `/reports/customer-behaviour/overview/customer?companyId=${companyId}&phone=${phone}`,
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                Customer Behaviour
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                Customer Overview
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Review overall customer performance here. Open any customer row
                to see full lifetime history, reward balance, and redemption
                details on its own screen.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[780px]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Company Filter
                </label>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All Companies</option>
                  {(report.companyOptions || []).map((option) => (
                    <option key={option.companyId} value={option.companyId}>
                      {option.companyName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Customers"
            value={summary.totalCustomers || 0}
            hint="Unique customer mobile numbers"
          />
          <SummaryCard
            label="Active Customers"
            value={summary.activeCustomers || 0}
            hint="Placed at least one POS order in this period"
            tone="blue"
          />
          <SummaryCard
            label="Total Orders"
            value={summary.totalOrders || 0}
            hint="POS invoices in selected date range"
            tone="emerald"
          />
          <SummaryCard
            label="Total POS Sales"
            value={formatCurrencyAmount(summary.totalSales, selectedCompany)}
            hint="Universal customer sales across companies"
          />
            {/* <SummaryCard
              label="Reward Balance"
              value={`${formatPoints(summary.totalRewardBalance || 0)} pts`}
              hint={`Earned ${formatPoints(summary.totalRewardsEarned || 0)} · Redeemed ${formatPoints(summary.totalRewardsRedeemed || 0)}`}
              tone="amber"
            />
            <SummaryCard
              label="Redeemed Points"
              value={`${formatPoints(summary.totalRewardsRedeemed || 0)} pts`}
              hint="Updated according to selected company filter"
              tone="blue"
            /> */}
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Customers</h2>
              <p className="mt-1 text-sm text-slate-500">
                Click any customer row to open full lifetime history.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-3 sm:w-auto sm:flex-row">
              <div className="relative min-w-0 sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search customer, phone, company..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[minmax(240px,1.3fr)_100px_150px_150px_120px_120px_130px_56px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <div>Customer</div>
              <div>Orders</div>
              <div>Spent</div>
              <div>Avg. Order</div>
              <div>Balance</div>
              <div>Redeemed</div>
              <div>Last Purchase</div>
              <div />
            </div>

            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Loading customer overview...
              </div>
            ) : pagedCustomers.length ? (
              pagedCustomers.map((customer) => (
                <button
                  key={customer.customerId}
                  type="button"
                  onClick={() => openCustomer(customer)}
                  className="grid w-full gap-3 border-t border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50 lg:grid-cols-[minmax(240px,1.3fr)_100px_150px_150px_120px_120px_130px_56px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-slate-950">
                        {customer.name || "Unnamed Customer"}
                      </p>
                      {(customer.companyNames?.length
                        ? customer.companyNames
                        : customer.companyName
                          ? [customer.companyName]
                          : ["Universal"]
                      ).map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {customer.phone || "-"}
                      </span>
                      {customer.address ? (
                        <span className="truncate">{customer.address}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-slate-900">
                    {customer.totalOrders || 0}
                  </div>
                  <div className="text-sm font-medium text-slate-900">
                    {formatCurrencyAmount(customer.totalSpent, selectedCompany)}
                  </div>
                  <div className="text-sm text-slate-500">
                    {formatCurrencyAmount(customer.averageOrderValue, selectedCompany)}
                  </div>
                  <div className="text-sm font-semibold text-emerald-700">
                    {formatPoints(customer.rewardPoints)} pts
                  </div>
                  <div className="text-sm font-semibold text-rose-600">
                    {formatPoints(customer.rewardRedeemed)} pts
                  </div>
                  <div className="text-sm text-slate-500">
                    {formatDate(customer.lastPurchaseAt)}
                  </div>
                  <div className="flex justify-end">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:hidden">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Period spent
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatCurrencyAmount(customer.totalSpent, selectedCompany)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-600">
                        Reward balance
                      </p>
                      <p className="mt-1 font-semibold text-emerald-700">
                        {formatPoints(customer.rewardPoints)} pts
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                No customer matched your search in this period.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShoppingBag className="h-3.5 w-3.5" />
              Open any row to review full lifetime order history and reward usage.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <p className="text-sm text-slate-500">
                Page {currentPage} of {totalPages} · {filteredCustomers.length} customers
              </p>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
