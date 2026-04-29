import { useEffect, useMemo, useState } from "react";
import { HandCoins, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";

const emptyRow = { ledgerId: "", amount: "", narration: "" };

export default function PaymentVoucher({ companyId }) {
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    paymentLedger: "",
    rows: [emptyRow],
    narration: "",
    referenceNo: "",
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
  const ledgerMap = useMemo(() => new Map(ledgers.map((ledger) => [ledger._id, ledger])), [ledgers]);
  const ledgerOptions = useMemo(
    () =>
      ledgers.map((ledger) => ({
        value: ledger._id,
        label: ledger.name,
        meta: ledger.groupName || ledger.parentGroupName || "",
      })),
    [ledgers]
  );
  const paymentLedger = ledgerMap.get(form.paymentLedger);
  const validRows = form.rows.filter((row) => row.ledgerId && Number(row.amount) > 0);
  const totalAmount = validRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  function updateRow(index, key, value) {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, rows };
    });
  }

  function addRow() {
    setForm((prev) => ({ ...prev, rows: [...prev.rows, emptyRow] }));
  }

  function removeRow(index) {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function resetForm() {
    setForm({
      number: "",
      date: formatDateForInput(new Date()),
      paymentLedger: "",
      rows: [emptyRow],
      narration: "",
      referenceNo: "",
    });
  }

  async function save() {
    if (!paymentTypeId) return alert("Payment voucher type missing");
    if (!form.paymentLedger) return alert("Please select the account to pay from");
    if (validRows.length === 0) return alert("Please add at least one payment row");

    const lines = [
      ...validRows.map((row) => ({
        ledgerId: row.ledgerId,
        debit: Number(row.amount),
        credit: 0,
      })),
      { ledgerId: form.paymentLedger, debit: 0, credit: totalAmount },
    ];

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: paymentTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      referenceNo: form.referenceNo,
      lines,
    });
    alert("Payment voucher saved");
    resetForm();
  }

  return (
    <VoucherWorkspace
      title="Payment Voucher"
      subtitle="Fast outgoing payment entry with searchable ledgers and keyboard-only movement."
      icon={HandCoins}
      iconTone="bg-emerald-50 text-emerald-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Payment Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Pay From", value: paymentLedger?.name || "-" },
      ]}
      amountSummaryItems={[
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
          emphasis: true,
        },
      ]}
      >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
            <TallyDateInput
              data-voucher-date="true"
              className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.date}
              onChange={(nextDate) => setForm((prev) => ({ ...prev, date: nextDate }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Pay From</label>
            <SearchableSelect
              options={ledgerOptions}
              value={form.paymentLedger}
              onChange={(newValue) => setForm((prev) => ({ ...prev, paymentLedger: newValue }))}
              placeholder="Search cash / bank ledger"
            />
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
        <div className="overflow-hidden border border-[#bccfe3]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
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
                      <SearchableSelect
                        options={ledgerOptions}
                        value={row.ledgerId}
                        onChange={(newValue) => updateRow(index, "ledgerId", newValue)}
                        placeholder="Search paid-to ledger"
                      />
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
                        data-vnav="true"
                        type="number"
                        className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-right text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.amount}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <input
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#fffdf4] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.narration}
                        onChange={(event) => updateRow(index, "narration", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      {form.rows.length > 1 ? (
                        <button
                          type="button"
                          className="rounded p-2 text-rose-500 hover:bg-rose-50"
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
          className="mt-4 inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Add New Row
        </button>
      </VoucherPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <VoucherPanel title="Narration">
          <textarea
            data-vnav="true"
            className="min-h-24 w-full border border-[#c8d2de] bg-[#fffdf4] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
            value={form.narration}
            onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
            placeholder="Payment for goods purchased."
          />
        </VoucherPanel>
        <VoucherPanel title="Reference">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Reference No.</label>
          <input
            data-vnav="true"
            className="w-full border border-[#c8d2de] bg-[#fffdf4] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
            value={form.referenceNo}
            onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
          />
        </VoucherPanel>
      </div>
    </VoucherWorkspace>
  );
}
