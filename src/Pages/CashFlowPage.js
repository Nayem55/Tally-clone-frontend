import { useEffect, useState } from "react";
import { CalendarRange, Landmark } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CashFlowPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [report, setReport] = useState(null);
  const selectedCompany = companies.find((company) => company._id === companyId);

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
      const response = await api.get(
        `/companies/${companyId}/reports/cash-flow`,
        {
          params: { from: fromDate, to: toDate },
        },
      );
      setReport(response.data);
    }
    loadReport();
  }, [companyId, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <h1 className="text-3xl font-bold text-slate-900">Cash Flow</h1>
              <p className="mt-2 text-sm text-slate-500">
                Review opening balance, inflow, outflow, and period-wise
                movement for cash and bank accounts.
              </p>
            </div>
            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  From
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
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
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {report && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["Opening Balance", report.openingBalance],
                ["Inflow", report.inflow],
                ["Outflow", report.outflow],
                ["Net Flow", report.netFlow],
                ["Closing Balance", report.closingBalance],
              ].map(([label, value]) => (
                <article
                  key={label}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {formatCurrencyAmount(value, selectedCompany)}
                  </p>
                </article>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Monthly Movement
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Period</th>
                        <th className="px-4 py-3 text-right font-medium">
                          Inflow
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Outflow
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Net
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.monthly || []).map((row) => (
                        <tr
                          key={row.label}
                          className="border-t border-slate-100"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {row.label}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-700">
                            {formatCurrencyAmount(row.inflow, selectedCompany)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-700">
                            {formatCurrencyAmount(row.outflow, selectedCompany)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrencyAmount(row.net, selectedCompany)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Landmark className="h-5 w-5 text-blue-600" />
                    Cash / Bank Ledgers
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {(report.ledgerBalances || []).map((row) => (
                    <div
                      key={row.ledgerId}
                      className="flex items-center justify-between px-6 py-4"
                    >
                      <span className="font-medium text-slate-800">
                        {row.ledgerName}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrencyAmount(row.closing, selectedCompany)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
