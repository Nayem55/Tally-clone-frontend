import { useEffect, useState } from "react";
import { Activity, Phone, Star } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

export default function CustomerBehaviourOverviewPage() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [report, setReport] = useState({ summary: {}, customers: [], recentVouchers: [] });
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

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
      const response = await api.get(`/companies/${companyId}/reports/customer-behaviour/overview`, {
        params: { from: fromDate, to: toDate },
      });
      setReport(response.data);
    }
    loadReport();
  }, [companyId, fromDate, toDate]);

  const selectedCompany = companies.find((company) => company._id === companyId);
  const summary = report.summary || {};

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 md:grid-cols-4">
            <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">From Date</label>
              <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">To Date</label>
              <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Total Customers</p><p className="mt-2 text-3xl font-bold text-slate-900">{summary.totalCustomers || 0}</p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Active Customers</p><p className="mt-2 text-3xl font-bold text-blue-700">{summary.activeCustomers || 0}</p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Total Orders</p><p className="mt-2 text-3xl font-bold text-emerald-700">{summary.totalOrders || 0}</p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Total POS Sales</p><p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrencyAmount(summary.totalSales, selectedCompany)}</p></article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Customer Behaviour</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 font-medium">Spent</th>
                    <th className="px-4 py-3 font-medium">Avg. Order</th>
                    <th className="px-4 py-3 font-medium">Reward Points</th>
                  </tr>
                </thead>
                <tbody>
                  {report.customers.map((customer) => (
                    <tr key={customer.customerId} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{customer.name}</div>
                        <div className="text-xs text-slate-400">{customer.phone}</div>
                        <div className="text-xs text-slate-400">{customer.companyName || "-"}</div>
                      </td>
                      <td className="px-4 py-3">{customer.totalOrders}</td>
                      <td className="px-4 py-3">{formatCurrencyAmount(customer.totalSpent, selectedCompany)}</td>
                      <td className="px-4 py-3">{formatCurrencyAmount(customer.averageOrderValue, selectedCompany)}</td>
                      <td className="px-4 py-3 text-emerald-600">{Number(customer.rewardPoints || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Reward Snapshot</h2>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Earned</span><span>{Number(summary.totalRewardsEarned || 0).toLocaleString("en-IN")} pts</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Activity className="h-4 w-4 text-rose-500" /> Redeemed</span><span>{Number(summary.totalRewardsRedeemed || 0).toLocaleString("en-IN")} pts</span></div>
              </div>
            </section>
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Recent POS Customers</h2>
              <div className="mt-4 space-y-3">
                {report.recentVouchers.map((row) => (
                  <div key={row.voucherId} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{row.customerName}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-slate-400"><Phone className="h-3.5 w-3.5" /> {row.phone}</p>
                        <p className="mt-1 text-xs text-slate-400">{row.companyName || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrencyAmount(row.totalAmount, selectedCompany)}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(row.date).toLocaleDateString("en-GB")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </article>
        </section>
      </div>
    </div>
  );
}
