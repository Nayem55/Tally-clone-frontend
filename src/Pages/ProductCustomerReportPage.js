import { useEffect, useMemo, useState, useRef } from "react";
import { CalendarDays, Search, ShoppingBag, Users, ChevronDown, X, X as CloseIcon } from "lucide-react";
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

  // Searchable Dropdown
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);

  const selectedProductName = useMemo(() => {
    const product = items.find((item) => item._id === itemId);
    return product ? product.name : "";
  }, [items, itemId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load Items
  useEffect(() => {
    async function loadItems() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/items`);
      setItems(response.data || []);
    }
    loadItems();
  }, [companyId]);

  // Load Report
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
          }
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
    return items.filter((item) => item.name.toLowerCase().includes(term));
  }, [items, searchTerm]);

  const activeProduct = useMemo(() => {
    return reportRows.find((row) => String(row.itemId) === String(itemId)) || null;
  }, [reportRows, itemId]);

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
      .sort((a, b) => new Date(b.lastPurchase) - new Date(a.lastPurchase));
  }, [activeProduct]);

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
        {/* Header & Filters */}
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                <ShoppingBag className="h-3.5 w-3.5" />
                Customer Behaviour
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Product-Wise Sales Report</h1>
              <p className="mt-2 text-sm text-slate-500">
                Track which customers bought a specific product and identify reorder opportunities.
              </p>
            </div>
            <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Analyzing: {activeProduct?.itemName || "Select a product"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_290px_290px_290px]">
            {/* Searchable Product Dropdown */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Product</label>
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                  onClick={() => setIsDropdownOpen(true)}
                >
                  <Search className="h-4 w-4 text-slate-400 mr-3" />
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
                  {itemId && (
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
                  )}
                  <ChevronDown className="h-4 w-4 text-slate-400 ml-2" />
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl bg-white border border-slate-200 shadow-xl max-h-80 overflow-auto py-1">
                    {filteredItems.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-500">No products found</div>
                    ) : (
                      filteredItems.map((item) => (
                        <div
                          key={item._id}
                          className={`px-4 py-3 cursor-pointer hover:bg-slate-50 flex items-center gap-3 ${
                            item._id === itemId ? "bg-blue-50 text-blue-700" : ""
                          }`}
                          onClick={() => handleProductSelect(item._id)}
                        >
                          <div className="flex-1">{item.name}</div>
                          {item._id === itemId && <span className="text-blue-600">✓</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Date Filters */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">From Date</label>
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
              <label className="mb-2 block text-sm font-semibold text-slate-700">To Date</label>
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
                className="flex-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
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

        {/* Metrics */}
        <section className="grid gap-4 xl:grid-cols-6">
          <MetricCard label="Customers Who Bought" value={metrics.totalCustomers} tone="text-blue-600" />
          <MetricCard label="Total Quantity Sold" value={Number(metrics.totalQty).toLocaleString("en-IN")} tone="text-emerald-600" />
          <MetricCard label="Total Associated Value" value={formatCurrencyAmount(metrics.totalAmount, selectedCompany)} tone="text-emerald-600" />
          <MetricCard label="Avg Qty / Customer" value={metrics.avgQtyPerCustomer.toFixed(2)} tone="text-violet-600" />
          <MetricCard label="Total Invoices" value={metrics.totalPurchases} tone="text-amber-600" />
          <MetricCard label="Avg Purchases / Customer" value={metrics.avgPurchasesPerCustomer.toFixed(2)} tone="text-indigo-600" />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Reorder Table */}
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Reorder Follow-up List</h2>
              <p className="mt-1 text-sm text-slate-500">Prioritize recent and repeat buyers.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Customer Number</th>
                    <th className="px-5 py-4 font-medium">Customer Name</th>
                    <th className="px-5 py-4 text-right font-medium">Total Qty</th>
                    <th className="px-5 py-4 text-right font-medium">Associated Value</th>
                    <th className="px-5 py-4 text-right font-medium">Invoices</th>
                    <th className="px-5 py-4 font-medium">Last Purchase</th>
                    <th className="px-5 py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                        {itemId ? "No customer data found." : "Select a product to view analysis."}
                      </td>
                    </tr>
                  ) : (
                    customerRows.map((row) => (
                      <tr key={row.customerNumber} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-medium text-slate-900">{row.customerNumber}</td>
                        <td className="px-5 py-4 text-slate-800">{row.customerName}</td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          {Number(row.totalQty).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          {formatCurrencyAmount(row.totalAmount, selectedCompany)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">{row.purchases}</td>
                        <td className="px-5 py-4 text-slate-700">
                          <div className="space-y-1">
                            <p>{formatDisplayDate(row.lastPurchase)}</p>
                            <p className="text-xs text-slate-400">{daysSince(row.lastPurchase)}</p>
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

          {/* Sidebar Notes */}
          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Users className="h-5 w-5 text-blue-600" />
                Reorder Notes
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Prioritize customers with the most recent purchase.</li>
                <li>Focus on repeat buyers for better conversion.</li>
                <li>Higher value customers first for premium follow-up.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>

      {/* Full History Modal */}
      {showHistoryModal && modalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Purchase History</h2>
                <p className="text-sm text-slate-500">{modalCustomer.customerName} • {modalCustomer.customerNumber}</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalCustomer.history
                .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
                .map((entry, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {activeProduct?.itemName || entry.itemName} × {Number(entry.qty).toLocaleString("en-IN")}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">{formatDisplayDate(entry.purchaseDate)}</p>
                      </div>
                      <p className="font-semibold text-emerald-600">
                        {formatCurrencyAmount(entry.amount, selectedCompany)}
                      </p>
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
      )}
    </div>
  );
}