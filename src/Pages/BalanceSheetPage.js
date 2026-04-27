import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function BalanceTable({ title, rows, total, company }) {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-sm font-semibold text-slate-500">
          Total: {formatCurrencyAmount(total, company)}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Particulars</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.groupName} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{row.groupName}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatCurrencyAmount(row.amount, company)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function BalanceSheetPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [toDate, setToDate] = useState(today);
  const [report, setReport] = useState({ assets: [], liabilities: [], totals: {} });

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
      const response = await api.get(`/companies/${companyId}/reports/balance-sheet`, {
        params: { to: toDate },
      });
      setReport(response.data);
    }
    loadReport();
  }, [companyId, toDate]);
  const selectedCompany = companies.find((company) => company._id === companyId);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <h1 className="text-3xl font-bold text-slate-900">Balance Sheet</h1>
              <p className="mt-2 text-sm text-slate-500">
                Review assets and liabilities as of the selected date.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  As On
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

        <section className="grid gap-6 xl:grid-cols-2">
          <BalanceTable
            title="Liabilities"
            rows={report.liabilities || []}
            total={report.totals?.liabilities}
            company={selectedCompany}
          />
          <BalanceTable
            title="Assets"
            rows={report.assets || []}
            total={report.totals?.assets}
            company={selectedCompany}
          />
        </section>
      </div>
    </div>
  );
}
