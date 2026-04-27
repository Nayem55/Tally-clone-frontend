import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Scale } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TrialBalance() {
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
  const [report, setReport] = useState({ rows: [], totals: null });
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

  async function loadReport() {
    if (!companyId) return;
    setLoading(true);
    try {
      const response = await api.get(
        `/companies/${companyId}/reports/trial-balance`,
        {
          params: { from: fromDate, to: toDate },
        }
      );
      setReport(response.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, [companyId, fromDate, toDate]);

  const summary = useMemo(() => report.totals || {}, [report.totals]);
  const selectedCompany = companies.find((company) => company._id === companyId);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <Scale className="h-3.5 w-3.5" />
                Financial report
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Trial Balance</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Review opening, movement, and closing balances with separate debit and credit columns, just the way an accounts team needs to scan it.
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

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Opening Balance</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-600">Debit</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(summary.openingDebit, selectedCompany)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Credit</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(summary.openingCredit, selectedCompany)}
              </span>
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Period Movement</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-600">Debit</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(summary.debit, selectedCompany)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Credit</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(summary.credit, selectedCompany)}
              </span>
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Closing Balance</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-600">Debit</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(summary.closingDebit, selectedCompany)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Credit</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(summary.closingCredit, selectedCompany)}
              </span>
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Ledger Balances</h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading trial balance...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ledger</th>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-4 py-3 text-right font-medium">Opening Dr</th>
                    <th className="px-4 py-3 text-right font-medium">Opening Cr</th>
                    <th className="px-4 py-3 text-right font-medium">Debit</th>
                    <th className="px-4 py-3 text-right font-medium">Credit</th>
                    <th className="px-4 py-3 text-right font-medium">Closing Dr</th>
                    <th className="px-4 py-3 text-right font-medium">Closing Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.ledgerId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.ledgerName}</td>
                      <td className="px-4 py-3 text-slate-500">{row.groupName || "-"}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.openingDebit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.openingCredit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.debit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.credit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.closingDebit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.closingCredit, selectedCompany)}</td>
                    </tr>
                  ))}
                </tbody>

                {report.rows.length > 0 && (
                  <tfoot className="bg-slate-50">
                    <tr className="border-t border-slate-200 font-semibold text-slate-900">
                      <td className="px-4 py-3" colSpan={2}>
                        Totals
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(summary.openingDebit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(summary.openingCredit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(summary.debit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(summary.credit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(summary.closingDebit, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(summary.closingCredit, selectedCompany)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {report.rows.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No ledger balances found for the selected period.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
