import { useEffect, useMemo, useState } from "react";
import { BookText, Plus, Trash2 } from "lucide-react";
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

const emptyRow = { fromLedgerId: "", toLedgerId: "", amount: "", narration: "" };

export default function JournalVoucher({ companyId }) {
  const [journalTypeId, setJournalTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    narration: "",
    referenceNo: "",
    rows: [emptyRow],
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
  const validRows = form.rows.filter(
    (row) => row.fromLedgerId && row.toLedgerId && Number(row.amount) > 0
  );
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
      narration: "",
      referenceNo: "",
      rows: [emptyRow],
    });
  }

  async function save() {
    if (!journalTypeId) return alert("Journal voucher type missing");
    if (validRows.length === 0) {
      return alert("Add at least one complete From -> To journal row.");
    }

    const incompleteTarget = form.rows.some(
      (row) => row.fromLedgerId && Number(row.amount) > 0 && !row.toLedgerId
    );
    if (incompleteTarget) {
      return alert("This journal is still unbalanced. Please add another 'To' ledger.");
    }

    const lines = validRows.flatMap((row) => [
      { ledgerId: row.fromLedgerId, debit: Number(row.amount), credit: 0 },
      { ledgerId: row.toLedgerId, debit: 0, credit: Number(row.amount) },
    ]);

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: journalTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration,
      referenceNo: form.referenceNo,
      lines,
    });
    alert("Journal voucher saved");
    resetForm();
  }

  return (
    <VoucherWorkspace
      title="Journal Voucher"
      subtitle="Use From and To ledgers for balanced entries so debit and credit always stay in sync."
      icon={BookText}
      iconTone="bg-purple-50 text-purple-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Journal Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
      ]}
      amountSummaryItems={[
        { label: "Total Debit", value: formatVoucherMoney(totalAmount, currency.symbol) },
        { label: "Total Credit", value: formatVoucherMoney(totalAmount, currency.symbol) },
        {
          label: "Status",
          value: validRows.length > 0 ? "Balanced" : "Add complete rows",
          tone: validRows.length > 0 ? "text-emerald-600" : "text-amber-600",
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
            <label className="mb-2 block text-sm font-semibold text-slate-700">Reference No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#fffdf4] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.referenceNo}
              onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
            />
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Journal Details">
        <div className="overflow-hidden border border-[#bccfe3]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">From (Debit)</th>
                <th className="px-4 py-3 font-medium">To (Credit)</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Narration</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => {
                const fromLedger = ledgerMap.get(row.fromLedgerId);
                const toLedger = ledgerMap.get(row.toLedgerId);
                return (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4">
                      <SearchableSelect
                        options={ledgerOptions}
                        value={row.fromLedgerId}
                        onChange={(newValue) => updateRow(index, "fromLedgerId", newValue)}
                        placeholder="Search debit ledger"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Cur. Balance:{" "}
                        {fromLedger
                          ? renderBalance(
                              fromLedger.currentBalanceAbs,
                              fromLedger.currentBalanceSide,
                              currency.symbol
                            )
                          : "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <SearchableSelect
                        options={ledgerOptions}
                        value={row.toLedgerId}
                        onChange={(newValue) => updateRow(index, "toLedgerId", newValue)}
                        placeholder="Search credit ledger"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Cur. Balance:{" "}
                        {toLedger
                          ? renderBalance(
                              toLedger.currentBalanceAbs,
                              toLedger.currentBalanceSide,
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
          Add Another To/From Row
        </button>
      </VoucherPanel>

      <VoucherPanel title="Narration">
        <textarea
          data-vnav="true"
          className="min-h-24 w-full border border-[#c8d2de] bg-[#fffdf4] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Advance adjusted."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
