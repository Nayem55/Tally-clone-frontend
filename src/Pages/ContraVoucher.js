import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import { getCompanyCurrency } from "../utils/currency";

const shortcutKeys = [
  { key: "F4", label: "Contra", active: true },
  { key: "F5", label: "Payment" },
  { key: "F6", label: "Receipt" },
  { key: "F7", label: "Journal" },
  { key: "F8", label: "Sales" },
  { key: "F9", label: "Purchase" },
  { key: "F10", label: "Other Vouchers" },
];

export default function ContraVoucher({ companyId }) {
  const [contraTypeId, setContraTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    rows: [{ creditLedgerId: "", debitLedgerId: "", amount: "", narration: "" }],
    narration: "",
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
      setContraTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "contra")?._id || ""
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
      rows: [...prev.rows, { creditLedgerId: "", debitLedgerId: "", amount: "", narration: "" }],
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const validRows = form.rows.filter(
    (row) => row.creditLedgerId && row.debitLedgerId && Number(row.amount) > 0
  );
  const totalAmount = validRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const resetForm = () =>
    setForm({
      number: "",
      date: new Date().toISOString().slice(0, 10),
      rows: [{ creditLedgerId: "", debitLedgerId: "", amount: "", narration: "" }],
      narration: "",
    });

  const save = async () => {
    if (!contraTypeId) return alert("Contra voucher type missing");
    if (validRows.length === 0) return alert("Please add at least one contra row");

    const lines = validRows.flatMap((row) => [
      { ledgerId: row.creditLedgerId, debit: 0, credit: Number(row.amount) },
      { ledgerId: row.debitLedgerId, debit: Number(row.amount), credit: 0 },
    ]);

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: contraTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines,
    });
    alert("Contra voucher saved");
    resetForm();
  };

  return (
    <VoucherWorkspace
      title="Contra Voucher"
      subtitle="Transfer between cash and bank accounts with proper debit and credit posting."
      icon={ArrowRightLeft}
      iconTone="bg-violet-50 text-violet-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Contra Voucher"
      summaryItems={[
        { label: "Company", value: company?.name },
        { label: "Date", value: form.date },
      ]}
      amountSummaryItems={[
        { label: "Total Debit", value: formatVoucherMoney(totalAmount, currency.symbol) },
        { label: "Total Credit", value: formatVoucherMoney(totalAmount, currency.symbol) },
        {
          label: "Difference",
          value: formatVoucherMoney(0, currency.symbol),
          tone: "text-emerald-600",
          emphasis: true,
        },
      ]}
      shortcuts={shortcutKeys}
    >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
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
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-center">
            <p className="text-sm font-medium text-emerald-700">Total Amount</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {formatVoucherMoney(totalAmount, currency.symbol)}
            </p>
            <p className="mt-1 text-xs text-emerald-600">(Dr = Cr)</p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Voucher Details">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Account (Credit)</th>
                <th className="px-4 py-3 font-medium">Contra Account (Debit)</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Narration</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => {
                const creditLedger = ledgerMap.get(row.creditLedgerId);
                const debitLedger = ledgerMap.get(row.debitLedgerId);
                return (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4">
                      <select
                        className="w-full rounded-xl border border-slate-200 px-3 py-3"
                        value={row.creditLedgerId}
                        onChange={(event) => updateRow(index, "creditLedgerId", event.target.value)}
                      >
                        <option value="">Select Account</option>
                        {ledgers.map((ledger) => (
                          <option key={ledger._id} value={ledger._id}>
                            {ledger.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        Current Balance:{" "}
                        {creditLedger
                          ? renderBalance(
                              creditLedger.currentBalanceAbs,
                              creditLedger.currentBalanceSide,
                              currency.symbol
                            )
                          : "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        className="w-full rounded-xl border border-slate-200 px-3 py-3"
                        value={row.debitLedgerId}
                        onChange={(event) => updateRow(index, "debitLedgerId", event.target.value)}
                      >
                        <option value="">Select Contra Account</option>
                        {ledgers.map((ledger) => (
                          <option key={ledger._id} value={ledger._id}>
                            {ledger.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        Current Balance:{" "}
                        {debitLedger
                          ? renderBalance(
                              debitLedger.currentBalanceAbs,
                              debitLedger.currentBalanceSide,
                              currency.symbol
                            )
                          : "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-right"
                        value={row.amount}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
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

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-right">
          <span className="text-sm text-slate-500">Total</span>
          <span className="ml-3 text-xl font-bold text-emerald-700">
            {formatVoucherMoney(totalAmount, currency.symbol)}
          </span>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Narration">
        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Cash deposited into bank account."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
