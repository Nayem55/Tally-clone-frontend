import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, PackageSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function StockSummary() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [report, setReport] = useState({ rows: [], totals: null });
  const [search, setSearch] = useState("");

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
      const response = await api.get(`/companies/${companyId}/reports/stock-summary`);
      setReport(response.data);
    }

    loadReport();
  }, [companyId]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return report.rows;
    return report.rows.filter(
      (row) =>
        row.itemName.toLowerCase().includes(query) ||
        row.groupName.toLowerCase().includes(query) ||
        row.alias.toLowerCase().includes(query)
    );
  }, [report.rows, search]);
  useReportKeyboardNav(containerRef, [filteredRows], {
    onExit: () => navigate(-1),
  });

  const totals = report.totals || {};
  const selectedCompany = companies.find((company) => company._id === companyId);

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
                <Boxes className="h-3.5 w-3.5" />
                Inventory report
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Stock Summary</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Opening, inward, outward, and closing stock in one register so you can maintain inventory like a proper accounting system.
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
                  <PackageSearch className="h-4 w-4 text-amber-600" />
                  Find Item
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="Search item, alias, or stock group..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Opening Quantity</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(totals.openingQty)}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Inward Quantity</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{formatNumber(totals.inwardQty)}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Outward Quantity</p>
            <p className="mt-2 text-3xl font-bold text-rose-700">{formatNumber(totals.outwardQty)}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Closing Value</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{formatCurrencyAmount(totals.closingValue, selectedCompany)}</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Item-wise Stock Register</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 text-right font-medium">Opening Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Inward Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Outward Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.itemId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <button
                        type="button"
                        data-report-nav="true"
                        className="rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                        onClick={() =>
                          navigate(`/reports/inventory-books/stock-item?itemId=${encodeURIComponent(row.itemId)}`)
                        }
                      >
                        {row.itemName}
                        {row.alias && (
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {row.alias}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.groupName || "-"}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.openingQty)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {formatNumber(row.inwardQty)}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-700">
                      {formatNumber(row.outwardQty)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.closingQty)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.closingRate, selectedCompany)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrencyAmount(row.closingValue, selectedCompany)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRows.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                No stock items matched this view.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
