import { useEffect, useMemo, useState } from "react";
import { HandCoins, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import { getCompanyCurrency } from "../utils/currency";

const shortcutKeys = [
  { key: "F4", label: "Contra" },
  { key: "F5", label: "Payment", active: true },
  { key: "F6", label: "Receipt" },
  { key: "F7", label: "Journal" },
  { key: "F8", label: "Sales" },
  { key: "F9", label: "Purchase" },
  { key: "F10", label: "Other Vouchers" },
];

export default function PaymentVoucher({ companyId }) {
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    paymentLedger: "",
    rows: [{ ledgerId: "", amount: "", narration: "" }],
    narration: "",
    referenceNo: "",
    tags: "",
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
      setPaymentTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "payment")?._id || ""
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
      rows: [...prev.rows, { ledgerId: "", amount: "", narration: "" }],
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const validRows = form.rows.filter((row) => row.ledgerId && Number(row.amount) > 0);
  const totalAmount = validRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paymentLedger = ledgerMap.get(form.paymentLedger);

  const resetForm = () =>
    setForm({
      number: "",
      date: new Date().toISOString().slice(0, 10),
      paymentLedger: "",
      rows: [{ ledgerId: "", amount: "", narration: "" }],
      narration: "",
      referenceNo: "",
      tags: "",
    });

  const save = async () => {
    if (!paymentTypeId) return alert("Payment voucher type missing");
    if (!form.paymentLedger) return alert("Please select the account to pay from");
    if (validRows.length === 0) return alert("Please add at least one payment row");

    const lines = [
      ...validRows.map((row) => ({
        ledgerId: row.ledgerId,
        debit: Number(row.amount),
        credit: 0,
      })),
      {
        ledgerId: form.paymentLedger,
        debit: 0,
        credit: totalAmount,
      },
    ];

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: paymentTypeId,
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
    alert("Payment voucher saved");
    resetForm();
  };

  return (
    <VoucherWorkspace
      title="Payment Voucher"
      subtitle="Record outgoing payments from cash or bank accounts with clearer voucher control."
      icon={HandCoins}
      iconTone="bg-emerald-50 text-emerald-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Payment Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Company", value: company?.name },
        { label: "Pay From", value: paymentLedger?.name || "-" },
      ]}
      amountSummaryItems={[
        { label: "Total Amount", value: formatVoucherMoney(totalAmount, currency.symbol), emphasis: true },
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
              Pay From (Account)
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.paymentLedger}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, paymentLedger: event.target.value }))
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
              {paymentLedger
                ? renderBalance(
                    paymentLedger.currentBalanceAbs,
                    paymentLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Payment Details">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Paid To (Account)</th>
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            value={form.narration}
            onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
            placeholder="Payment for goods purchased."
          />
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-5">
            <p className="text-sm font-medium text-emerald-700">Total Amount</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {formatVoucherMoney(totalAmount, currency.symbol)}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <div className="grid gap-6 lg:grid-cols-3">
        <VoucherPanel title="Voucher Options">
          <div className="space-y-4 text-sm text-slate-600">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              Post-Dated
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              Optional Voucher
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
              Calculate Interest
            </label>
          </div>
        </VoucherPanel>

        <VoucherPanel title="More Options">
          <div className="space-y-4 text-sm text-slate-600">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              Add Attachment
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              Enable Auto Narration
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              Print After Saving
            </label>
          </div>
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
                placeholder="urgent, vendor-payment"
              />
            </div>
          </div>
        </VoucherPanel>
      </div>
    </VoucherWorkspace>
  );
}
