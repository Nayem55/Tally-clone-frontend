import { useEffect, useState } from "react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

export default function CustomerDimensionReportPage({ title, endpoint, labelKey }) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) setCompanyId((current) => current || response.data[0]._id);
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/reports/customer-behaviour/${endpoint}`);
      setRows(response.data);
    }
    loadReport();
  }, [companyId, endpoint]);

  const selectedCompany = companies.find((company) => company._id === companyId);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">Analyze customer purchase history by {labelKey.toLowerCase()}.</p>
          <div className="mt-5 max-w-md">
            <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
          </div>
        </section>

        {rows.map((row, index) => (
          <section key={`${row[labelKey]}-${index}`} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{row[labelKey]}</h2>
                <p className="mt-1 text-sm text-slate-500">Unique Customers: {row.uniqueCustomers}</p>
              </div>
              <div className="text-right text-sm">
                <p>Qty Sold: <span className="font-semibold">{Number(row.totalQty || 0).toLocaleString("en-IN")}</span></p>
                <p>Total Sales: <span className="font-semibold">{formatCurrencyAmount(row.totalAmount, selectedCompany)}</span></p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Last Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.customers || row.purchases || []).map((entry, entryIndex) => (
                    <tr key={`${row[labelKey]}-${entryIndex}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">{entry.customerName}</td>
                      <td className="px-4 py-3">{entry.phone || "-"}</td>
                      <td className="px-4 py-3">{Number(entry.totalQty || entry.qty || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">{formatCurrencyAmount(entry.totalAmount || entry.amount, selectedCompany)}</td>
                      <td className="px-4 py-3">{new Date(entry.lastPurchaseAt || entry.purchaseDate).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
