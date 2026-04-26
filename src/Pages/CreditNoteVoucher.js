import { useEffect, useState } from "react";
import api from "../api/api";

export default function CreditNoteVoucher({ companyId }) {
  const [creditTypeId, setCreditTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);

  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().substring(0, 10),
    customerLedger: "",   // DR
    returnLedger: "",     // CR (Sales Return)
    narration: "",
    rows: [{ itemId: "", qty: "", rate: "", amount: "" }]
  });

  const totalAmount = form.rows.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  // -------- LOAD MASTERS --------
  useEffect(() => {
    if (!companyId) return;

    async function loadMasters() {
      const vtypes = await api.get(`/companies/${companyId}/voucher-types`);
      const credit = vtypes.data.find(
        (v) => v.name.toLowerCase() === "credit note"
      );
      setCreditTypeId(credit?._id || "");

      const l = await api.get(`/companies/${companyId}/ledgers`);
      setLedgers(l.data);

      const it = await api.get(`/companies/${companyId}/items`);
      setItems(it.data);
    }

    loadMasters();
  }, [companyId]);

  // -------- AUTO NUMBER --------
  useEffect(() => {
    if (!companyId || !creditTypeId) return;

    async function loadNo() {
      try {
        const res = await api.get(
          `/companies/${companyId}/vouchers/next-number?voucherTypeId=${creditTypeId}`
        );
        setForm((prev) => ({ ...prev, number: res.data.nextNumber || "" }));
      } catch {}
    }

    loadNo();
  }, [companyId, creditTypeId]);

  // -------- ROW HANDLER --------
  const updateRow = (i, key, value) => {
    const rows = [...form.rows];
    rows[i][key] = value;

    if (key === "qty" || key === "rate") {
      const q = Number(rows[i].qty || 0);
      const r = Number(rows[i].rate || 0);
      rows[i].amount = (q * r).toFixed(2);
    }

    setForm({ ...form, rows });
  };

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      rows: [...prev.rows, { itemId: "", qty: "", rate: "", amount: "" }]
    }));
  };

  // -------- SAVE --------
  const save = async () => {
    if (!creditTypeId) return alert("Credit Note type missing!");
    if (!form.customerLedger) return alert("Select Customer A/c");
    if (!form.returnLedger) return alert("Select Return Ledger");

    const inventoryLines = form.rows
      .filter((r) => r.itemId && Number(r.qty) > 0)
      .map((r) => ({
        itemId: r.itemId,
        qty: Number(r.qty),  // STOCK INCREASE
        rate: Number(r.rate),
        amount: Number(r.amount)
      }));

    if (inventoryLines.length === 0) {
      return alert("Enter at least one item row");
    }

    const lines = [
      { ledgerId: form.customerLedger, debit: totalAmount, credit: 0 },
      { ledgerId: form.returnLedger, debit: 0, credit: totalAmount }
    ];

    const body = {
      voucherTypeId: creditTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines,
      inventoryLines
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert("Credit Note Saved!");

      // Reset form
      setForm({
        number: "",
        date: new Date().toISOString().substring(0, 10),
        customerLedger: "",
        returnLedger: "",
        narration: "",
        rows: [{ itemId: "", qty: "", rate: "", amount: "" }]
      });
    } catch (err) {
      alert(err?.response?.data?.message || "Error saving credit note");
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-semibold mb-6">Credit Note</h1>

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium">Voucher No</label>
          <input
            className="border p-2 w-40"
            value={form.number}
            onChange={(e) =>
              setForm((p) => ({ ...p, number: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Date</label>
          <input
            type="date"
            className="border p-2 w-40"
            value={form.date}
            onChange={(e) =>
              setForm((p) => ({ ...p, date: e.target.value }))
            }
          />
        </div>
      </div>

      {/* Customer */}
      <div className="mb-4">
        <label className="block text-sm font-medium">Party A/c (Customer)</label>
        <select
          className="border p-2 w-64"
          value={form.customerLedger}
          onChange={(e) =>
            setForm((p) => ({ ...p, customerLedger: e.target.value }))
          }
        >
          <option value="">Select Customer</option>
          {ledgers.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Return Ledger */}
      <div className="mb-4">
        <label className="block text-sm font-medium">Return Ledger</label>
        <select
          className="border p-2 w-64"
          value={form.returnLedger}
          onChange={(e) =>
            setForm((p) => ({ ...p, returnLedger: e.target.value }))
          }
        >
          <option value="">Select Sales Return</option>
          {ledgers.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Items */}
      <h2 className="font-semibold mb-2">Items</h2>

      {form.rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-4 mb-2">
          <select
            className="border p-2 w-64"
            value={row.itemId}
            onChange={(e) => updateRow(idx, "itemId", e.target.value)}
          >
            <option value="">Select Item</option>
            {items.map((it) => (
              <option key={it._id} value={it._id}>
                {it.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Qty"
            className="border p-2 w-24"
            value={row.qty}
            onChange={(e) => updateRow(idx, "qty", e.target.value)}
          />

          <input
            type="number"
            placeholder="Rate"
            className="border p-2 w-24"
            value={row.rate}
            onChange={(e) => updateRow(idx, "rate", e.target.value)}
          />

          <input
            type="number"
            className="border p-2 w-32 bg-gray-100"
            readOnly
            value={row.amount}
          />
        </div>
      ))}

      <button onClick={addRow} className="bg-gray-200 px-4 py-2 rounded mb-4">
        + Add Row
      </button>

      <div className="text-right font-semibold text-xl mb-4">
        Total: {totalAmount.toFixed(2)}
      </div>

      {/* Narration */}
      <div className="mb-4">
        <label className="block text-sm font-medium">Narration</label>
        <textarea
          className="border p-2 w-full h-24"
          value={form.narration}
          onChange={(e) =>
            setForm((p) => ({ ...p, narration: e.target.value }))
          }
        ></textarea>
      </div>

      <button
        onClick={save}
        className="bg-blue-600 text-white px-6 py-2 rounded"
      >
        Save Credit Note
      </button>
    </div>
  );
}
