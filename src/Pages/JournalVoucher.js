import { useEffect, useMemo, useRef, useState } from "react";
import { BookText, Download, Plus, Trash2, Upload } from "lucide-react";
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

const emptyRow = { fromLedgerId: "", toLedgerId: "", amount: "", narration: "" };
const JOURNAL_TEMPLATE_SHEET = "Journal Voucher";
const JOURNAL_VOUCHER_RETURN_STORAGE_KEY = "journal-voucher-return-draft";

export default function JournalVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [journalTypeId, setJournalTypeId] = useState("");
  const [ledgers, setLedgers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const companyName =
    companies.find((entry) => String(entry._id) === String(companyId))?.name || "";
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    narration: "",
    referenceNo: "",
    rows: [emptyRow],
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: journalTypeId,
    companyName,
    voucherLabel: "Journal",
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
      setJournalTypeId(
        voucherResponse.data.find((row) => row.name.toLowerCase() === "journal")?._id || ""
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
        const debitLine = sourceLines[index];
        const creditLine = sourceLines[index + 1];
        rows.push({
          fromLedgerId: String(debitLine?.ledgerId || ""),
          toLedgerId: String(creditLine?.ledgerId || ""),
          amount: Number(debitLine?.debit || creditLine?.credit || 0) || "",
          narration: "",
        });
      }

      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date ? String(voucher.date).slice(0, 10) : formatDateForInput(new Date()),
        narration: voucher.narration || "",
        referenceNo: voucher.referenceNo || "",
        rows: rows.length > 0 ? rows : [emptyRow],
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
    if (!isEditMode && companyId && location.state?.restoreJournalVoucherDraft) {
      try {
        const raw = window.sessionStorage.getItem(JOURNAL_VOUCHER_RETURN_STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (String(draft?.companyId || "") !== String(companyId)) return;
        if (!draft?.form) return;
        setForm(draft.form);
        setStatusMessage(draft.statusMessage || null);
        window.sessionStorage.removeItem(JOURNAL_VOUCHER_RETURN_STORAGE_KEY);
      } catch (error) {
        console.error("Unable to restore journal voucher draft:", error);
      }
    }
  }, [companyId, isEditMode, location.state]);

  const company = companies.find((entry) => String(entry._id) === String(companyId));
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
  const ledgerNameMap = useMemo(
    () => new Map(ledgers.map((ledger) => [normalizeExcelNameKey(ledger.name), ledger])),
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

  function resetForm(nextNumber = suggestedNumber) {
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      narration: "",
      referenceNo: "",
      rows: [emptyRow],
    });
  }

  function navigateToCreateLedger() {
    if (isEditMode) return;
    try {
      window.sessionStorage.setItem(
        JOURNAL_VOUCHER_RETURN_STORAGE_KEY,
        JSON.stringify({
          companyId,
          form,
          statusMessage,
        }),
      );
    } catch (error) {
      console.error("Unable to store journal voucher draft:", error);
    }

    navigate("/masters/create/ledger", {
      state: {
        returnTo: `${location.pathname}${location.search || ""}`,
        restoreJournalVoucherDraft: true,
      },
    });
  }

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ["Journal Voucher Import Template"],
      [""],
      ["From (Debit)", "To (Credit)", "Amount", "Narration"],
      ...padExcelRows([["", "", "", ""]], 8, () => ["", "", "", ""]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 28 }];
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, JOURNAL_TEMPLATE_SHEET);
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
    exportWorkbookToFile(workbook, `${companySlug}-journal-import-template.xlsx`);
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description: "Fill the same structure and import it back to load journal rows into the form.",
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
      const rows = parseWorksheetRows(workbook, JOURNAL_TEMPLATE_SHEET);
      const headerIndex = rows.findIndex(
        (row) =>
          normalizeExcelText(row[0]) === "From (Debit)" &&
          normalizeExcelText(row[1]) === "To (Credit)"
      );
      if (headerIndex === -1) throw new Error("Journal row table is missing.");
      const importedRows = rows
        .slice(headerIndex + 1)
        .map((row) => ({
          fromLedgerName: normalizeExcelText(row[0]),
          toLedgerName: normalizeExcelText(row[1]),
          amount: normalizeExcelText(row[2]),
          narration: normalizeExcelText(row[3]),
        }))
        .filter((row) => row.fromLedgerName || row.toLedgerName || row.amount || row.narration);
      if (!importedRows.length) throw new Error("At least one journal row is required.");
      const resolvedRows = importedRows.map((row, index) => {
        const fromLedger = ledgerNameMap.get(normalizeExcelNameKey(row.fromLedgerName));
        const toLedger = ledgerNameMap.get(normalizeExcelNameKey(row.toLedgerName));
        if (!fromLedger) throw new Error(`Row ${index + 1}: Debit ledger "${row.fromLedgerName}" was not found.`);
        if (!toLedger) throw new Error(`Row ${index + 1}: Credit ledger "${row.toLedgerName}" was not found.`);
        const amount = Number(row.amount || 0);
        if (!(amount > 0)) throw new Error(`Row ${index + 1}: Amount must be greater than 0.`);
        return { fromLedgerId: fromLedger._id, toLedgerId: toLedger._id, amount, narration: row.narration };
      });
      setForm((prev) => ({
        ...prev,
        rows: resolvedRows,
      }));
      setStatusMessage({
        tone: "success",
        title: "Journal rows loaded from Excel",
        description: `${resolvedRows.length} journal row(s) were loaded into the form. Review the header details and save manually.`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description: error?.message || "Unable to import journal voucher from Excel.",
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function save(options = {}) {
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

    const payload = {
      voucherTypeId: journalTypeId,
      voucherName: "Journal",
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
      alert(isEditMode ? "Journal voucher updated" : "Journal voucher saved");
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
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
      extraActions={
        !isEditMode ? (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700"
              onClick={handleExportTemplate}
            >
              <Download className="h-4 w-4" />
              Export Demo Excel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
            >
              <Upload className="h-4 w-4" />
              {importBusy ? "Importing..." : "Import Excel"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
            />
          </>
        ) : null
      }
      >
      {statusMessage ? (
        <section
          className={`border px-4 py-3 text-sm shadow-sm ${
            statusMessage.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <p className="font-semibold">{statusMessage.title}</p>
          <p className="mt-1">{statusMessage.description}</p>
        </section>
      ) : null}
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
            <TallyDateInput
              data-voucher-date="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.date}
              onChange={(nextDate) => setForm((prev) => ({ ...prev, date: nextDate }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Reference No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.referenceNo}
              onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
            />
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Journal Details">
        <div className="overflow-visible border border-[#bccfe3] table-head">
          <table className="min-w-full text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">
                  <div className="flex items-center justify-between gap-3">
                    <span>From (Debit)</span>
                    <button
                      type="button"
                      className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={navigateToCreateLedger}
                    >
                      Add+
                    </button>
                  </div>
                </th>
                <th className="px-4 py-3 font-medium">
                  <div className="flex items-center justify-between gap-3">
                    <span>To (Credit)</span>
                    <button
                      type="button"
                      className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={navigateToCreateLedger}
                    >
                      Add+
                    </button>
                  </div>
                </th>
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
                    <td className="px-4 py-4 text-slate-500 align-top">{index + 1}</td>
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
                    <td className="px-4 py-4 align-top">
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
                    <td className="px-4 py-4 align-top">
                      <input
                        data-vnav="true"
                        type="number"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-right text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.amount}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.narration}
                        onChange={(event) => updateRow(index, "narration", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top text-right">
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
          className="min-h-24 w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Advance adjusted."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
