import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CreditCard,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRoundSearch,
  X,
} from "lucide-react";
import api from "../api/api";
import SaveVoucherModal from "../Component/SaveVoucherModal";
import TallyDateInput from "../Component/TallyDateInput";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import useVoucherShortcuts from "../hooks/useVoucherShortcuts";
import { previewVoucherNode, printVoucherNode } from "../utils/printVoucher";
import { voucherShortcuts } from "../utils/shortcuts";
import { getCompanyCurrency } from "../utils/currency";
import { resolveItemRateByDate } from "../utils/pricing";
import { formatDateForInput } from "../utils/voucherDates";

function formatMoney(value, symbol = "Tk") {
  return `${symbol} ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toWords(value) {
  const amount = Math.round(Number(value || 0));
  if (!amount) return "Zero only";
  return `${amount.toLocaleString("en-IN")} only`;
}

const emptyRow = {
  itemId: "",
  qty: "1",
  rate: 0,
  mrpRate: 0,
  discountPercent: 0,
};

export default function PosVoucherPage({ editVoucherId = "", companyIdOverride = "" }) {
  const containerRef = useRef(null);
  const { companies, companyId } = useActiveCompany();
  const effectiveCompanyId = companyIdOverride || companyId;
  const companyName =
    companies.find((entry) => entry._id === effectiveCompanyId)?.name || "";
  const isEditMode = Boolean(editVoucherId);
  const [voucherTypeId, setVoucherTypeId] = useState("");
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    customerName: "",
    phone: "",
    address: "",
    note: "",
    discountType: "fixed",
    discountValue: "",
    redeemPoints: "",
    cardPayment: "",
    cashPayment: "",
    cashTendered: "",
    rows: [emptyRow],
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId: effectiveCompanyId,
    voucherTypeId,
    companyName,
    voucherLabel: "POS Voucher",
    disabled: isEditMode,
  });

  useEffect(() => {
    async function loadMasters() {
      if (!effectiveCompanyId) return;
      const [voucherTypeResponse, itemResponse, levelResponse, defaultResponse] =
        await Promise.all([
          api.get(`/companies/${effectiveCompanyId}/voucher-types`),
          api.get(`/companies/${effectiveCompanyId}/items`),
          api.get(`/companies/${effectiveCompanyId}/price-levels`),
          api.get(`/companies/${effectiveCompanyId}/ledgers/defaults`),
        ]);
      setItems(itemResponse.data);
      setPriceLevels(levelResponse.data);
      setDefaults(defaultResponse.data || {});
      const voucherType = voucherTypeResponse.data.find(
        (row) => row.name.toLowerCase() === "pos voucher",
      );
      setVoucherTypeId(voucherType?._id || "");
    }
    loadMasters();
  }, [effectiveCompanyId]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) => (prev.number ? prev : { ...prev, number: suggestedNumber }));
  }, [suggestedNumber, isEditMode]);

  useEffect(() => {
    const phone = form.phone.replace(/\D/g, "");
    if (!effectiveCompanyId || phone.length < 6) {
      setCustomerSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      const response = await api.get(`/companies/${effectiveCompanyId}/customers`, {
        params: { phone, limit: 8 },
      });
      setCustomerSuggestions(response.data);
      setShowCustomerSuggestions(true);
    }, 250);

    return () => clearTimeout(handle);
  }, [effectiveCompanyId, form.phone]);

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector("[data-voucher-date='true']");
      target?.focus();
      target?.select?.();
    });
    return () => window.cancelAnimationFrame(handle);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!effectiveCompanyId || !editVoucherId || items.length === 0) return;
      const response = await api.get(`/companies/${effectiveCompanyId}/vouchers/${editVoucherId}`);
      const voucher = response.data;
      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date ? String(voucher.date).slice(0, 10) : formatDateForInput(new Date()),
        customerName: voucher.customerSnapshot?.name || "",
        phone: voucher.customerSnapshot?.phone || "",
        address: voucher.customerSnapshot?.address || "",
        note: voucher.narration || "",
        discountType: voucher.posMeta?.discountType || "fixed",
        discountValue: String(voucher.posMeta?.discountValue || ""),
        redeemPoints: String(voucher.posMeta?.rewardRedeemed || ""),
        cardPayment: String(voucher.posMeta?.cardAmount || ""),
        cashPayment: String(voucher.posMeta?.cashAmount || ""),
        cashTendered: String(voucher.posMeta?.cashTendered || ""),
        rows:
          (voucher.inventoryLines || []).map((line) => ({
            itemId: String(line.itemId || ""),
            qty: String(line.qty || 1),
            rate: Number(line.rate || 0),
            mrpRate: Number(line.mrpRate || line.rate || 0),
            discountPercent: Number(line.discountValue || 0),
          })) || [emptyRow],
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [effectiveCompanyId, editVoucherId, items.length]);

  const selectedCompany = companies.find((company) => company._id === effectiveCompanyId);
  const currency = getCompanyCurrency(selectedCompany);
  const mrpPriceLevelId =
    priceLevels.find((level) => String(level.code || "").toUpperCase() === "MRP")?._id || "";
  const selectedCustomer = customerSuggestions.find(
    (customer) => customer.phone === form.phone.replace(/\D/g, ""),
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items.slice(0, 8);
    return items
      .filter((item) =>
        [item.name, item.alias, item.barcode]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [items, searchTerm]);

  const lineAmount = (row) => {
    const gross = Number(row.qty || 0) * Number(row.rate || 0);
    const discount = gross * (Number(row.discountPercent || 0) / 100);
    return Number((gross - discount).toFixed(2));
  };

  const addItemById = (itemId) => {
    const item = items.find((entry) => entry._id === itemId);
    if (!item) return;
    const mrpRate = resolveItemRateByDate(item, mrpPriceLevelId, form.date);
    setForm((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          itemId: item._id,
          qty: "1",
          rate: mrpRate,
          mrpRate,
          discountPercent: 0,
        },
      ],
    }));
    setSearchTerm("");
  };

  const addRow = () => {
    setForm((current) => ({ ...current, rows: [...current.rows, emptyRow] }));
  };

  const updateRow = (index, field, value) => {
    setForm((current) => {
      const nextRows = [...current.rows];
      const row = { ...nextRows[index], [field]: value };
      if (field === "itemId") {
        const item = items.find((entry) => entry._id === value);
        const mrpRate = resolveItemRateByDate(item, mrpPriceLevelId, current.date);
        row.rate = mrpRate;
        row.mrpRate = mrpRate;
      }
      nextRows[index] = row;
      return { ...current, rows: nextRows };
    });
  };

  const removeRow = (index) => {
    setForm((current) => ({
      ...current,
      rows: current.rows.length === 1 ? [emptyRow] : current.rows.filter((_, idx) => idx !== index),
    }));
  };

  const validRows = form.rows.filter((row) => row.itemId && Number(row.qty) > 0);
  const subtotal = validRows.reduce((sum, row) => sum + lineAmount(row), 0);
  const rowDiscountTotal = validRows.reduce((sum, row) => {
    const gross = Number(row.qty || 0) * Number(row.rate || 0);
    return sum + gross * (Number(row.discountPercent || 0) / 100);
  }, 0);
  const invoiceDiscount =
    form.discountType === "percentage"
      ? subtotal * (Number(form.discountValue || 0) / 100)
      : Number(form.discountValue || 0);
  const redeemPoints = Math.min(
    Number(form.redeemPoints || 0),
    Number(selectedCustomer?.rewardPoints || 0),
  );
  const totalAmount = Math.max(0, Number((subtotal - invoiceDiscount - redeemPoints).toFixed(2)));
  const totalItems = validRows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const rewardToEarn = validRows.reduce(
    (sum, row) => sum + Number(row.mrpRate || row.rate || 0) * Number(row.qty || 0),
    0,
  );
  const cardPayment = Number(form.cardPayment || 0);
  const cashPayment = Number(form.cashPayment || 0);
  const changeAmount = Math.max(0, Number(form.cashTendered || 0) - cashPayment);

  const applyCustomer = (customer) => {
    setForm((current) => ({
      ...current,
      customerName: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
    }));
    setShowCustomerSuggestions(false);
  };

  const resetForm = (nextNumber = suggestedNumber) => {
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      customerName: "",
      phone: "",
      address: "",
      note: "",
      discountType: "fixed",
      discountValue: "",
      redeemPoints: "",
      cardPayment: "",
      cashPayment: "",
      cashTendered: "",
      rows: [emptyRow],
    });
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    setSearchTerm("");
  };

  const submit = async (options = {}) => {
    if (!voucherTypeId) return alert("POS Voucher type is missing");
    if (!form.customerName.trim()) return alert("Customer name is required");
    if (form.phone.replace(/\D/g, "").length < 6) return alert("Valid phone number is required");
    if (validRows.length === 0) return alert("Please add at least one item");
    if (Number((cardPayment + cashPayment).toFixed(2)) !== Number(totalAmount.toFixed(2))) {
      return alert("Cash payment + card payment must match total payable");
    }

    const primaryBankLedgerId = defaults.bankLedger?._id || defaults.bankLedgers?.[0]?._id || "";
    const payload = {
      voucherTypeId,
      voucherName: "POS Voucher",
      number: form.number,
      date: form.date,
      narration: form.note,
      customerSnapshot: {
        name: form.customerName,
        phone: form.phone,
        address: form.address,
      },
      lines: [
        ...(cashPayment > 0 && defaults.cashLedger?._id
          ? [{ ledgerId: defaults.cashLedger._id, debit: cashPayment, credit: 0 }]
          : []),
        ...(cardPayment > 0 && primaryBankLedgerId
          ? [{ ledgerId: primaryBankLedgerId, debit: cardPayment, credit: 0 }]
          : []),
        { ledgerId: defaults.salesLedger?._id || "", debit: 0, credit: totalAmount },
      ],
      inventoryLines: validRows.map((row) => {
        const item = items.find((entry) => entry._id === row.itemId);
        const gross = Number(row.qty || 0) * Number(row.rate || 0);
        const discountValue = Number(row.discountPercent || 0);
        const discountAmount = gross * (discountValue / 100);
        return {
          itemId: row.itemId,
          itemName: item?.name || "",
          qty: Number(row.qty || 0),
          billedQty: Number(row.qty || 0),
          rate: Number(row.rate || 0),
          mrpRate: Number(row.mrpRate || row.rate || 0),
          discount: discountAmount,
          discountType: "percent",
          discountValue,
          amount: lineAmount(row),
          groupId: item?.groupId || null,
          groupName: item?.groupName || "",
          stockCategoryId: item?.stockCategoryId || null,
          stockCategoryName: item?.stockCategory || "",
          alias: item?.alias || "",
          barcode: item?.barcode || "",
        };
      }),
      posMeta: {
        discountType: form.discountType,
        discountValue: Number(form.discountValue || 0),
        invoiceDiscount,
        subtotal,
        totalAmount,
        rewardEarned: rewardToEarn,
        rewardRedeemed: redeemPoints,
        cashAmount: cashPayment,
        cardAmount: cardPayment,
        cashTendered: Number(form.cashTendered || 0),
        changeAmount,
      },
    };

    if (isEditMode) {
      await api.put(`/companies/${effectiveCompanyId}/vouchers/${editVoucherId}`, payload);
    } else {
      await api.post(`/companies/${effectiveCompanyId}/pos-vouchers`, {
        voucherTypeId,
        number: form.number,
        date: form.date,
        narration: form.note,
        customer: {
          name: form.customerName,
          phone: form.phone,
          address: form.address,
        },
        salesLedgerId: defaults.salesLedger?._id || "",
        discountType: form.discountType,
        discountValue: Number(form.discountValue || 0),
        redeemedPoints: redeemPoints,
        payments: {
          card: cardPayment,
          cash: cashPayment,
          cashTendered: Number(form.cashTendered || 0),
        },
        items: validRows.map((row) => {
          const item = items.find((entry) => entry._id === row.itemId);
          return {
            itemId: row.itemId,
            qty: Number(row.qty || 0),
            rate: Number(row.rate || 0),
            mrpRate: Number(row.mrpRate || row.rate || 0),
            discountType: "percent",
            discountValue: Number(row.discountPercent || 0),
            groupName: item?.groupName || "",
            stockCategoryName: item?.stockCategory || "",
          };
        }),
      });
    }

    if (options.printAfterSave) {
      await options.printVoucher?.();
    } else {
      alert(isEditMode ? "POS voucher updated successfully" : "POS voucher completed successfully");
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
  };

  useVoucherShortcuts({
    shortcuts: voucherShortcuts,
    containerRef,
    onAddRow: addRow,
    onSaveRequest: () => setShowSaveConfirm(true),
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShoppingCart className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">POS Sales Voucher</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Fast checkout with customer lookup, rewards, redemption, and POS-style payment capture.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={form.number}
                  onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
                <TallyDateInput
                  data-voucher-date="true"
                  data-vnav="true"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={form.date}
                  onChange={(value) => setForm((current) => ({ ...current, date: value }))}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Customer Details</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-4">
                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Customer Name</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.customerName}
                    onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                  />
                </div>
                <div className="relative">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Mobile Number</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-sm"
                      value={form.phone}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                    <UserRoundSearch className="absolute right-3 top-3.5 h-4 w-4 text-blue-600" />
                  </div>
                  {showCustomerSuggestions && customerSuggestions.length > 0 ? (
                    <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                      {customerSuggestions.map((customer) => (
                        <button
                          key={customer._id}
                          type="button"
                          className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => applyCustomer(customer)}
                        >
                          <div>
                            <p className="font-medium text-slate-900">{customer.name}</p>
                            <p className="text-xs text-slate-500">{customer.phone}</p>
                          </div>
                          <p className="text-xs text-emerald-600">
                            {Number(customer.rewardPoints || 0).toLocaleString("en-IN")} pts
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">Available Reward Points</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">
                    {Number(selectedCustomer?.rewardPoints || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="lg:col-span-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Address (Optional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm"
                    placeholder="Scan barcode or search item by name / code"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                  {searchTerm && filteredItems.length > 0 ? (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                      {filteredItems.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => addItemById(item._id)}
                        >
                          <div>
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.barcode || item.alias || "-"}</p>
                          </div>
                          <span className="text-xs text-emerald-600">Add</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={() => setForm((current) => ({ ...current, rows: [...current.rows, emptyRow] }))}
                >
                  + Add Item
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Item Name</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Disc %</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.rows.map((row, index) => {
                      const item = items.find((entry) => entry._id === row.itemId);
                      return (
                        <tr key={index} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-3">
                            <select
                              className="w-full rounded-xl border border-slate-200 px-3 py-3"
                              value={row.itemId}
                              onChange={(event) => updateRow(index, "itemId", event.target.value)}
                            >
                              <option value="">Select item</option>
                              {items.map((entry) => (
                                <option key={entry._id} value={entry._id}>
                                  {entry.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item?.barcode || item?.alias || "-"}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              className="w-full rounded-xl border border-slate-200 px-3 py-3"
                              value={row.qty}
                              onChange={(event) => updateRow(index, "qty", event.target.value)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              className="w-full rounded-xl border border-slate-200 px-3 py-3"
                              value={row.rate}
                              onChange={(event) => updateRow(index, "rate", event.target.value)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              className="w-full rounded-xl border border-slate-200 px-3 py-3"
                              value={row.discountPercent}
                              onChange={(event) => updateRow(index, "discountPercent", event.target.value)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatMoney(lineAmount(row), currency.symbol)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              className="rounded-lg border border-rose-200 p-2 text-rose-500 hover:bg-rose-50"
                              onClick={() => removeRow(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Discount Type</label>
                      <select
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                        value={form.discountType}
                        onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value }))}
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Discount Value</label>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                        value={form.discountValue}
                        onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Redeem Points</label>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                        value={form.redeemPoints}
                        onChange={(event) => setForm((current) => ({ ...current, redeemPoints: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Note (Optional)</label>
                    <textarea
                      rows={4}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      value={form.note}
                      onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-100 bg-blue-50 px-6 py-6 text-center">
                  <p className="text-sm font-medium text-blue-700">Total Payable</p>
                  <p className="mt-3 text-5xl font-bold text-blue-700">{formatMoney(totalAmount, currency.symbol)}</p>
                  <p className="mt-3 text-sm text-blue-700">{toWords(totalAmount)}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => previewVoucherNode(containerRef.current, "POS Sales Voucher")}
              >
                <Printer className="h-4 w-4" />
                Print Preview
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => setShowSaveConfirm(true)}
              >
                <Check className="h-4 w-4" />
                Complete Sale (F10)
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-4 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={resetForm}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            <section data-print-hide="true" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Amount Summary</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center justify-between"><span>Total Items</span><span>{totalItems}</span></div>
                <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatMoney(subtotal, currency.symbol)}</span></div>
                <div className="flex items-center justify-between"><span>Total Discount</span><span>{formatMoney(rowDiscountTotal + invoiceDiscount, currency.symbol)}</span></div>
                <div className="flex items-center justify-between"><span>Redeemed Points</span><span>{formatMoney(redeemPoints, currency.symbol)}</span></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 font-semibold text-emerald-600"><span>Total Amount</span><span>{formatMoney(totalAmount, currency.symbol)}</span></div>
                <div className="flex items-center justify-between"><span>Reward to Earn</span><span>{rewardToEarn.toLocaleString("en-IN")} pts</span></div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Payment Details</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Card Payment (F5)</label>
                  <div className="relative">
                    <CreditCard className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-right text-sm"
                      value={form.cardPayment}
                      onChange={(event) => setForm((current) => ({ ...current, cardPayment: event.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cash (F6)</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-right text-sm"
                    value={form.cashPayment}
                    onChange={(event) => setForm((current) => ({ ...current, cashPayment: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cash Tendered</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-right text-sm"
                    value={form.cashTendered}
                    onChange={(event) => setForm((current) => ({ ...current, cashTendered: event.target.value }))}
                  />
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-medium text-emerald-700">Change</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">{formatMoney(changeAmount, currency.symbol)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Quick Shortcuts</h3>
              <div className="mt-4 grid gap-3 grid-cols-2">
                {[
                  ["F2", "Customer"],
                  ["F3", "Product"],
                  ["F4", "Voucher"],
                  ["F5", "Card"],
                  ["F6", "Cash"],
                  ["F7", "Hold Bill"],
                ].map(([key, label]) => (
                  <div key={key} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <span className="font-semibold text-blue-600">{key}</span>
                    <span className="ml-2 text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <SaveVoucherModal
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onSave={async () => {
          setShowSaveConfirm(false);
          await submit();
        }}
        onSaveAndPrint={async () => {
          setShowSaveConfirm(false);
          await submit({
            printAfterSave: true,
            printVoucher: () => printVoucherNode(containerRef.current, "POS Sales Voucher"),
          });
        }}
        title="Complete POS sale?"
        description="We are ready to post this POS voucher. You can save it now or save and open a clean printable bill immediately."
      />
    </div>
  );
}
