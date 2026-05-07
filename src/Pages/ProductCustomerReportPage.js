import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, ShoppingBag, Users } from "lucide-react";
import api from "../api/api";
import TallyDateInput from "../Component/TallyDateInput";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { formatCurrencyAmount } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function daysSince(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = Math.round((today - date) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}

function MetricCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-3 text-4xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function ProductCustomerReportPage() {
  const { companyId, selectedCompany } = useActiveCompany();
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [fromDate, setFromDate] = useState(() => formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [toDate, setToDate] = useState(() => formatDateForInput(new Date()));
  const [appliedFilters, setAppliedFilters] = useState({
    itemId: "",
    fromDate: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    toDate: formatDateForInput(new Date()),
  });
  const [reportRows, setReportRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyCustomerKey, setHistoryCustomerKey] = useState("");

  useEffect(() => {
    async function loadItems() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/items`);
      setItems(response.data || []);
    }
    loadItems();
  }, [companyId]);

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      setLoading(true);
      try {
        const response = await api.get(
          `/companies/${companyId}/reports/customer-behaviour/product-wise`,
          {
            params: {
              ...(appliedFilters.itemId ? { itemId: appliedFilters.itemId } : {}),
              ...(appliedFilters.fromDate ? { from: appliedFilters.fromDate } : {}),
              ...(appliedFilters.toDate ? { to: appliedFilters.toDate } : {}),
            },
          },
        );
        setReportRows(response.data || []);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [companyId, appliedFilters]);

  const selectedProduct = useMemo(
    () => reportRows.find((row) => String(row.itemId) === String(itemId)) || null,
    [reportRows, itemId],
  );

  useEffect(() => {
    if (!itemId && reportRows.length > 0) {
      setItemId(String(reportRows[0].itemId));
    }
  }, [itemId, reportRows]);

  const activeProduct = useMemo(() => {
    if (selectedProduct) return selectedProduct;
    return reportRows.find((row) => String(row.itemId) === String(itemId)) || null;
  }, [selectedProduct, reportRows, itemId]);

  const customerRows = useMemo(() => {
    if (!activeProduct) return [];
    const grouped = new Map();
    (activeProduct.customers || []).forEach((entry) => {
      const key = entry.phone || String(entry.customerId || entry.customerName || "");
      const current = grouped.get(key) || {
        customerNumber: entry.phone || "-",
        customerName: entry.customerName || "Walk-in Customer",
        totalQty: 0,
        totalAmount: 0,
        purchases: 0,
        lastPurchase: null,
        history: [],
      };
      current.totalQty += Number(entry.qty || 0);
      current.totalAmount += Number(entry.amount || 0);
      current.purchases += 1;
      if (!current.lastPurchase || new Date(entry.purchaseDate) > new Date(current.lastPurchase)) {
        current.lastPurchase = entry.purchaseDate;
      }
      current.history.push(entry);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map((row) => ({
        ...row,
        avgQty: row.purchases > 0 ? row.totalQty / row.purchases : 0,
      }))
      .sort((left, right) => new Date(right.lastPurchase) - new Date(left.lastPurchase));
  }, [activeProduct]);

  useEffect(() => {
    if (!historyCustomerKey && customerRows.length > 0) {
      setHistoryCustomerKey(customerRows[0].customerNumber);
    }
  }, [customerRows, historyCustomerKey]);

  const activeHistoryCustomer = useMemo(
    () =>
      customerRows.find((row) => row.customerNumber === historyCustomerKey) ||
      customerRows[0] ||
      null,
    [customerRows, historyCustomerKey],
  );

  const metrics = useMemo(() => {
    const totalCustomers = customerRows.length;
    const totalQty = customerRows.reduce((sum, row) => sum + row.totalQty, 0);
    const totalAmount = customerRows.reduce((sum, row) => sum + row.totalAmount, 0);
    const totalPurchases = customerRows.reduce((sum, row) => sum + row.purchases, 0);
    return {
      totalCustomers,
      totalQty,
      totalAmount,
      avgQtyPerCustomer: totalCustomers ? totalQty / totalCustomers : 0,
      totalPurchases,
      avgPurchasesPerCustomer: totalCustomers ? totalPurchases / totalCustomers : 0,
    };
  }, [customerRows]);

  const clearFilters = () => {
    setItemId("");
    setFromDate("");
    setToDate("");
    setAppliedFilters({
      itemId: "",
      fromDate: "",
      toDate: "",
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                <ShoppingBag className="h-3.5 w-3.5" />
                Customer Behaviour
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                Product-Wise Sales Report
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Track which customers bought a specific product, when they bought it, and who is ready for reorder follow-up.
              </p>
            </div>
            <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Analyzing: {activeProduct?.itemName || "Select a product"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_290px_290px_290px]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Product
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm"
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                  >
                    <option value="">Select product</option>
                    {items.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-50"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                From Date
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <TallyDateInput
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm"
                  value={fromDate}
                  onChange={setFromDate}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                To Date
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <TallyDateInput
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm"
                  value={toDate}
                  onChange={setToDate}
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                onClick={() =>
                  setAppliedFilters({
                    itemId,
                    fromDate,
                    toDate,
                  })
                }
              >
                Apply Filters
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-6">
          <MetricCard label="Customers Who Bought" value={metrics.totalCustomers} tone="text-blue-600" />
          <MetricCard label="Total Quantity Sold" value={Number(metrics.totalQty).toLocaleString("en-IN")} tone="text-emerald-600" />
          <MetricCard
            label="Total Associated Value"
            value={formatCurrencyAmount(metrics.totalAmount, selectedCompany)}
            tone="text-emerald-600"
          />
          <MetricCard
            label="Avg Qty / Customer"
            value={metrics.avgQtyPerCustomer.toFixed(2)}
            tone="text-violet-600"
          />
          <MetricCard label="Total Purchases" value={metrics.totalPurchases} tone="text-amber-600" />
          <MetricCard
            label="Avg Purchases / Customer"
            value={metrics.avgPurchasesPerCustomer.toFixed(2)}
            tone="text-indigo-600"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Reorder Follow-up List
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Prioritize recent buyers and repeat customers for reorder follow-up.
                  </p>
                </div>
                {loading ? (
                  <span className="text-sm font-medium text-slate-500">Loading...</span>
                ) : null}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Customer Number</th>
                    <th className="px-5 py-4 font-medium">Customer Name</th>
                    <th className="px-5 py-4 text-right font-medium">Total Qty</th>
                    <th className="px-5 py-4 text-right font-medium">Associated Value</th>
                    <th className="px-5 py-4 text-right font-medium">Purchases</th>
                    <th className="px-5 py-4 font-medium">Last Purchase</th>
                    <th className="px-5 py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                        {itemId
                          ? "No customer purchase found for the selected product and period."
                          : "Select a product to start product-wise customer analysis."}
                      </td>
                    </tr>
                  ) : (
                    customerRows.map((row) => (
                      <tr key={`${row.customerNumber}-${row.customerName}`} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {row.customerNumber || "-"}
                        </td>
                        <td className="px-5 py-4 text-slate-800">{row.customerName}</td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          {Number(row.totalQty).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          {formatCurrencyAmount(row.totalAmount, selectedCompany)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {row.purchases}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          <div className="space-y-1">
                            <p>{formatDisplayDate(row.lastPurchase)}</p>
                            <p className="text-xs text-slate-400">{daysSince(row.lastPurchase)}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                              historyCustomerKey === row.customerNumber
                                ? "bg-indigo-600 text-white"
                                : "border border-indigo-200 bg-indigo-50 text-indigo-700"
                            }`}
                            onClick={() => setHistoryCustomerKey(row.customerNumber)}
                          >
                            Full History
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Customer History</h3>
                {activeHistoryCustomer ? (
                  <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {activeHistoryCustomer.customerName}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 max-h-[520px] overflow-y-auto pr-1">
                {!activeHistoryCustomer ? (
                  <p className="text-sm text-slate-500">
                    Pick a customer row to inspect product-level purchase history.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeHistoryCustomer.history.map((entry, index) => (
                      <div
                        key={`${activeHistoryCustomer.customerNumber}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {activeProduct?.itemName || entry.itemName || "-"} x{" "}
                          {Number(entry.qty || 0).toLocaleString("en-IN")}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span>{formatDisplayDate(entry.purchaseDate)}</span>
                          <span>{formatCurrencyAmount(entry.amount, selectedCompany)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Users className="h-5 w-5 text-blue-600" />
                Reorder Notes
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Prioritize customers with the most recent purchase date.</li>
                <li>Use repeat-purchase count to identify likely reorder buyers.</li>
                <li>Higher associated value customers should be contacted first for premium upsell.</li>
                <li>If the last purchase is old, use the history panel to shape a follow-up script.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
