import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarRange } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ProfitLossTable({ title, rows, accent, company }) {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>
          Ledger-wise
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ledger</th>
              <th className="px-4 py-3 font-medium">Group</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ledgerId} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{row.ledgerName}</td>
                <td className="px-4 py-3 text-slate-500">{row.groupName || "-"}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatCurrencyAmount(row.amount, company)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">No rows found.</div>
        )}
      </div>
    </article>
  );
}

export default function ProfitLoss() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [report, setReport] = useState({ incomes: [], expenses: [], totals: {} });
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

  const summaryCards = useMemo(
    () => [
      {
        label: "Direct Income",
        value: report.totals?.grossIncome,
        accent: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Direct Expense",
        value: report.totals?.grossExpense,
        accent: "bg-amber-50 text-amber-700",
      },
      {
        label: "Gross Profit",
        value: report.totals?.grossProfit,
        accent: "bg-blue-50 text-blue-700",
      },
      {
        label: "Indirect Income",
        value: report.totals?.netIncome,
        accent: "bg-cyan-50 text-cyan-700",
      },
      {
        label: "Indirect Expense",
        value: report.totals?.netExpense,
        accent: "bg-rose-50 text-rose-700",
      },
      {
        label: "Net Profit",
        value: report.totals?.netProfit,
        accent: "bg-indigo-50 text-indigo-700",
      },
    ],
    [report.totals]
  );
  const selectedCompany = companies.find((company) => company._id === companyId);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <BarChart3 className="h-3.5 w-3.5" />
                Profitability
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Profit &amp; Loss</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Review direct and indirect incomes and expenses for the selected period.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
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
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500 shadow">
            Loading profit and loss...
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <div
                    className={`inline-flex rounded-xl px-3 py-2 text-xs font-semibold ${card.accent}`}
                  >
                    {card.label}
                  </div>
                  <p className="mt-4 text-2xl font-bold text-slate-900">
                    {formatCurrencyAmount(card.value, selectedCompany)}
                  </p>
                </article>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <ProfitLossTable
                title="Income"
                rows={report.incomes || []}
                accent="bg-emerald-50 text-emerald-700"
                company={selectedCompany}
              />
              <ProfitLossTable
                title="Expenses"
                rows={report.expenses || []}
                accent="bg-amber-50 text-amber-700"
                company={selectedCompany}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
