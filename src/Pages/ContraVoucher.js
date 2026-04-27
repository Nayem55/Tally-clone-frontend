import { useEffect, useState } from "react";
import api from "../api/api";

export default function ContraVoucher({ companyId }) {
  const [contraTypeId, setContraTypeId] = useState("");

  const [ledgers, setLedgers] = useState([]);

  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().substring(0, 10),
    mainLedger: "",
    secondLedger: "",
    amount: "",
    narration: ""
  });

  // ---------------------- LOAD MASTERS ----------------------
  useEffect(() => {
    if (!companyId) return;

    async function loadMasters() {
      const vtypes = await api.get(`/companies/${companyId}/voucher-types`);
      const contra = vtypes.data.find(
        (v) => v.name.toLowerCase() === "contra"
      );
      setContraTypeId(contra?._id || "");

      const l = await api.get(`/companies/${companyId}/ledgers`);
      setLedgers(l.data);
    }

    loadMasters();
  }, [companyId]);

  // ---------------------- SAVE VOUCHER ----------------------
  const save = async () => {
    if (!contraTypeId) return alert("Contra voucher type missing!");

    const amount = Number(form.amount);

    const body = {
      voucherTypeId: contraTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines: [
        { ledgerId: form.mainLedger, debit: 0, credit: amount },
        { ledgerId: form.secondLedger, debit: amount, credit: 0 }
      ]
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert("Contra Voucher Saved!");

      setForm((prev) => ({
        ...prev,
        number: "",
        mainLedger: "",
        secondLedger: "",
        amount: "",
        narration: ""
      }));
    } catch (err) {
      alert(err.response?.data?.message || "Error saving voucher");
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded">
      <h1 className="text-2xl mb-6 font-semibold">Contra Voucher</h1>

      {/* Voucher Number / Date */}
      <div className="flex gap-4 mb-4">
        <div>
          <label className="block mb-1 font-medium">Voucher No</label>
          <input
            className="border p-2"
            value={form.number}
            onChange={(e) =>
              setForm({ ...form, number: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Date</label>
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

      {/* Main Ledger */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">
          Main Account (Credit)
        </label>
        <select
          className="border p-2 w-64"
          value={form.mainLedger}
          onChange={(e) =>
            setForm({ ...form, mainLedger: e.target.value })
          }
        >
          <option value="">Select Ledger</option>
          {ledgers.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Second Ledger */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">
          Contra Account (Debit)
        </label>
        <select
          className="border p-2 w-64"
          value={form.secondLedger}
          onChange={(e) =>
            setForm({ ...form, secondLedger: e.target.value })
          }
        >
          <option value="">Select Ledger</option>
          {ledgers.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Amount</label>
        <input
          type="number"
          className="border p-2 w-64"
          value={form.amount}
          onChange={(e) =>
            setForm({ ...form, amount: e.target.value })
          }
        />
      </div>

      {/* Narration */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Narration</label>
        <textarea
          className="border p-2 w-full h-24"
          value={form.narration}
          onChange={(e) =>
            setForm({ ...form, narration: e.target.value })
          }
        ></textarea>
      </div>

      {/* Save button */}
      <button
        onClick={save}
        className="bg-blue-600 text-white px-6 py-2 rounded"
      >
        Save Contra Voucher
      </button>
    </div>
  );
}
