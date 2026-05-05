import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeMinus, Download, Plus, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";
import {
  buildSalesFamilyPrintData,
  previewVoucherDocument,
  printVoucherDocument,
} from "../utils/printVoucher";
import {
  exportWorkbookToFile,
  normalizeExcelNameKey,
  normalizeExcelText,
  normalizeImportedExcelDate,
  padExcelRows,
  parseFieldValueMap,
  parseWorksheetRows,
} from "../utils/voucherExcel";

const emptyRow = { itemId: "", qty: "1", rate: "" };
const DEBIT_TEMPLATE_SHEET = "Debit Note Voucher";

export default function DebitNoteVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const fileInputRef = useRef(null);
  const [debitTypeId, setDebitTypeId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const companyName =
    companies.find((entry) => String(entry._id) === String(companyId))?.name ||
    "";
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    supplierLedger: "",
    returnLedger: "",
    narration: "",
    rows: [emptyRow],
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: debitTypeId,
    companyName,
    voucherLabel: "Debit Note",
    disabled: isEditMode,
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      const [
        voucherResponse,
        supplierResponse,
        ledgerResponse,
        itemResponse,
        companyResponse,
      ] = await Promise.all([
        api.get(`/companies/${companyId}/voucher-types`),
        api.get(
          `/companies/${companyId}/ledgers/by-group?names=Sundry Creditors`,
        ),
        api.get(`/companies/${companyId}/ledgers/with-balances`, {
          params: { to: form.date },
        }),
        api.get(`/companies/${companyId}/items`),
        api.get("/companies"),
      ]);
      setDebitTypeId(
        voucherResponse.data.find(
          (row) => row.name.toLowerCase() === "debit note",
        )?._id || "",
      );
      setSuppliers(supplierResponse.data);
      setLedgers(ledgerResponse.data);
      setItems(itemResponse.data);
      setCompanies(companyResponse.data);
    }
    loadMasters();
  }, [companyId, form.date]);

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!companyId || !editVoucherId || items.length === 0) return;
      const response = await api.get(
        `/companies/${companyId}/vouchers/${editVoucherId}`,
      );
      const voucher = response.data;
      const debitLine = (voucher.lines || []).find(
        (line) => Number(line.debit || 0) > 0,
      );
      const creditLine = (voucher.lines || []).find(
        (line) => Number(line.credit || 0) > 0,
      );

      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date
          ? String(voucher.date).slice(0, 10)
          : formatDateForInput(new Date()),
        supplierLedger: String(creditLine?.ledgerId || ""),
        returnLedger: String(debitLine?.ledgerId || ""),
        narration: voucher.narration || "",
        rows: (voucher.inventoryLines || []).map((line) => ({
          itemId: String(line.itemId || ""),
          qty: String(line.qty || 1),
          rate: Number(line.rate || 0),
        })) || [emptyRow],
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [companyId, editVoucherId, items.length]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) =>
      prev.number ? prev : { ...prev, number: suggestedNumber },
    );
  }, [suggestedNumber, isEditMode]);

  const company = companies.find(
    (entry) => String(entry._id) === String(companyId),
  );
  const currency = getCompanyCurrency(company);
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item._id, item])),
    [items],
  );
  const ledgerMap = useMemo(
    () => new Map(ledgers.map((ledger) => [ledger._id, ledger])),
    [ledgers],
  );
  const supplierLedger = ledgerMap.get(form.supplierLedger);
  const returnLedger = ledgerMap.get(form.returnLedger);
  const supplierOptions = useMemo(
    () =>
      suppliers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [suppliers],
  );
  const ledgerOptions = useMemo(
    () => ledgers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [ledgers],
  );
  const itemOptions = useMemo(
    () => items.map((item) => ({ value: item._id, label: item.name })),
    [items],
  );
  const supplierNameMap = useMemo(
    () =>
      new Map(
        suppliers.map((ledger) => [normalizeExcelNameKey(ledger.name), ledger]),
      ),
    [suppliers],
  );
  const ledgerNameMap = useMemo(
    () =>
      new Map(
        ledgers.map((ledger) => [normalizeExcelNameKey(ledger.name), ledger]),
      ),
    [ledgers],
  );
  const itemNameMap = useMemo(
    () =>
      new Map(items.map((item) => [normalizeExcelNameKey(item.name), item])),
    [items],
  );

  const lineAmount = (row) =>
    Number((Number(row.qty || 0) * Number(row.rate || 0)).toFixed(2));
  const validRows = form.rows.filter(
    (row) => row.itemId && Number(row.qty) > 0,
  );
  const totalAmount = validRows.reduce((sum, row) => sum + lineAmount(row), 0);
  const printData = useMemo(
    () =>
      buildSalesFamilyPrintData({
        company,
        voucherTypeLabel: "Debit Note",
        voucherSubtitle: "Purchase Return Print Preview",
        voucherNumber: form.number,
        voucherDate: form.date,
        partyLabel: "Supplier Details",
        partyName: supplierLedger?.name || "",
        accountLabel: "Return Ledger",
        accountName: returnLedger?.name || "",
        rows: validRows.map((row) => {
          const item = itemMap.get(row.itemId);
          return {
            name: item?.name || "-",
            qty: `${Number(row.qty || 0)}`,
            rate: formatVoucherMoney(row.rate, currency.symbol),
            amount: formatVoucherMoney(lineAmount(row), currency.symbol),
          };
        }),
        totals: [
          {
            label: "Debit Note Total",
            value: formatVoucherMoney(totalAmount, currency.symbol),
            emphasis: true,
          },
        ],
        narration: form.narration,
        currencySymbol:
          `${currency.code || ""} ${currency.symbol || ""}`.trim(),
      }),
    [
      company,
      form.number,
      form.date,
      form.narration,
      supplierLedger,
      returnLedger,
      validRows,
      itemMap,
      currency.symbol,
      currency.code,
      totalAmount,
    ],
  );

  function updateRow(index, key, value) {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      if (key === "itemId") {
        rows[index].rate = resolveItemRateByDate(
          itemMap.get(value),
          null,
          prev.date,
        );
      }
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

  function updateDate(value) {
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) =>
        row.itemId
          ? {
              ...row,
              rate: resolveItemRateByDate(itemMap.get(row.itemId), null, value),
            }
          : row,
      ),
    }));
  }

  function resetForm(nextNumber = suggestedNumber) {
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      supplierLedger: "",
      returnLedger: "",
      narration: "",
      rows: [emptyRow],
    });
  }

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ["Debit Note Import Template"],
      [""],
      ["Item Name", "Qty", "Rate"],
      ...padExcelRows([["", "", ""]], 8, () => ["", "", ""]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 14 }];
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, DEBIT_TEMPLATE_SHEET);
    const refs = [
      ["Supplier Ledger", "Current Balance"],
      ...suppliers.map((ledger) => [
        ledger.name,
        renderBalance(
          ledger.currentBalanceAbs,
          ledger.currentBalanceSide,
          currency.symbol,
        ),
      ]),
      [""],
      ["Return Ledger", "Group"],
      ...ledgers.map((ledger) => [
        ledger.name,
        ledger.groupName || ledger.parentGroupName || "",
      ]),
      [""],
      ["Item Name", "Current Rate"],
      ...items.map((item) => [
        item.name,
        formatVoucherMoney(
          resolveItemRateByDate(item, null, form.date),
          currency.symbol,
        ),
      ]),
    ];
    const refSheet = XLSX.utils.aoa_to_sheet(refs);
    refSheet["!cols"] = [{ wch: 36 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, refSheet, "Reference Data");
    return workbook;
  }

  function handleExportTemplate() {
    const workbook = buildTemplateWorkbook();
    const companySlug =
      normalizeExcelNameKey(companyName).replace(/[^a-z0-9]+/g, "-") ||
      "company";
    exportWorkbookToFile(
      workbook,
      `${companySlug}-debit-note-import-template.xlsx`,
    );
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description:
        "Fill the same structure and import it back to load item rows into the form.",
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
      const rows = parseWorksheetRows(workbook, DEBIT_TEMPLATE_SHEET);
      const headerIndex = rows.findIndex(
        (row) =>
          normalizeExcelText(row[0]) === "Item Name" &&
          normalizeExcelText(row[1]) === "Qty",
      );
      if (headerIndex === -1)
        throw new Error("Debit note item table is missing.");
      const importedRows = rows
        .slice(headerIndex + 1)
        .map((row) => ({
          itemName: normalizeExcelText(row[0]),
          qty: normalizeExcelText(row[1]),
          rate: normalizeExcelText(row[2]),
        }))
        .filter((row) => row.itemName || row.qty || row.rate);
      if (!importedRows.length)
        throw new Error("At least one item row is required.");
      const resolvedRows = importedRows.map((row, index) => {
        const item = itemNameMap.get(normalizeExcelNameKey(row.itemName));
        if (!item)
          throw new Error(
            `Row ${index + 1}: Item "${row.itemName}" was not found.`,
          );
        const qty = Number(row.qty || 0);
        const rate = Number(row.rate || 0);
        if (!(qty > 0))
          throw new Error(`Row ${index + 1}: Qty must be greater than 0.`);
        if (!(rate > 0))
          throw new Error(`Row ${index + 1}: Rate must be greater than 0.`);
        return {
          itemId: item._id,
          qty: String(qty),
          rate,
        };
      });
      setForm((prev) => ({
        ...prev,
        rows: resolvedRows,
      }));
      setStatusMessage({
        tone: "success",
        title: "Debit note items loaded from Excel",
        description: `${resolvedRows.length} item row(s) were loaded into the form. Review the header details and save manually.`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description:
          error?.message || "Unable to import debit note from Excel.",
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function save(options = {}) {
    if (!debitTypeId) return alert("Debit note type missing");
    if (!form.supplierLedger) return alert("Please select supplier");
    if (!form.returnLedger) return alert("Please select return ledger");
    if (validRows.length === 0) return alert("Please add at least one item");

    const payload = {
      voucherTypeId: debitTypeId,
      voucherName: "Debit Note",
      number: form.number,
      date: form.date,
      narration: form.narration || "Debit Note",
      lines: [
        { ledgerId: form.returnLedger, debit: totalAmount, credit: 0 },
        { ledgerId: form.supplierLedger, debit: 0, credit: totalAmount },
      ],
      inventoryLines: validRows.map((row) => ({
        itemId: row.itemId,
        qty: Number(row.qty),
        rate: Number(row.rate),
        amount: lineAmount(row),
      })),
    };
    if (isEditMode) {
      await api.put(
        `/companies/${companyId}/vouchers/${editVoucherId}`,
        payload,
      );
    } else {
      await api.post(`/companies/${companyId}/vouchers`, payload);
    }
    if (options.printAfterSave) {
      await options.printVoucher?.();
    } else {
      alert(isEditMode ? "Debit note updated" : "Debit note saved");
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
  }

  return (
    <VoucherWorkspace
      title="Debit Note"
      subtitle="Purchase return entry with searchable ledgers, item suggestions, and typed dates."
      icon={BadgeMinus}
      iconTone="bg-amber-50 text-amber-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Debit Note"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Supplier", value: supplierLedger?.name || "-" },
        { label: "Return Ledger", value: returnLedger?.name || "-" },
      ]}
      amountSummaryItems={[
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
          tone: "text-emerald-600",
          emphasis: true,
        },
      ]}
      onPreviewPrint={() => previewVoucherDocument(printData)}
      onPrintAfterSave={() => printVoucherDocument(printData)}
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
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Voucher No.
            </label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
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
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.date}
              onChange={updateDate}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Supplier
            </label>
            <SearchableSelect
              options={supplierOptions}
              value={form.supplierLedger}
              onChange={(newValue) =>
                setForm((prev) => ({ ...prev, supplierLedger: newValue }))
              }
              placeholder="Search supplier"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {supplierLedger
                ? renderBalance(
                    supplierLedger.currentBalanceAbs,
                    supplierLedger.currentBalanceSide,
                    currency.symbol,
                  )
                : "-"}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Return Ledger
            </label>
            <SearchableSelect
              options={ledgerOptions}
              value={form.returnLedger}
              onChange={(newValue) =>
                setForm((prev) => ({ ...prev, returnLedger: newValue }))
              }
              placeholder="Search return ledger"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {returnLedger
                ? renderBalance(
                    returnLedger.currentBalanceAbs,
                    returnLedger.currentBalanceSide,
                    currency.symbol,
                  )
                : "-"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Item Details">
        <div className="overflow-hidden border border-[#bccfe3]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Item Name</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-4">
                    <SearchableSelect
                      options={itemOptions}
                      value={row.itemId}
                      onChange={(newValue) =>
                        updateRow(index, "itemId", newValue)
                      }
                      placeholder="Search item"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      data-vnav="true"
                      type="number"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.qty}
                      onChange={(event) =>
                        updateRow(index, "qty", event.target.value)
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      data-vnav="true"
                      type="number"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.rate}
                      onChange={(event) =>
                        updateRow(index, "rate", event.target.value)
                      }
                    />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {formatVoucherMoney(lineAmount(row), currency.symbol)}
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
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Add New Item
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
          placeholder="Purchase return against supplier invoice."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
