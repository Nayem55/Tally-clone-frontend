import { useEffect, useMemo, useState } from "react";
import { CalendarRange, LineChart, PackageSearch } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
}

export default function InventoryMovementAnalysisPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [report, setReport] = useState({ rows: [], totals: {}, analytics: {} });

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
        `/companies/${companyId}/reports/inventory-movement-analysis`,
        { params: { from: fromDate, to: toDate } }
      );
      setReport(response.data);
    }

    loadReport();
  }, [companyId, fromDate, toDate]);

  const selectedCompany = companies.find((company) => company._id === companyId);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return report.rows || [];
    return (report.rows || []).filter(
      (row) =>
        row.itemName?.toLowerCase().includes(query) ||
        row.alias?.toLowerCase().includes(query) ||
        row.groupName?.toLowerCase().includes(query)
    );
  }, [report.rows, search]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <LineChart className="h-3.5 w-3.5" />
                Inventory books
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Movement Analysis</h1>
              <p className="mt-2 text-sm text-slate-500">
                Analyze how each stock item moved in the selected period, including inward, outward, net movement, turnover, and latest activity dates.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <PackageSearch className="h-4 w-4 text-blue-600" />
                  Search
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="Search item, alias, or group..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Inward Qty</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatNumber(report.totals?.inwardQty)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Outward Qty</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">
              {formatNumber(report.totals?.outwardQty)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Closing Qty</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatNumber(report.totals?.closingQty)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Closing Value</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">
              {formatCurrencyAmount(report.totals?.closingValue, selectedCompany)}
            </p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Most Moved Items</h2>
            <div className="mt-4 space-y-3">
              {(report.analytics?.mostMovedItems || []).map((row) => (
                <div key={row.itemId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800">{row.itemName}</p>
                    <p className="text-xs text-slate-500">{row.groupName || "-"}</p>
                  </div>
                  <span className="font-semibold text-slate-900">{formatNumber(row.totalMovementQty)}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Fastest Outward Items</h2>
            <div className="mt-4 space-y-3">
              {(report.analytics?.fastestOutwardItems || []).map((row) => (
                <div key={row.itemId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800">{row.itemName}</p>
                    <p className="text-xs text-slate-500">{row.groupName || "-"}</p>
                  </div>
                  <span className="font-semibold text-rose-700">{formatNumber(row.outwardQty)}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Item-wise Movement Analysis</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 text-right font-medium">Opening Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Inward Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Outward Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Net Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Last Purchase Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Value</th>
                  <th className="px-4 py-3 text-right font-medium">Turnover</th>
                  <th className="px-4 py-3 font-medium">Last Inward</th>
                  <th className="px-4 py-3 font-medium">Last Outward</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.itemId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.itemName}
                      {row.alias ? (
                        <span className="ml-2 text-xs font-normal text-slate-400">{row.alias}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.groupName || "-"}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.openingQty)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatNumber(row.inwardQty)}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{formatNumber(row.outwardQty)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(row.netQty)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.closingQty)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.closingRate, selectedCompany)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrencyAmount(row.closingValue, selectedCompany)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.stockTurnover)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.lastInwardAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.lastOutwardAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                No movement rows matched this view.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
