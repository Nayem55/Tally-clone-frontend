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

const inputClass =
  "h-[31px] w-full border border-[#c8d2de] px-2 text-[14px] leading-[31px] outline-none focus:border-[#3f83f8]";

export default function PaymentVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
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

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!companyId || !editVoucherId) return;
      const response = await api.get(`/companies/${companyId}/vouchers/${editVoucherId}`);
      const voucher = response.data;
      const lines = voucher.lines || [];
      const paymentLine = lines.find((line) => Number(line.credit || 0) > 0);
      const rows = lines
        .filter((line) => Number(line.debit || 0) > 0)
        .map((line) => ({
          ledgerId: String(line.ledgerId || ""),
          amount: Number(line.debit || 0) || "",
          narration: "",
        }));

      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date ? String(voucher.date).slice(0, 10) : formatDateForInput(new Date()),
        paymentLedger: String(paymentLine?.ledgerId || ""),
        rows: rows.length > 0 ? rows : [emptyRow],
        narration: voucher.narration || "",
        referenceNo: voucher.referenceNo || "",
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

  async function save(options = {}) {
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

    const payload = {
      voucherTypeId: paymentTypeId,
      voucherName: "Payment",
      number: form.number,
      date: form.date,
      narration: form.narration,
      referenceNo: form.referenceNo,
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
      alert(isEditMode ? "Payment voucher updated" : "Payment voucher saved");
    }
    if (!isEditMode) resetForm();
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
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Voucher No.
            </label>
            <input
              data-vnav="true"
              className={`${inputClass} bg-[#fff7cf]`}
              value={form.number}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, number: event.target.value }))
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Voucher Date
            </label>
            <TallyDateInput
              data-voucher-date="true"
              className={`${inputClass} bg-[#fff7cf]`}
              value={form.date}
              onChange={(nextDate) => setForm((prev) => ({ ...prev, date: nextDate }))}
            />
          </div>

          <div className="relative z-[9999]">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Pay From
            </label>
            <div className="relative h-[31px] z-[9999]">
              <SearchableSelect
                options={ledgerOptions}
                value={form.paymentLedger}
                onChange={(newValue) =>
                  setForm((prev) => ({ ...prev, paymentLedger: newValue }))
                }
                placeholder="Search cash / bank ledger"
              />
            </div>
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
        <div className="overflow-visible border border-[#bccfe3]">
          <table className="min-w-full table-fixed text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="w-[5%] px-4 py-3 font-medium">#</th>
                <th className="w-[35%] px-4 py-3 font-medium">Paid To (Account)</th>
                <th className="w-[20%] px-4 py-3 text-right font-medium">Amount</th>
                <th className="w-[30%] px-4 py-3 font-medium">Narration</th>
                <th className="w-[10%] px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {form.rows.map((row, index) => {
                const ledger = ledgerMap.get(row.ledgerId);

                return (
                  <tr key={index} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4 align-top text-slate-500">
                      <div className="flex h-[31px] items-center">{index + 1}</div>
                    </td>

                    <td className="relative z-50 px-4 py-4 align-top">
                      <div className="relative z-[9999] h-[31px]">
                        <SearchableSelect
                          options={ledgerOptions}
                          value={row.ledgerId}
                          onChange={(newValue) => updateRow(index, "ledgerId", newValue)}
                          placeholder="Search paid-to ledger"
                        />
                      </div>

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

                    <td className="px-4 py-4 align-top">
                      <input
                        data-vnav="true"
                        type="number"
                        className={`${inputClass} bg-[#fff7cf] text-right`}
                        value={row.amount}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
                      />
                    </td>

                    <td className="px-4 py-4 align-top">
                      <input
                        data-vnav="true"
                        className={`${inputClass} bg-[#fffdf4]`}
                        value={row.narration}
                        onChange={(event) => updateRow(index, "narration", event.target.value)}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <VoucherPanel title="Narration">
          <textarea
            data-vnav="true"
            className="min-h-24 w-full border border-[#c8d2de] bg-[#fffdf4] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
            value={form.narration}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, narration: event.target.value }))
            }
            placeholder="Payment for goods purchased."
          />
        </VoucherPanel>

        <VoucherPanel title="Reference">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Reference No.
          </label>
          <input
            data-vnav="true"
            className={`${inputClass} bg-[#fffdf4]`}
            value={form.referenceNo}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, referenceNo: event.target.value }))
            }
          />
        </VoucherPanel>
      </div>
    </VoucherWorkspace>
  );
}
