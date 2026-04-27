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

export default function OutstandingReportPage({ type = "receivable" }) {
  const today = new Date().toISOString().slice(0, 10);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [toDate, setToDate] = useState(today);
  const [report, setReport] = useState({ rows: [], total: 0 });
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
      const response = await api.get(`/companies/${companyId}/reports/outstanding`, {
        params: { type, to: toDate },
      });
      setReport(response.data);
    }
    loadReport();
  }, [companyId, toDate, type]);

  const title =
    type === "payable" ? "Outstanding Payables" : "Outstanding Receivables";

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Review party-wise outstanding balances as of the selected date.
              </p>
            </div>
            <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
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
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Ledger-wise Outstanding</h2>
            <span className="text-sm font-semibold text-slate-500">
              Total: {formatCurrencyAmount(report.total, selectedCompany)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ledger</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(report.rows || []).map((row) => (
                  <tr key={row.ledgerId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.ledgerName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrencyAmount(row.amount, selectedCompany)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
