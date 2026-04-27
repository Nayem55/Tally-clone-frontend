import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, Plus, Trash2 } from "lucide-react";
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
  { key: "F6", label: "Receipt", active: true },
  { key: "F7", label: "Journal" },
  { key: "F8", label: "Sales" },
  { key: "F9", label: "Purchase" },
];

export default function ReceiptVoucher({ companyId }) {
  const [receiptTypeId, setReceiptTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    receiptLedger: "",
    rows: [{ ledgerId: "", amount: "", narration: "" }],
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
      setReceiptTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "receipt")?._id || ""
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
  const receiptLedger = ledgerMap.get(form.receiptLedger);

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, rows };
    });
  };

  const addRow = () =>
    setForm((prev) => ({
      ...prev,
      rows: [...prev.rows, { ledgerId: "", amount: "", narration: "" }],
    }));
  const removeRow = (index) =>
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));

  const validRows = form.rows.filter((row) => row.ledgerId && Number(row.amount) > 0);
  const totalAmount = validRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const resetForm = () =>
    setForm({
      number: "",
      date: new Date().toISOString().slice(0, 10),
      receiptLedger: "",
      rows: [{ ledgerId: "", amount: "", narration: "" }],
      narration: "",
    });

  const save = async () => {
    if (!receiptTypeId) return alert("Receipt voucher type missing");
    if (!form.receiptLedger) return alert("Please select the account to receive into");
    if (validRows.length === 0) return alert("Please add at least one receipt row");

    const lines = [
      {
        ledgerId: form.receiptLedger,
        debit: totalAmount,
        credit: 0,
      },
      ...validRows.map((row) => ({
        ledgerId: row.ledgerId,
        debit: 0,
        credit: Number(row.amount),
      })),
    ];

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: receiptTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines,
    });
    alert("Receipt voucher saved");
    resetForm();
  };

  return (
    <VoucherWorkspace
      title="Receipt Voucher"
      subtitle="Record incoming receipts into cash or bank with clear ledger-wise settlement rows."
      icon={ArrowDownCircle}
      iconTone="bg-sky-50 text-sky-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Receipt Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Company", value: company?.name },
        { label: "Receipt Into", value: receiptLedger?.name || "-" },
      ]}
      amountSummaryItems={[
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
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
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Receive Into (Account)
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.receiptLedger}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, receiptLedger: event.target.value }))
              }
            >
              <option value="">Select cash / bank ledger</option>
              {ledgers.map((ledger) => (
                <option key={ledger._id} value={ledger._id}>
                  {ledger.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {receiptLedger
                ? renderBalance(
                    receiptLedger.currentBalanceAbs,
                    receiptLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Receipt Details">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Received From (Account)</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Narration</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => {
                const ledger = ledgerMap.get(row.ledgerId);
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
                        Current Balance:{" "}
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
      </VoucherPanel>

      <VoucherPanel title="Narration">
        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Receipt against customer dues."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
