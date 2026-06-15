import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  ChevronDown,
  History,
  Package2,
  Phone,
  Search,
  ShoppingBag,
  Sparkles,
  Users,
  X,
} from "lucide-react";
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
      <p className={`mt-3 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, hint, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            tones[tone] || tones.slate
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
        </div>
      </div>
    </article>
  );
}

export default function ProductCustomerReportPage() {
  const { companyId, selectedCompany } = useActiveCompany();

  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [fromDate, setFromDate] = useState(() =>
    formatDateForInput(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
  );
  const [toDate, setToDate] = useState(() => formatDateForInput(new Date()));
  const [appliedFilters, setAppliedFilters] = useState({
    itemId: "",
    fromDate: formatDateForInput(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    toDate: formatDateForInput(new Date()),
  });
  const [reportRows, setReportRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);

  const selectedProductName = useMemo(() => {
    const product = items.find((item) => String(item._id) === String(itemId));
    return product ? product.name : "";
  }, [items, itemId]);

  const selectedProductMeta = useMemo(
    () =>
      items.find((item) => String(item._id) === String(itemId)) || null,
    [items, itemId],
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              ...(appliedFilters.itemId
                ? { itemId: appliedFilters.itemId }
                : {}),
              ...(appliedFilters.fromDate
                ? { from: appliedFilters.fromDate }
                : {}),
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

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) =>
      String(item.name || "").toLowerCase().includes(term),
    );
  }, [items, searchTerm]);

  const activeProduct = useMemo(
    () =>
      reportRows.find((row) => String(row.itemId) === String(itemId)) || null,
    [reportRows, itemId],
  );

  const customerRows = useMemo(() => {
    if (!activeProduct) return [];
    const grouped = new Map();

    (activeProduct.customers || []).forEach((entry) => {
      const key =
        entry.phone || String(entry.customerId || entry.customerName || "");
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

      if (
        !current.lastPurchase ||
        new Date(entry.purchaseDate) > new Date(current.lastPurchase)
      ) {
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
      .sort((a, b) => new Date(b.lastPurchase) - new Date(a.lastPurchase));
  }, [activeProduct]);

  const metrics = useMemo(() => {
    const totalCustomers = customerRows.length;
    const totalQty = customerRows.reduce((sum, row) => sum + row.totalQty, 0);
    const totalAmount = customerRows.reduce(
      (sum, row) => sum + row.totalAmount,
      0,
    );
    const totalPurchases = customerRows.reduce(
      (sum, row) => sum + row.purchases,
      0,
    );

    return {
      totalCustomers,
      totalQty,
      totalAmount,
      avgQtyPerCustomer: totalCustomers ? totalQty / totalCustomers : 0,
      totalPurchases,
      avgPurchasesPerCustomer: totalCustomers
        ? totalPurchases / totalCustomers
        : 0,
    };
  }, [customerRows]);

  const topCustomer = customerRows[0] || null;
  const repeatCustomers = customerRows.filter(
    (row) => row.purchases > 1,
  ).length;
  const recentCustomers = customerRows.filter((row) => {
    if (!row.lastPurchase) return false;
    const lastPurchase = new Date(row.lastPurchase);
    const today = new Date();
    lastPurchase.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - lastPurchase) / 86400000);
    return diff <= 14;
  }).length;

  const handleProductSelect = (id) => {
    setItemId(id);
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  const openHistoryModal = (customer) => {
    setModalCustomer(customer);
    setShowHistoryModal(true);
  };

  const clearFilters = () => {
    setItemId("");
    setSearchTerm("");
    setFromDate("");
    setToDate("");
    setAppliedFilters({ itemId: "", fromDate: "", toDate: "" });
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
                Track which customers bought a specific product and identify
                reorder opportunities with clearer buyer trends.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                {selectedCompany?.name || "Active company"}
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Analyzing: {activeProduct?.itemName || "Select a product"}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_290px_290px_290px]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Product
              </label>
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex w-full cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500"
                  onClick={() => setIsDropdownOpen(true)}
                >
                  <Search className="mr-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    className="flex-1 bg-transparent outline-none placeholder:text-slate-400"
                    placeholder="Search product..."
                    value={isDropdownOpen ? searchTerm : selectedProductName}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                  />
                  {itemId ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemId("");
                        setSearchTerm("");
                      }}
                      className="ml-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                  <ChevronDown className="ml-2 h-4 w-4 text-slate-400" />
                </div>

                {isDropdownOpen ? (
                  <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {filteredItems.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-500">
                        No products found
                      </div>
                    ) : (
                      filteredItems.map((item) => (
                        <div
                          key={item._id}
                          className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50 ${
                            item._id === itemId ? "bg-blue-50 text-blue-700" : ""
                          }`}
                          onClick={() => handleProductSelect(item._id)}
                        >
                          <div className="flex-1">{item.name}</div>
                          {item._id === itemId ? (
                            <span className="text-blue-600">✓</span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
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

            <div className="flex items-end gap-3">
              <button
                onClick={() => setAppliedFilters({ itemId, fromDate, toDate })}
                className="flex-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="rounded-xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-50"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-6">
          <MetricCard
            label="Customers Who Bought"
            value={metrics.totalCustomers}
            tone="text-blue-600"
          />
          <MetricCard
            label="Total Quantity Sold"
            value={Number(metrics.totalQty).toLocaleString("en-IN")}
            tone="text-emerald-600"
          />
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
          <MetricCard
            label="Total Invoices"
            value={metrics.totalPurchases}
            tone="text-amber-600"
          />
          <MetricCard
            label="Avg Purchases / Customer"
            value={metrics.avgPurchasesPerCustomer.toFixed(2)}
            tone="text-indigo-600"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">

          <InsightCard
            icon={Users}
            label="Repeat Buyers"
            value={repeatCustomers}
            hint="Customers with more than one invoice for this product"
            tone="blue"
          />
          <InsightCard
            icon={History}
            label="Recent Buyers"
            value={recentCustomers}
            hint="Purchased in the last 14 days"
            tone="amber"
          />
          <InsightCard
            icon={BadgeDollarSign}
            label="Top Buyer"
            value={topCustomer?.customerName || "-"}
            hint={
              topCustomer
                ? `${formatCurrencyAmount(
                    topCustomer.totalAmount,
                    selectedCompany,
                  )} across ${topCustomer.purchases} invoice${
                    topCustomer.purchases > 1 ? "s" : ""
                  }`
                : "Select a product to compare customer value"
            }
            tone="emerald"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Customer Purchase Matrix
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Prioritize recent and repeat buyers with their total
                    quantity, value, and invoice depth.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {customerRows.length} customer rows
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Customer</th>
                    <th className="px-5 py-4 text-right font-medium">Total Qty</th>
                    <th className="px-5 py-4 text-right font-medium">
                      Associated Value
                    </th>
                    <th className="px-5 py-4 text-right font-medium">Invoices</th>
                    <th className="px-5 py-4 text-right font-medium">
                      Avg Qty / Invoice
                    </th>
                    <th className="px-5 py-4 font-medium">Last Purchase</th>
                    <th className="px-5 py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Loading product analysis...
                      </td>
                    </tr>
                  ) : customerRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        {itemId
                          ? "No customer data found."
                          : "Select a product to view analysis."}
                      </td>
                    </tr>
                  ) : (
                    customerRows.map((row) => (
                      <tr
                        key={`${row.customerNumber}-${row.customerName}`}
                        className="border-t border-slate-100 align-top"
                      >
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">
                              {row.customerName}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{row.customerNumber}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          {Number(row.totalQty).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          {formatCurrencyAmount(row.totalAmount, selectedCompany)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {row.purchases}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-violet-600">
                          {Number(row.avgQty || 0).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          <div className="space-y-1">
                            <p>{formatDisplayDate(row.lastPurchase)}</p>
                            <p className="text-xs text-slate-400">
                              {daysSince(row.lastPurchase)}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => openHistoryModal(row)}
                            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
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
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-violet-600" />
                Follow-up Signals
              </h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Highest Value Customer
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {topCustomer?.customerName || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {topCustomer
                      ? `${formatCurrencyAmount(
                          topCustomer.totalAmount,
                          selectedCompany,
                        )} · ${topCustomer.purchases} invoice${
                          topCustomer.purchases > 1 ? "s" : ""
                        }`
                      : "No purchase signal yet"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Product Position
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {activeProduct?.groupName ||
                      selectedProductMeta?.groupName ||
                      "Unassigned group"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeProduct?.stockCategoryName ||
                      selectedProductMeta?.stockCategoryName ||
                      "No category tagged"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Users className="h-5 w-5 text-blue-600" />
                Reorder Notes
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Prioritize customers with the most recent purchase.</li>
                <li>Focus on repeat buyers for better conversion.</li>
                <li>
                  Higher value customers should be contacted first for premium
                  follow-up.
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>

      {showHistoryModal && modalCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Purchase History
                </h2>
                <p className="text-sm text-slate-500">
                  {modalCustomer.customerName} · {modalCustomer.customerNumber}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {modalCustomer.history
                .sort(
                  (a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate),
                )
                .map((entry, index) => (
                  <div
                    key={`${entry.purchaseDate}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {activeProduct?.itemName || entry.itemName} ×{" "}
                          {Number(entry.qty || 0).toLocaleString("en-IN")}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            {entry.companyName || "Company not tagged"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDisplayDate(entry.purchaseDate)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">
                          {formatCurrencyAmount(entry.amount, selectedCompany)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {daysSince(entry.purchaseDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="border-t p-4 text-center">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
