import { Fragment, useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronDown, ChevronRight, PackageSearch } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function StockItemDetailPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [report, setReport] = useState({ rows: [], totals: {} });
  const [expandedItems, setExpandedItems] = useState({});

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
        `/companies/${companyId}/reports/stock-item-detailed`,
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
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Stock Item Details</h1>
              <p className="mt-2 text-sm text-slate-500">
                Review item-wise opening, inward, outward, and closing stock with voucher movement history inside the same report.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <PackageSearch className="h-4 w-4 text-blue-600" />
                  Find Item
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
            <p className="text-sm font-medium text-slate-500">Opening Value</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrencyAmount(report.totals?.openingValue, selectedCompany)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Inward Value</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatCurrencyAmount(report.totals?.inwardValue, selectedCompany)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Outward Value</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">
              {formatCurrencyAmount(report.totals?.outwardValue, selectedCompany)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Closing Value</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">
              {formatCurrencyAmount(report.totals?.closingValue, selectedCompany)}
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Detailed Stock Item Register</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 text-right font-medium">Opening Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Opening Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Inward Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Outward Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Closing Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const open = expandedItems[row.itemId];
                  return (
                    <Fragment key={row.itemId}>
                      <tr className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <button
                            type="button"
                            className="flex items-center gap-2"
                            onClick={() =>
                              setExpandedItems((current) => ({
                                ...current,
                                [row.itemId]: !current[row.itemId],
                              }))
                            }
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                            <span>{row.itemName}</span>
                            {row.alias ? (
                              <span className="text-xs font-normal text-slate-400">
                                {row.alias}
                              </span>
                            ) : null}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{row.groupName || "-"}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.openingQty)}</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrencyAmount(row.openingRate, selectedCompany)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-700">
                          {formatNumber(row.inwardQty)}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-700">
                          {formatNumber(row.outwardQty)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatNumber(row.closingQty)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrencyAmount(row.closingRate, selectedCompany)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrencyAmount(row.closingValue, selectedCompany)}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                              <table className="min-w-[980px] text-sm">
                                <thead className="bg-slate-50 text-left text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">Date</th>
                                    <th className="px-3 py-2 font-medium">Voucher</th>
                                    <th className="px-3 py-2 font-medium">Direction</th>
                                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                                    <th className="px-3 py-2 text-right font-medium">Value</th>
                                    <th className="px-3 py-2 text-right font-medium">Closing Qty</th>
                                    <th className="px-3 py-2 text-right font-medium">Closing Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.history || []).map((entry, index) => (
                                    <tr
                                      key={`${row.itemId}-${entry.voucherId}-${index}`}
                                      className="border-t border-slate-100"
                                    >
                                      <td className="px-3 py-2 text-slate-700">{entry.dateLabel}</td>
                                      <td className="px-3 py-2 font-medium text-slate-800">
                                        {entry.voucherName}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span
                                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                            entry.direction === "IN"
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-rose-50 text-rose-700"
                                          }`}
                                        >
                                          {entry.direction}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-right">{formatNumber(entry.qty)}</td>
                                      <td className="px-3 py-2 text-right">
                                        {formatCurrencyAmount(entry.rate, selectedCompany)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {formatCurrencyAmount(entry.value, selectedCompany)}
                                      </td>
                                      <td className="px-3 py-2 text-right">{formatNumber(entry.closingQty)}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                        {formatCurrencyAmount(entry.closingValue, selectedCompany)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {(row.history || []).length === 0 && (
                                <div className="p-4 text-sm text-slate-500">
                                  No stock movement found for this item in the selected period.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
