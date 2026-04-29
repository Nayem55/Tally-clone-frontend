import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, Plus, Trash2 } from "lucide-react";
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

const shortcutKeys = [
  { key: "F4", label: "Contra" },
  { key: "F5", label: "Payment" },
  { key: "F6", label: "Receipt", active: true },
  { key: "F7", label: "Journal" },
  { key: "F8", label: "Sales" },
  { key: "F9", label: "Purchase" },
  { key: "F10", label: "Other Vouchers" },
];

const emptyRow = { ledgerId: "", amount: "", narration: "" };

export default function ReceiptVoucher({ companyId }) {
  const [receiptTypeId, setReceiptTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    receiptLedger: "",
    rows: [emptyRow],
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
  const receiptLedger = ledgerMap.get(form.receiptLedger);
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
      receiptLedger: "",
      rows: [emptyRow],
      narration: "",
    });
  }

  async function save() {
    if (!receiptTypeId) return alert("Receipt voucher type missing");
    if (!form.receiptLedger) return alert("Please select the account to receive into");
    if (validRows.length === 0) return alert("Please add at least one receipt row");

    const lines = [
      { ledgerId: form.receiptLedger, debit: totalAmount, credit: 0 },
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
  }

  return (
    <VoucherWorkspace
      title="Receipt Voucher"
      subtitle="Fast incoming receipt entry with searchable ledgers and typeable date control."
      icon={ArrowDownCircle}
      iconTone="bg-sky-50 text-sky-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Receipt Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
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
            <label className="mb-2 block text-sm font-semibold text-slate-700">Company</label>
            <div className="border border-[#c8d2de] bg-[#edf4ff] px-2 py-1.5 text-[14px] text-slate-700">
              {company?.name || "-"}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Receive Into</label>
            <SearchableSelect
              options={ledgerOptions}
              value={form.receiptLedger}
              onChange={(newValue) => setForm((prev) => ({ ...prev, receiptLedger: newValue }))}
              placeholder="Search cash / bank ledger"
            />
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
        <div className="overflow-hidden border border-[#bccfe3]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
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
                      <SearchableSelect
                        options={ledgerOptions}
                        value={row.ledgerId}
                        onChange={(newValue) => updateRow(index, "ledgerId", newValue)}
                        placeholder="Search received-from ledger"
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

      <VoucherPanel title="Narration">
        <textarea
          data-vnav="true"
          className="min-h-24 w-full border border-[#c8d2de] bg-[#fffdf4] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Receipt against customer dues."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
