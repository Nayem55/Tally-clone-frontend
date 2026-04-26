import { useEffect, useState } from "react";
import api from "../api/api";

export default function ReceiptVoucher({ companyId }) {
  const [receiptTypeId, setReceiptTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);

  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().substring(0, 10),
    receiptLedger: "", // Cash/Bank (Debit)
    narration: "",
    creditLines: [
      { ledgerId: "", amount: "" }
    ]
  });

  // ---------------- LOAD MASTERS ----------------
  useEffect(() => {
    if (!companyId) return;

    async function loadMasters() {
      const vtypes = await api.get(`/companies/${companyId}/voucher-types`);
      const receipt = vtypes.data.find(
        v => v.name.toLowerCase() === "receipt"
      );
      setReceiptTypeId(receipt?._id || "");

      const l = await api.get(`/companies/${companyId}/ledgers`);
      setLedgers(l.data);
    }

    loadMasters();
  }, [companyId]);

  // ---------------- AUTO VOUCHER NUMBER ----------------
  useEffect(() => {
    if (!companyId || !receiptTypeId) return;

    async function loadNext() {
      const res = await api.get(
        `/companies/${companyId}/vouchers/next-number?voucherTypeId=${receiptTypeId}`
      );
      setForm(prev => ({ ...prev, number: res.data.nextNumber }));
    }

    loadNext();
  }, [companyId, receiptTypeId]);

  // ---------------- ADD ROW ----------------
  const addCreditRow = () => {
    setForm(prev => ({
      ...prev,
      creditLines: [...prev.creditLines, { ledgerId: "", amount: "" }]
    }));
  };

  // ---------------- UPDATE CREDIT ROW ----------------
  const updateCredit = (index, key, value) => {
    const lines = [...form.creditLines];
    lines[index][key] = value;
    setForm(prev => ({ ...prev, creditLines: lines }));
  };

  // ---------------- TOTAL CREDIT ----------------
  const totalCredit = form.creditLines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0
  );

  // ---------------- SAVE RECEIPT ----------------
  const save = async () => {
    if (!receiptTypeId) return alert("Receipt voucher type missing!");
    if (!form.receiptLedger) return alert("Select receipt ledger!");

    const creditLines = form.creditLines
      .filter(l => l.ledgerId && l.amount > 0)
      .map(l => ({
        ledgerId: l.ledgerId,
        debit: 0,
        credit: Number(l.amount)
      }));

    if (creditLines.length === 0)
      return alert("Enter at least one credit entry");

    const debitLine = {
      ledgerId: form.receiptLedger,
      debit: totalCredit,
      credit: 0
    };

    const body = {
      voucherTypeId: receiptTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines: [debitLine, ...creditLines]
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert("Receipt Voucher Saved!");

      // Reset + Load next number
      const next = await api.get(
        `/companies/${companyId}/vouchers/next-number?voucherTypeId=${receiptTypeId}`
      );

      setForm({
        number: next.data.nextNumber,
        date: new Date().toISOString().substring(0, 10),
        receiptLedger: "",
        narration: "",
        creditLines: [{ ledgerId: "", amount: "" }]
      });
    } catch (err) {
      alert(err.response?.data?.message || "Error saving voucher");
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-semibold mb-6">Receipt Voucher</h1>

      {/* Voucher No & Date */}
      <div className="flex gap-4 mb-4">
        <div>
          <label>Voucher No</label>
          <input className="border p-2" value={form.number} readOnly />
        </div>
        <div>
          <label>Date</label>
          <input
            type="date"
            className="border p-2"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
          />
        </div>
      </div>

      {/* Receipt Ledger */}
      <div className="mb-4">
        <label>Receipt Into (Debit)</label>
        <select
          className="border p-2 w-64"
          value={form.receiptLedger}
          onChange={e => setForm({ ...form, receiptLedger: e.target.value })}
        >
          <option value="">Select Cash/Bank</option>
          {ledgers.map(l => (
            <option key={l._id} value={l._id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Credit Lines */}
      <h2 className="font-semibold mb-2">Particulars (Credit)</h2>

      {form.creditLines.map((line, index) => (
        <div key={index} className="flex gap-4 mb-2">
          <select
            className="border p-2 w-64"
            value={line.ledgerId}
            onChange={e => updateCredit(index, "ledgerId", e.target.value)}
          >
            <option value="">Select Ledger</option>
            {ledgers.map(l => (
              <option key={l._id} value={l._id}>{l.name}</option>
            ))}
          </select>

          <input
            type="number"
            className="border p-2 w-40"
            placeholder="Amount"
            value={line.amount}
            onChange={e => updateCredit(index, "amount", e.target.value)}
          />
        </div>
      ))}

      <button
        className="bg-gray-200 px-4 py-2 mb-4 rounded"
        onClick={addCreditRow}
      >
        + Add Row
      </button>

      {/* Total */}
      <div className="font-semibold text-right mb-4">
        Total: {totalCredit.toFixed(2)}
      </div>

      {/* Narration */}
      <label>Narration</label>
      <textarea
        className="border p-2 w-full h-24 mb-4"
        value={form.narration}
        onChange={e => setForm({ ...form, narration: e.target.value })}
      />

      {/* Save */}
      <button className="bg-blue-600 text-white px-6 py-2 rounded" onClick={save}>
        Save Receipt Voucher
      </button>
    </div>
  );
}
