import { useEffect, useState } from "react";
import api from "../api/api";

export default function JournalVoucher({ companyId }) {
  const [journalTypeId, setJournalTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);

  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().substring(0, 10),
    narration: "",
    debitLines: [{ ledgerId: "", amount: "" }],
    creditLines: [{ ledgerId: "", amount: "" }]
  });

  // ---------------- LOAD MASTERS ----------------
  useEffect(() => {
    if (!companyId) return;

    async function loadMasters() {
      const vtypes = await api.get(`/companies/${companyId}/voucher-types`);
      const journal = vtypes.data.find(
        (v) => v.name.toLowerCase() === "journal"
      );
      setJournalTypeId(journal?._id || "");

      const l = await api.get(`/companies/${companyId}/ledgers`);
      setLedgers(l.data);
    }

    loadMasters();
  }, [companyId]);

  // ---------------- AUTO VOUCHER NO ----------------
  useEffect(() => {
    if (!companyId || !journalTypeId) return;

    async function loadNext() {
      const res = await api.get(
        `/companies/${companyId}/vouchers/next-number?voucherTypeId=${journalTypeId}`
      );
      setForm((prev) => ({ ...prev, number: res.data.nextNumber }));
    }

    loadNext();
  }, [companyId, journalTypeId]);

  // ---------------- ADD ROW HANDLERS ----------------
  const addDebitRow = () => {
    setForm((prev) => ({
      ...prev,
      debitLines: [...prev.debitLines, { ledgerId: "", amount: "" }]
    }));
  };

  const addCreditRow = () => {
    setForm((prev) => ({
      ...prev,
      creditLines: [...prev.creditLines, { ledgerId: "", amount: "" }]
    }));
  };

  const updateDebit = (i, key, value) => {
    const rows = [...form.debitLines];
    rows[i][key] = value;
    setForm({ ...form, debitLines: rows });
  };

  const updateCredit = (i, key, value) => {
    const rows = [...form.creditLines];
    rows[i][key] = value;
    setForm({ ...form, creditLines: rows });
  };

  // ---------------- TOTALS ----------------
  const totalDebit = form.debitLines.reduce(
    (sum, l) => sum + Number(l.amount || 0),
    0
  );

  const totalCredit = form.creditLines.reduce(
    (sum, l) => sum + Number(l.amount || 0),
    0
  );

  // ---------------- SAVE JOURNAL ----------------
  const save = async () => {
    if (!journalTypeId) return alert("Journal voucher type missing!");

    if (totalDebit !== totalCredit) {
      return alert("Debit and Credit must match!");
    }

    const debitLines = form.debitLines
      .filter((l) => l.ledgerId && Number(l.amount) > 0)
      .map((l) => ({
        ledgerId: l.ledgerId,
        debit: Number(l.amount),
        credit: 0
      }));

    const creditLines = form.creditLines
      .filter((l) => l.ledgerId && Number(l.amount) > 0)
      .map((l) => ({
        ledgerId: l.ledgerId,
        debit: 0,
        credit: Number(l.amount)
      }));

    if (debitLines.length === 0 || creditLines.length === 0) {
      return alert("Enter at least one debit and one credit entry!");
    }

    const body = {
      voucherTypeId: journalTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines: [...debitLines, ...creditLines]
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert("Journal Voucher Saved!");

      // Reset form + load next number
      const next = await api.get(
        `/companies/${companyId}/vouchers/next-number?voucherTypeId=${journalTypeId}`
      );

      setForm({
        number: next.data.nextNumber,
        date: new Date().toISOString().substring(0, 10),
        narration: "",
        debitLines: [{ ledgerId: "", amount: "" }],
        creditLines: [{ ledgerId: "", amount: "" }]
      });
    } catch (err) {
      alert(err.response?.data?.message || "Error saving voucher");
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-semibold mb-6">Journal Voucher</h1>

      {/* Voucher No / Date */}
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
            onChange={(e) =>
              setForm({ ...form, date: e.target.value })
            }
          />
        </div>
      </div>

      {/* ---------------- DEBIT SECTION ---------------- */}
      <h2 className="text-lg font-medium mb-2">Debit Entries</h2>

      {form.debitLines.map((line, i) => (
        <div key={i} className="flex gap-4 mb-2">
          <select
            className="border p-2 w-64"
            value={line.ledgerId}
            onChange={(e) => updateDebit(i, "ledgerId", e.target.value)}
          >
            <option value="">Select Ledger</option>
            {ledgers.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            className="border p-2 w-40"
            placeholder="Amount"
            value={line.amount}
            onChange={(e) => updateDebit(i, "amount", e.target.value)}
          />
        </div>
      ))}

      <button
        onClick={addDebitRow}
        className="bg-gray-200 px-4 py-2 mb-4 rounded"
      >
        + Add Debit Row
      </button>

      {/* ---------------- CREDIT SECTION ---------------- */}
      <h2 className="text-lg font-medium mb-2">Credit Entries</h2>

      {form.creditLines.map((line, i) => (
        <div key={i} className="flex gap-4 mb-2">
          <select
            className="border p-2 w-64"
            value={line.ledgerId}
            onChange={(e) => updateCredit(i, "ledgerId", e.target.value)}
          >
            <option value="">Select Ledger</option>
            {ledgers.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            className="border p-2 w-40"
            placeholder="Amount"
            value={line.amount}
            onChange={(e) => updateCredit(i, "amount", e.target.value)}
          />
        </div>
      ))}

      <button
        onClick={addCreditRow}
        className="bg-gray-200 px-4 py-2 mb-4 rounded"
      >
        + Add Credit Row
      </button>

      {/* ---------------- TOTAL ---------------- */}
      <div className="font-semibold mb-4">
        Debit Total: {totalDebit.toFixed(2)} | Credit Total: {totalCredit.toFixed(2)}
      </div>

      {/* Narration */}
      <label>Narration</label>
      <textarea
        className="border p-2 w-full h-24 mb-4"
        value={form.narration}
        onChange={(e) => setForm({ ...form, narration: e.target.value })}
      />

      {/* Save */}
      <button
        onClick={save}
        className="bg-blue-600 text-white px-6 py-2 rounded"
      >
        Save Journal Voucher
      </button>
    </div>
  );
}
