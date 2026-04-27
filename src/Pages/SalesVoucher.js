import { useEffect, useState } from "react";
import api from "../api/api";
import { Trash2, FileText, Package } from "lucide-react";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";

export default function SalesVoucher({ companyId }) {
  const [salesTypeId, setSalesTypeId] = useState("");
  const [salesLedgerId, setSalesLedgerId] = useState("");
  const [partyLedgers, setPartyLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [customerPriceLevelId, setCustomerPriceLevelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyCurrency, setCompanyCurrency] = useState({ symbol: "Rs" });

  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().substring(0, 10),
    partyLedger: "",
    narration: "",
    rows: [
      {
        itemId: "",
        qty: "1",
        rate: "",
        amount: "",
        discountType: "fixed",
        discountValue: "",
      },
    ],
  });

  useEffect(() => {
    if (!companyId) return;

    async function loadMasters() {
      setLoading(true);
      try {
        const [vtypesRes, partyRes, itemsRes, defaultsRes, companiesRes] = await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Debtors`),
          api.get(`/companies/${companyId}/items`),
          api.get(`/companies/${companyId}/ledgers/defaults`),
          api.get("/companies"),
        ]);

        const salesType = vtypesRes.data.find((v) => v.name.toLowerCase() === "sales");
        setSalesTypeId(salesType?._id || "");
        setSalesLedgerId(defaultsRes.data.salesLedger?._id || "");
        setPartyLedgers(partyRes.data);
        setItems(itemsRes.data);
        const company = companiesRes.data.find((entry) => entry._id === companyId);
        setCompanyCurrency(getCompanyCurrency(company));
      } catch (err) {
        alert("Failed to load master data");
      } finally {
        setLoading(false);
      }
    }

    loadMasters();
  }, [companyId]);

  useEffect(() => {
    if (!form.partyLedger) {
      setCustomerPriceLevelId(null);
      return;
    }
    const ledger = partyLedgers.find((entry) => entry._id === form.partyLedger);
    setCustomerPriceLevelId(ledger?.priceLevelId || null);
  }, [form.partyLedger, partyLedgers]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => recalculateRowRate(row, prev.date)),
    }));
  }, [customerPriceLevelId]);

  const calculateRowAmount = (row) => {
    const qty = Number(row.qty || 0);
    const rate = Number(row.rate || 0);
    let amount = qty * rate;

    if (row.discountValue) {
      const value = Number(row.discountValue);
      if (row.discountType === "percent") {
        amount -= amount * (value / 100);
      } else {
        amount -= value;
      }
    }
    return Number(amount.toFixed(2));
  };

  const recalculateRowRate = (row, voucherDate) => {
    if (!row.itemId) return row;
    const item = items.find((entry) => entry._id === row.itemId);
    const rate = resolveItemRateByDate(item, customerPriceLevelId, voucherDate);
    const next = { ...row, rate };
    next.amount = calculateRowAmount(next);
    return next;
  };

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };

      if (key === "itemId" && value) {
        rows[index] = recalculateRowRate(rows[index], prev.date);

        if (index === rows.length - 1) {
          rows.push({
            itemId: "",
            qty: "1",
            rate: "",
            amount: "",
            discountType: "fixed",
            discountValue: "",
          });
        }
      } else {
        rows[index].amount = calculateRowAmount(rows[index]);
      }

      return { ...prev, rows };
    });
  };

  const updateVoucherDate = (value) => {
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) => recalculateRowRate(row, value)),
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const validRows = form.rows.filter((row) => row.itemId);
  const grandTotal = validRows
    .reduce((sum, row) => sum + calculateRowAmount(row), 0)
    .toFixed(2);

  const save = async () => {
    if (!form.partyLedger) return alert("Please select a Customer");
    if (!salesLedgerId) return alert("Sales ledger is missing for this company");
    if (validRows.length === 0) return alert("Please add at least one item");

    const inventoryLines = validRows.map((row) => {
      const item = items.find((entry) => entry._id === row.itemId);
      return {
        itemId: item._id,
        itemName: item.name,
        qty: Number(row.qty),
        rate: Number(row.rate),
        discount: Number(row.discountValue || 0),
        amount: Number(calculateRowAmount(row)),
        productSnapshot: { name: item.name, prices: item.prices },
      };
    });

    const body = {
      voucherTypeId: salesTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration || "Sales Invoice",
      lines: [
        { ledgerId: form.partyLedger, debit: Number(grandTotal), credit: 0 },
        { ledgerId: salesLedgerId, debit: 0, credit: Number(grandTotal) },
      ],
      inventoryLines,
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert("Sales Invoice Saved Successfully!");

      setForm({
        number: "",
        date: new Date().toISOString().substring(0, 10),
        partyLedger: "",
        narration: "",
        rows: [
          {
            itemId: "",
            qty: "1",
            rate: "",
            amount: "",
            discountType: "fixed",
            discountValue: "",
          },
        ],
      });
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading sales form...</div>;
  }

  const isCustomerSelected = !!form.partyLedger;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
          <FileText className="w-8 h-8 text-green-600" />
          Sales Voucher
        </h1>
        <p className="text-gray-600 mt-1">
          Voucher number is manual. Item rate now follows the voucher date and customer price level.
        </p>
      </div>

      <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-green-600 to-emerald-700 text-white grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm opacity-90">Invoice No</label>
            <input
              className="mt-2 bg-white/20 border border-white/30 rounded-lg px-4 py-3 w-full placeholder-white/70"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              placeholder="Enter invoice no"
            />
          </div>

          <div>
            <label className="block text-sm opacity-90">Date</label>
            <input
              type="date"
              className="mt-2 bg-white/20 border border-white/30 rounded-lg px-4 py-3 w-full"
              value={form.date}
              onChange={(e) => updateVoucherDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm opacity-90">
              Customer <span className="text-red-300">*</span>
            </label>
            <select
              className="mt-2 bg-white/20 border border-white/30 rounded-lg px-4 py-3 w-full text-white"
              value={form.partyLedger}
              onChange={(e) => setForm({ ...form, partyLedger: e.target.value })}
            >
              <option value="" className="text-gray-800">Select Customer</option>
              {partyLedgers.map((ledger) => (
                <option key={ledger._id} value={ledger._id} className="text-gray-800">
                  {ledger.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
            <Package className="w-6 h-6 text-green-600" />
            Sale Items
          </h2>

          {!isCustomerSelected && (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-lg font-medium">Please select a customer to begin</p>
              <p className="text-sm mt-2">Rate will follow the selected voucher date and the customer price level.</p>
            </div>
          )}

          {isCustomerSelected && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-700">Item</th>
                    <th className="text-center p-4 w-32">Qty</th>
                    <th className="text-center p-4 w-32">Rate</th>
                    <th className="text-center p-4 w-40">Discount</th>
                    <th className="text-right p-4 w-40">Amount</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4">
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500"
                          value={row.itemId}
                          onChange={(e) => updateRow(index, "itemId", e.target.value)}
                        >
                          <option value="">Select Item</option>
                          {items.map((item) => (
                            <option key={item._id} value={item._id}>
                              {item.name} {item.alias && `(${item.alias})`}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-4 text-center">
                        <input
                          type="number"
                          min="1"
                          className="w-24 text-center border border-gray-300 rounded-lg px-3 py-2"
                          value={row.qty}
                          onChange={(e) => updateRow(index, "qty", e.target.value)}
                          disabled={!row.itemId}
                        />
                      </td>

                      <td className="p-4 text-center">
                        <input
                          type="number"
                          step="0.01"
                          className="w-28 text-center border border-gray-300 rounded-lg px-3 py-2"
                          value={row.rate}
                          onChange={(e) => updateRow(index, "rate", e.target.value)}
                          disabled={!row.itemId}
                        />
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2 justify-center">
                          <select
                            className="border border-gray-300 rounded px-2 py-2 text-sm"
                            value={row.discountType}
                            onChange={(e) => updateRow(index, "discountType", e.target.value)}
                            disabled={!row.itemId}
                          >
                            <option value="fixed">Rs</option>
                            <option value="percent">%</option>
                          </select>
                          <input
                            type="number"
                            placeholder="0"
                            className="w-24 border border-gray-300 rounded px-3 py-2 text-sm"
                            value={row.discountValue}
                            onChange={(e) => updateRow(index, "discountValue", e.target.value)}
                            disabled={!row.itemId}
                          />
                        </div>
                      </td>

                      <td className="p-4 text-right font-semibold text-gray-800">
                        {companyCurrency.symbol} {row.itemId ? calculateRowAmount(row).toFixed(2) : "0.00"}
                      </td>

                      <td className="p-4 text-center">
                        {row.itemId && form.rows.length > 1 && (
                          <button
                            onClick={() => removeRow(index)}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-full transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isCustomerSelected && validRows.length > 0 && (
            <div className="mt-8 flex justify-end">
              <div className="bg-green-50 border border-green-200 rounded-xl px-8 py-6 w-96">
                <div className="flex justify-between text-2xl font-bold text-green-700">
                  <span>Grand Total</span>
                  <span>{companyCurrency.symbol} {grandTotal}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Narration (Optional)
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
              rows="3"
              placeholder="Sold to customer as per invoice..."
              value={form.narration}
              onChange={(e) => setForm({ ...form, narration: e.target.value })}
            />
          </div>

          <div className="mt-10 text-right">
            <button
              onClick={save}
              className="bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold px-12 py-4 rounded-xl hover:from-green-700 hover:to-emerald-800 transform hover:scale-105 transition shadow-lg text-lg"
            >
              Save Sales Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
