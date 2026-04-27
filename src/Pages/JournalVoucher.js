import { useEffect, useMemo, useState } from "react";
import { BookText, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import { getCompanyCurrency } from "../utils/currency";

const shortcutKeys = [
  { key: "F4", label: "Contra" },
  { key: "F5", label: "Payment" },
  { key: "F6", label: "Receipt" },
  { key: "F7", label: "Journal", active: true },
  { key: "F8", label: "Sales" },
  { key: "F9", label: "Purchase" },
  { key: "F10", label: "Other Vouchers" },
];

export default function JournalVoucher({ companyId }) {
  const [journalTypeId, setJournalTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    narration: "",
    referenceNo: "",
    tags: "",
    rows: [{ ledgerId: "", side: "debit", amount: "", narration: "" }],
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      const [voucherResponse, ledgerResponse, companyResponse] = await Promise.all([
        api.get(`/companies/${companyId}/voucher-types`),
        api.get(`/companies/${companyId}/ledgers/with-balances`, {
          params: { to: form.date },
        }),
        api.get("/companies"),
      ]);
      setJournalTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "journal")?._id || ""
      );
      setLedgers(ledgerResponse.data);
      setCompanies(companyResponse.data);
    }
    loadMasters();
  }, [companyId, form.date]);

  const company = companies.find((entry) => entry._id === companyId);
  const currency = getCompanyCurrency(company);
  const ledgerMap = useMemo(
    () => new Map(ledgers.map((ledger) => [ledger._id, ledger])),
    [ledgers]
  );

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, rows };
    });
  };

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      rows: [...prev.rows, { ledgerId: "", side: "debit", amount: "", narration: "" }],
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const validRows = form.rows.filter((row) => row.ledgerId && Number(row.amount) > 0);
  const totalDebit = validRows
    .filter((row) => row.side === "debit")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalCredit = validRows
    .filter((row) => row.side === "credit")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  const resetForm = () =>
    setForm({
      number: "",
      date: new Date().toISOString().slice(0, 10),
      narration: "",
      referenceNo: "",
      tags: "",
      rows: [{ ledgerId: "", side: "debit", amount: "", narration: "" }],
    });

  const save = async () => {
    if (!journalTypeId) return alert("Journal voucher type missing");
    if (validRows.length === 0) return alert("Please add at least one journal row");
    if (totalDebit !== totalCredit) return alert("Debit and credit totals must match");

    const lines = validRows.map((row) => ({
      ledgerId: row.ledgerId,
      debit: row.side === "debit" ? Number(row.amount) : 0,
      credit: row.side === "credit" ? Number(row.amount) : 0,
    }));

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: journalTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      referenceNo: form.referenceNo,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      lines,
    });
    alert("Journal voucher saved");
    resetForm();
  };

  return (
    <VoucherWorkspace
      title="Journal Voucher"
      subtitle="Post manual adjustments with balanced debit and credit rows, ledger-wise."
      icon={BookText}
      iconTone="bg-purple-50 text-purple-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Journal Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Company", value: company?.name },
      ]}
      amountSummaryItems={[
        { label: "Total Debit", value: formatVoucherMoney(totalDebit, currency.symbol) },
        { label: "Total Credit", value: formatVoucherMoney(totalCredit, currency.symbol) },
        {
          label: "Difference",
          value: formatVoucherMoney(difference, currency.symbol),
          tone: difference === 0 ? "text-emerald-600" : "text-rose-600",
          emphasis: true,
        },
      ]}
      shortcuts={shortcutKeys}
    >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Company</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {company?.name || "-"}
            </div>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Journal Details">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Particulars</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 font-medium">Narration</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => {
                const ledger = ledgerMap.get(row.ledgerId);
                const isDebit = row.side === "debit";
                return (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4">
                      <select
                        className="w-full rounded-xl border border-slate-200 px-3 py-3"
                        value={row.ledgerId}
                        onChange={(event) => updateRow(index, "ledgerId", event.target.value)}
                      >
                        <option value="">Select ledger</option>
                        {ledgers.map((entry) => (
                          <option key={entry._id} value={entry._id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        Cur. Balance:{" "}
                        {ledger
                          ? renderBalance(
                              ledger.currentBalanceAbs,
                              ledger.currentBalanceSide,
                              currency.symbol
                            )
                          : "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        className="w-full rounded-xl border border-slate-200 px-3 py-3"
                        value={row.side}
                        onChange={(event) => updateRow(index, "side", event.target.value)}
                      >
                        <option value="debit">Dr</option>
                        <option value="credit">Cr</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-right"
                        value={isDebit ? row.amount : ""}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
                        disabled={!isDebit}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-right"
                        value={!isDebit ? row.amount : ""}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
                        disabled={isDebit}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-3"
                        value={row.narration}
                        onChange={(event) => updateRow(index, "narration", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      {form.rows.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Add New Row
        </button>

        <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 md:grid-cols-3">
          <div>
            <p>Total Debit</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">
              {formatVoucherMoney(totalDebit, currency.symbol)}
            </p>
          </div>
          <div>
            <p>Total Credit</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">
              {formatVoucherMoney(totalCredit, currency.symbol)}
            </p>
          </div>
          <div>
            <p>Status</p>
            <p className={`mt-1 text-xl font-bold ${difference === 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {difference === 0 ? "Balanced" : "Unbalanced"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <VoucherPanel title="Narration">
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            value={form.narration}
            onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
            placeholder="Advance adjusted."
          />
        </VoucherPanel>
        <VoucherPanel title="Tags & Reference">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Reference No.
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                value={form.referenceNo}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, referenceNo: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Tags</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="adjustment, transfer"
              />
            </div>
          </div>
        </VoucherPanel>
      </div>
    </VoucherWorkspace>
  );
}
