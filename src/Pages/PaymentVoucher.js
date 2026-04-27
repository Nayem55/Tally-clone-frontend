import { useEffect, useState } from "react";
import api from "../api/api";

export default function PaymentVoucher({ companyId }) {
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);

  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().substring(0, 10),
    paymentLedger: "", // cash/bank credit ledger
    narration: "",
    debitLines: [
      { ledgerId: "", amount: "" }
    ]
  });

  // ------------------- Load Masters -------------------
  useEffect(() => {
    if (!companyId) return;

    async function loadMasters() {
      const vtypes = await api.get(`/companies/${companyId}/voucher-types`);
      const payment = vtypes.data.find(
        v => v.name.toLowerCase() === "payment"
      );
      setPaymentTypeId(payment?._id || "");

      const l = await api.get(`/companies/${companyId}/ledgers`);
      setLedgers(l.data);
    }

    loadMasters();
  }, [companyId]);

  // ------------------- Add New Debit Row -------------------
  const addDebitRow = () => {
    setForm(prev => ({
      ...prev,
      debitLines: [...prev.debitLines, { ledgerId: "", amount: "" }]
    }));
  };

  // ------------------- Update Debit Line -------------------
  const updateDebit = (index, key, value) => {
    const lines = [...form.debitLines];
    lines[index][key] = value;
    setForm(prev => ({ ...prev, debitLines: lines }));
  };

  // ------------------- Total Debit -------------------
  const totalDebit = form.debitLines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0
  );

  // ------------------- Save Payment Voucher -------------------
  const save = async () => {
    if (!paymentTypeId) return alert("Payment voucher type missing");
    if (!form.paymentLedger) return alert("Select Payment Ledger");

    const debitLines = form.debitLines
      .filter(l => l.ledgerId && l.amount > 0)
      .map(l => ({
        ledgerId: l.ledgerId,
        debit: Number(l.amount),
        credit: 0
      }));

    if (debitLines.length === 0)
      return alert("Enter at least one debit row");

    const creditLine = {
      ledgerId: form.paymentLedger,
      debit: 0,
      credit: totalDebit
    };

    const body = {
      voucherTypeId: paymentTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines: [...debitLines, creditLine]
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert("Payment Voucher Saved!");

      setForm({
        number: "",
        date: new Date().toISOString().substring(0, 10),
        paymentLedger: "",
        narration: "",
        debitLines: [{ ledgerId: "", amount: "" }]
      });
    } catch (err) {
      alert(err.response?.data?.message || "Error creating payment voucher");
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-semibold mb-6">Payment Voucher</h1>

      {/* Voucher No & Date */}
      <div className="flex gap-4 mb-4">
        <div>
          <label>Voucher No</label>
          <input
            className="border p-2"
            value={form.number}
            onChange={e => setForm({ ...form, number: e.target.value })}
          />
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

      {/* Payment (Credit) Ledger */}
      <div className="mb-4">
        <label>Payment From (Credit)</label>
        <select
          className="border p-2 w-64"
          value={form.paymentLedger}
          onChange={e => setForm({ ...form, paymentLedger: e.target.value })}
        >
          <option value="">Select Cash/Bank</option>
          {ledgers.map(l => (
            <option key={l._id} value={l._id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Debit Lines */}
      <h2 className="font-semibold mb-2">Particulars (Debit)</h2>

      {form.debitLines.map((line, index) => (
        <div key={index} className="flex gap-4 mb-2">
          <select
            className="border p-2 w-64"
            value={line.ledgerId}
            onChange={e => updateDebit(index, "ledgerId", e.target.value)}
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
            onChange={e => updateDebit(index, "amount", e.target.value)}
          />
        </div>
      ))}

      <button
        className="bg-gray-200 px-4 py-2 mb-4 rounded"
        onClick={addDebitRow}
      >
        + Add Row
      </button>

      {/* Total */}
      <div className="font-semibold text-right mb-4">
        Total Debit: {totalDebit.toFixed(2)}
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
        Save Payment Voucher
      </button>
    </div>
  );
}
