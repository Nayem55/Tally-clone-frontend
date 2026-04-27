import { useEffect, useState } from "react";
import api from "../api/api";
import { Trash2, Calendar, FileText, Package, Building2 } from "lucide-react";
import { resolveItemRateByDate } from "../utils/pricing";

export default function PurchaseVoucher({ companyId }) {
  const [purchaseTypeId, setPurchaseTypeId] = useState("");
  const [purchaseLedgers, setPurchaseLedgers] = useState([]);
  const [defaultPurchaseLedgerId, setDefaultPurchaseLedgerId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().substring(0, 10),
    supplierInvoiceNo: "",
    supplierLedger: "",
    purchaseLedger: "",
    narration: "",
    rows: [{ itemId: "", qty: "1", rate: "", amount: "" }],
  });

  useEffect(() => {
    if (!companyId) return;

    async function loadMasters() {
      setLoading(true);
      try {
        const [vtypesRes, creditorsRes, itemsRes, defaultsRes] = await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Creditors`),
          api.get(`/companies/${companyId}/items`),
          api.get(`/companies/${companyId}/ledgers/defaults`),
        ]);

        const purchaseType = vtypesRes.data.find(
          (voucherType) => voucherType.name.toLowerCase() === "purchase"
        );
        setPurchaseTypeId(purchaseType?._id || "");
        setPurchaseLedgers(creditorsRes.data);
        setDefaultPurchaseLedgerId(defaultsRes.data.purchaseLedger?._id || "");
        setItems(itemsRes.data);
      } catch (err) {
        alert("Failed to load master data");
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, [companyId]);

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };

      if (key === "itemId" && value) {
        const item = items.find((entry) => entry._id === value);
        rows[index].rate = resolveItemRateByDate(item, null, prev.date);

        if (index === rows.length - 1) {
          rows.push({ itemId: "", qty: "1", rate: "", amount: "" });
        }
      }

      const qty = Number(rows[index].qty || 0);
      const rate = Number(rows[index].rate || 0);
      rows[index].amount = (qty * rate).toFixed(2);

      return { ...prev, rows };
    });
  };

  const updateVoucherDate = (value) => {
    setForm((prev) => {
      const rows = prev.rows.map((row) => {
        if (!row.itemId) return row;
        const item = items.find((entry) => entry._id === row.itemId);
        const rate = resolveItemRateByDate(item, null, value);
        return {
          ...row,
          rate,
          amount: (Number(row.qty || 0) * Number(rate || 0)).toFixed(2),
        };
      });
      return { ...prev, date: value, rows };
    });
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const validRows = form.rows.filter((row) => row.itemId && Number(row.qty) > 0);
  const totalAmount = validRows
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    .toFixed(2);

  const save = async () => {
    if (!form.supplierLedger) return alert("Please select a Supplier");
    if (!(form.purchaseLedger || defaultPurchaseLedgerId)) {
      return alert("Purchase ledger is missing for this company");
    }
    if (validRows.length === 0) return alert("Please add at least one item");

    const inventoryLines = validRows.map((row) => {
      const item = items.find((entry) => entry._id === row.itemId);
      return {
        itemId: item._id,
        itemName: item.name,
        alias: item.alias || "",
        qty: Number(row.qty),
        rate: Number(row.rate),
        amount: Number(row.amount),
        productSnapshot: {
          name: item.name,
          alias: item.alias,
          groupId: item.groupId,
          openingQty: item.openingQty,
          openingRate: item.openingRate,
          prices: item.prices,
        },
      };
    });

    const fullNarration = form.supplierInvoiceNo
      ? `Inv: ${form.supplierInvoiceNo} - ${form.narration}`
      : form.narration;

    const body = {
      voucherTypeId: purchaseTypeId,
      number: form.number,
      date: form.date,
      narration: fullNarration || "Purchase Entry",
      lines: [
        {
          ledgerId: form.purchaseLedger || defaultPurchaseLedgerId,
          debit: Number(totalAmount),
          credit: 0,
        },
        { ledgerId: form.supplierLedger, debit: 0, credit: Number(totalAmount) },
      ],
      inventoryLines,
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert("Purchase Voucher Saved Successfully!");

      setForm({
        number: "",
        date: new Date().toISOString().substring(0, 10),
        supplierInvoiceNo: "",
        supplierLedger: "",
        purchaseLedger: "",
        narration: "",
        rows: [{ itemId: "", qty: "1", rate: "", amount: "" }],
      });
    } catch (err) {
      alert(err.response?.data?.message || "Error saving voucher");
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading purchase form...</div>;
  }

  const isSupplierSelected = !!form.supplierLedger;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          Purchase Voucher
        </h1>
        <p className="text-gray-600 mt-1">
          Voucher number is manual. Item rate now follows the selected voucher date.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm opacity-90">Voucher No</label>
              <input
                className="mt-2 bg-white/20 border border-white/30 rounded-lg px-4 py-3 w-full placeholder-white/70"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="Enter voucher no"
              />
            </div>

            <div>
              <label className="block text-sm opacity-90">Date</label>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-white/70" />
                <input
                  type="date"
                  className="pl-12 bg-white/20 border border-white/30 rounded-lg px-4 py-3 w-full"
                  value={form.date}
                  onChange={(e) => updateVoucherDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm opacity-90">Supplier Invoice No</label>
              <input
                className="mt-2 bg-white/20 border border-white/30 rounded-lg px-4 py-3 w-full placeholder-white/70"
                value={form.supplierInvoiceNo}
                onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm opacity-90">
                Supplier <span className="text-red-300">*</span>
              </label>
              <select
                className="mt-2 bg-white/20 border border-white/30 rounded-lg px-4 py-3 w-full text-white"
                value={form.supplierLedger}
                onChange={(e) => setForm({ ...form, supplierLedger: e.target.value })}
              >
                <option value="" className="text-gray-800">Select Supplier</option>
                {purchaseLedgers.map((ledger) => (
                  <option key={ledger._id} value={ledger._id} className="text-gray-800">
                    {ledger.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
            <Package className="w-6 h-6 text-blue-600" />
            Purchase Items
          </h2>

          {!isSupplierSelected && (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium">Please select a supplier first to start adding items</p>
              <p className="text-sm mt-2">Rates follow the voucher date once an item is selected.</p>
            </div>
          )}

          {isSupplierSelected && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-700">Item</th>
                    <th className="text-center p-4 w-32">Qty</th>
                    <th className="text-center p-4 w-32">Rate</th>
                    <th className="text-right p-4 w-40">Amount</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4">
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
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

                      <td className="p-4 text-right font-semibold text-gray-800">
                        {row.itemId ? Number(row.amount || 0).toFixed(2) : "0.00"}
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

          {isSupplierSelected && validRows.length > 0 && (
            <div className="mt-8 flex justify-end">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-8 py-6 w-96">
                <div className="flex justify-between text-2xl font-bold text-blue-700">
                  <span>Grand Total</span>
                  <span>{totalAmount}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Narration (Optional)
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Purchased from supplier as per bill..."
              value={form.narration}
              onChange={(e) => setForm({ ...form, narration: e.target.value })}
            />
          </div>

          <div className="mt-10 text-right">
            <button
              onClick={save}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold px-12 py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition shadow-lg text-lg"
            >
              Save Purchase Voucher
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
