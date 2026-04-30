import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
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

const emptyRow = {
  creditLedgerId: "",
  debitLedgerId: "",
  amount: "",
  narration: "",
};

const inputClass =
  "h-[31px] w-full border border-[#c8d2de] px-2 text-[14px] leading-[31px] outline-none focus:border-[#3f83f8]";

export default function ContraVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const [contraTypeId, setContraTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
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

      setContraTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "contra")?._id || ""
      );
      setLedgers(ledgerResponse.data);
      setCompanies(companyResponse.data);
    }

    loadMasters();
  }, [companyId, form.date]);

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!companyId || !editVoucherId) return;
      const response = await api.get(`/companies/${companyId}/vouchers/${editVoucherId}`);
      const voucher = response.data;
      const rows = [];
      const sourceLines = voucher.lines || [];
      for (let index = 0; index < sourceLines.length; index += 2) {
        const first = sourceLines[index];
        const second = sourceLines[index + 1];
        rows.push({
          creditLedgerId:
            Number(first?.credit || 0) > 0 ? String(first.ledgerId || "") : String(second?.ledgerId || ""),
          debitLedgerId:
            Number(first?.debit || 0) > 0 ? String(first.ledgerId || "") : String(second?.ledgerId || ""),
          amount: Number(first?.credit || second?.credit || first?.debit || second?.debit || 0) || "",
          narration: "",
        });
      }

      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date ? String(voucher.date).slice(0, 10) : formatDateForInput(new Date()),
        rows: rows.length > 0 ? rows : [emptyRow],
        narration: voucher.narration || "",
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [companyId, editVoucherId]);

  const company = companies.find((entry) => entry._id === companyId);
  const currency = getCompanyCurrency(company);

  const ledgerMap = useMemo(
    () => new Map(ledgers.map((ledger) => [ledger._id, ledger])),
    [ledgers]
  );

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
    (row) => row.creditLedgerId && row.debitLedgerId && Number(row.amount) > 0
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
      rows: [emptyRow],
      narration: "",
    });
  }

  async function save(options = {}) {
    if (!contraTypeId) return alert("Contra voucher type missing");
    if (validRows.length === 0) return alert("Please add at least one contra row");

    const lines = validRows.flatMap((row) => [
      { ledgerId: row.creditLedgerId, debit: 0, credit: Number(row.amount) },
      { ledgerId: row.debitLedgerId, debit: Number(row.amount), credit: 0 },
    ]);

    const payload = {
      voucherTypeId: contraTypeId,
      voucherName: "Contra",
      number: form.number,
      date: form.date,
      narration: form.narration,
      lines,
    };

    if (isEditMode) {
      await api.put(`/companies/${companyId}/vouchers/${editVoucherId}`, payload);
    } else {
      await api.post(`/companies/${companyId}/vouchers`, payload);
    }

    if (options.printAfterSave) {
      await options.printVoucher?.();
    } else {
      alert(isEditMode ? "Contra voucher updated" : "Contra voucher saved");
    }
    if (!isEditMode) resetForm();
  }

  return (
    <VoucherWorkspace
      title="Contra Voucher"
      subtitle="Keyboard-first cash and bank transfer entry with searchable ledger selection."
      icon={ArrowRightLeft}
      iconTone="bg-violet-50 text-violet-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Contra Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
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
    >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Voucher No.
            </label>
            <input
              data-vnav="true"
              className={`${inputClass} bg-[#EEF5FF]`}
              value={form.number}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, number: event.target.value }))
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Date
            </label>
            <TallyDateInput
              data-voucher-date="true"
              className={`${inputClass} bg-[#EEF5FF]`}
              value={form.date}
              onChange={(nextDate) => setForm((prev) => ({ ...prev, date: nextDate }))}
            />
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Voucher Details">
        <div className="overflow-visible border border-[#bccfe3]">
          <table className="min-w-full table-fixed text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="w-[4%] px-4 py-3 font-medium">#</th>
                <th className="w-[26%] px-4 py-3 font-medium">Account (Credit)</th>
                <th className="w-[26%] px-4 py-3 font-medium">Contra Account (Debit)</th>
                <th className="w-[18%] px-4 py-3 text-right font-medium">Amount</th>
                <th className="w-[20%] px-4 py-3 font-medium">Narration</th>
                <th className="w-[6%] px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {form.rows.map((row, index) => {
                const creditLedger = ledgerMap.get(row.creditLedgerId);
                const debitLedger = ledgerMap.get(row.debitLedgerId);

                return (
                  <tr key={index} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4 align-top text-slate-500">
                      <div className="flex h-[31px] items-center">{index + 1}</div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="h-[31px]">
                        <SearchableSelect
                          options={ledgerOptions}
                          value={row.creditLedgerId}
                          onChange={(newValue) =>
                            updateRow(index, "creditLedgerId", newValue)
                          }
                          placeholder="Search account"
                        />
                      </div>
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

                    <td className="px-4 py-4 align-top">
                      <div className="h-[31px]">
                        <SearchableSelect
                          options={ledgerOptions}
                          value={row.debitLedgerId}
                          onChange={(newValue) =>
                            updateRow(index, "debitLedgerId", newValue)
                          }
                          placeholder="Search contra account"
                        />
                      </div>
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

                    <td className="px-4 py-4 align-top">
                      <input
                        data-vnav="true"
                        type="number"
                        className={`${inputClass} bg-[#EEF5FF] text-right`}
                        value={row.amount}
                        onChange={(event) =>
                          updateRow(index, "amount", event.target.value)
                        }
                      />
                    </td>

                    <td className="px-4 py-4 align-top">
                      <input
                        data-vnav="true"
                        className={`${inputClass} bg-[#EEF5FF]`}
                        value={row.narration}
                        onChange={(event) =>
                          updateRow(index, "narration", event.target.value)
                        }
                      />
                    </td>

                    <td className="px-4 py-4 align-top text-right">
                      <div className="flex h-[31px] items-center justify-end">
                        {form.rows.length > 1 ? (
                          <button
                            type="button"
                            className="rounded p-2 text-rose-500 hover:bg-rose-50"
                            onClick={() => removeRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
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
          className="min-h-24 w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
          value={form.narration}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, narration: event.target.value }))
          }
          placeholder="Cash deposited into bank account."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
