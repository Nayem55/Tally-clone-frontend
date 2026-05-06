import { useEffect, useMemo, useRef, useState } from "react";
import { Download, HandCoins, Plus, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";
import {
  exportWorkbookToFile,
  normalizeExcelNameKey,
  normalizeExcelText,
  normalizeImportedExcelDate,
  padExcelRows,
  parseFieldValueMap,
  parseWorksheetRows,
} from "../utils/voucherExcel";

const emptyRow = { ledgerId: "", amount: "", narration: "" };
const PAYMENT_TEMPLATE_SHEET = "Payment Voucher";
const PAYMENT_VOUCHER_RETURN_STORAGE_KEY = "payment-voucher-return-draft";

const inputClass =
  "h-[31px] w-full border border-[#c8d2de] px-2 text-[14px] leading-[31px] outline-none focus:border-[#3f83f8]";

export default function PaymentVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const companyName =
    companies.find((entry) => String(entry._id) === String(companyId))?.name || "";
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    paymentLedger: "",
    rows: [emptyRow],
    narration: "",
    referenceNo: "",
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: paymentTypeId,
    companyName,
    voucherLabel: "Payment",
    disabled: isEditMode,
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

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) => (prev.number ? prev : { ...prev, number: suggestedNumber }));
  }, [suggestedNumber, isEditMode]);

  useEffect(() => {
    if (!isEditMode && companyId && location.state?.restorePaymentVoucherDraft) {
      try {
        const raw = window.sessionStorage.getItem(PAYMENT_VOUCHER_RETURN_STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (String(draft?.companyId || "") !== String(companyId)) return;
        if (!draft?.form) return;
        setForm(draft.form);
        setStatusMessage(draft.statusMessage || null);
        window.sessionStorage.removeItem(PAYMENT_VOUCHER_RETURN_STORAGE_KEY);
      } catch (error) {
        console.error("Unable to restore payment voucher draft:", error);
      }
    }
  }, [companyId, isEditMode, location.state]);

  const company = companies.find((entry) => String(entry._id) === String(companyId));
  const currency = getCompanyCurrency(company);

  const ledgerMap = useMemo(
    () => new Map(ledgers.map((ledger) => [ledger._id, ledger])),
    [ledgers]
  );
  const ledgerNameMap = useMemo(
    () => new Map(ledgers.map((ledger) => [normalizeExcelNameKey(ledger.name), ledger])),
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

  function resetForm(nextNumber = suggestedNumber) {
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      paymentLedger: "",
      rows: [emptyRow],
      narration: "",
      referenceNo: "",
    });
  }

  function navigateToCreateLedger() {
    if (isEditMode) return;
    try {
      window.sessionStorage.setItem(
        PAYMENT_VOUCHER_RETURN_STORAGE_KEY,
        JSON.stringify({
          companyId,
          form,
          statusMessage,
        }),
      );
    } catch (error) {
      console.error("Unable to store payment voucher draft:", error);
    }

    navigate("/masters/create/ledger", {
      state: {
        returnTo: `${location.pathname}${location.search || ""}`,
        restorePaymentVoucherDraft: true,
      },
    });
  }

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ["Payment Voucher Import Template"],
      [""],
      ["Paid To (Account)", "Amount", "Narration"],
      ...padExcelRows([["", "", ""]], 8, () => ["", "", ""]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 34 }, { wch: 14 }, { wch: 28 }];
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, PAYMENT_TEMPLATE_SHEET);
    const refs = [
      ["Ledger Name", "Group", "Current Balance"],
      ...ledgers.map((ledger) => [
        ledger.name,
        ledger.groupName || ledger.parentGroupName || "",
        renderBalance(ledger.currentBalanceAbs, ledger.currentBalanceSide, currency.symbol),
      ]),
    ];
    const refSheet = XLSX.utils.aoa_to_sheet(refs);
    refSheet["!cols"] = [{ wch: 34 }, { wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, refSheet, "Reference Data");
    return workbook;
  }

  function handleExportTemplate() {
    const workbook = buildTemplateWorkbook();
    const companySlug = normalizeExcelNameKey(companyName).replace(/[^a-z0-9]+/g, "-") || "company";
    exportWorkbookToFile(workbook, `${companySlug}-payment-import-template.xlsx`);
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description: "Fill the same structure and import it back to load payment rows into the form.",
    });
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportBusy(true);
    setStatusMessage(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = parseWorksheetRows(workbook, PAYMENT_TEMPLATE_SHEET);
      const headerIndex = rows.findIndex(
        (row) =>
          normalizeExcelText(row[0]) === "Paid To (Account)" &&
          normalizeExcelText(row[1]) === "Amount"
      );
      if (headerIndex === -1) throw new Error("Payment row table is missing.");
      const importedRows = rows
        .slice(headerIndex + 1)
        .map((row) => ({
          ledgerName: normalizeExcelText(row[0]),
          amount: normalizeExcelText(row[1]),
          narration: normalizeExcelText(row[2]),
        }))
        .filter((row) => row.ledgerName || row.amount || row.narration);
      if (!importedRows.length) throw new Error("At least one payment row is required.");
      const resolvedRows = importedRows.map((row, index) => {
        const ledger = ledgerNameMap.get(normalizeExcelNameKey(row.ledgerName));
        if (!ledger) throw new Error(`Row ${index + 1}: Ledger "${row.ledgerName}" was not found.`);
        const amount = Number(row.amount || 0);
        if (!(amount > 0)) throw new Error(`Row ${index + 1}: Amount must be greater than 0.`);
        return { ledgerId: ledger._id, amount, narration: row.narration };
      });
      setForm((prev) => ({
        ...prev,
        rows: resolvedRows,
      }));
      setStatusMessage({
        tone: "success",
        title: "Payment rows loaded from Excel",
        description: `${resolvedRows.length} payment row(s) were loaded into the form. Review the header details and save manually.`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description: error?.message || "The Excel file could not be imported.",
      });
    } finally {
      setImportBusy(false);
    }
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
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
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
      extraActions={
        !isEditMode ? (
          <>
            <button type="button" className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700" onClick={handleExportTemplate}>
              <Download className="h-4 w-4" />
              Export Demo Excel
            </button>
            <button type="button" disabled={importBusy} className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {importBusy ? "Importing..." : "Import Excel"}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          </>
        ) : null
      }
    >
      {statusMessage ? (
        <section className={`border px-4 py-3 text-sm shadow-sm ${statusMessage.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          <p className="font-semibold">{statusMessage.title}</p>
          <p className="mt-1">{statusMessage.description}</p>
        </section>
      ) : null}
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
              Voucher Date
            </label>
            <TallyDateInput
              data-voucher-date="true"
              className={`${inputClass} bg-[#EEF5FF]`}
              value={form.date}
              onChange={(nextDate) => setForm((prev) => ({ ...prev, date: nextDate }))}
            />
          </div>

          <div className="relative z-[9999]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">Pay From</label>
              <button
                type="button"
                className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                onClick={navigateToCreateLedger}
              >
                Add+
              </button>
            </div>
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
                <th className="w-[35%] px-4 py-3 font-medium">
                  <div className="flex items-center justify-between gap-3">
                    <span>Paid To (Account)</span>
                    <button
                      type="button"
                      className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={navigateToCreateLedger}
                    >
                      Add+
                    </button>
                  </div>
                </th>
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
                        className={`${inputClass} bg-[#EEF5FF] text-right`}
                        value={row.amount}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
                      />
                    </td>

                    <td className="px-4 py-4 align-top">
                      <input
                        data-vnav="true"
                        className={`${inputClass} bg-[#EEF5FF]`}
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
            className="min-h-24 w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
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
            className={`${inputClass} bg-[#EEF5FF]`}
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
