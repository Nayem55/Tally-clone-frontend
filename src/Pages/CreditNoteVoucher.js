import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, ReceiptText, Trash2, Upload } from "lucide-react";
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

const emptyRow = { itemId: "", qty: "1", rate: "", persistedFromVoucher: false };
const CREDIT_TEMPLATE_SHEET = "Credit Note Voucher";
const CREDIT_NOTE_RETURN_STORAGE_KEY = "credit-note-voucher-return-draft";

export default function CreditNoteVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [creditTypeId, setCreditTypeId] = useState("");
  const [customers, setCustomers] = useState([]);
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
    customerLedger: "",
    returnLedger: "",
    narration: "",
    rows: [emptyRow],
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: creditTypeId,
    companyName,
    voucherLabel: "Credit Note",
    disabled: isEditMode,
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      const [
        voucherResponse,
        customerResponse,
        ledgerResponse,
        itemResponse,
        companyResponse,
      ] = await Promise.all([
        api.get(`/companies/${companyId}/voucher-types`),
        api.get(
          `/companies/${companyId}/ledgers/by-group?names=Sundry Debtors`,
        ),
        api.get(`/companies/${companyId}/ledgers/with-balances`, {
          params: { to: form.date },
        }),
        api.get(`/companies/${companyId}/items`),
        api.get("/companies"),
      ]);
      setCreditTypeId(
        voucherResponse.data.find(
          (row) => row.name.toLowerCase() === "credit note",
        )?._id || "",
      );
      setCustomers(customerResponse.data);
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
        customerLedger: String(debitLine?.ledgerId || ""),
        returnLedger: String(creditLine?.ledgerId || ""),
        narration: voucher.narration || "",
        rows: (voucher.inventoryLines || []).map((line) => ({
          itemId: String(line.itemId || ""),
          qty: String(line.qty || 1),
          rate: Number(line.rate || 0),
          persistedFromVoucher: true,
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

  useEffect(() => {
    if (!isEditMode && companyId && location.state?.restoreCreditNoteVoucherDraft) {
      try {
        const raw = window.sessionStorage.getItem(CREDIT_NOTE_RETURN_STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (String(draft?.companyId || "") !== String(companyId)) return;
        if (!draft?.form) return;
        setForm(draft.form);
        setStatusMessage(draft.statusMessage || null);
        window.sessionStorage.removeItem(CREDIT_NOTE_RETURN_STORAGE_KEY);
      } catch (error) {
        console.error("Unable to restore credit note voucher draft:", error);
      }
    }
  }, [companyId, isEditMode, location.state]);

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
  const customerLedger = ledgerMap.get(form.customerLedger);
  const returnLedger = ledgerMap.get(form.returnLedger);
  const customerOptions = useMemo(
    () =>
      customers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [customers],
  );
  const ledgerOptions = useMemo(
    () => ledgers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [ledgers],
  );
  const itemOptions = useMemo(
    () => items.map((item) => ({ value: item._id, label: item.name })),
    [items],
  );
  const customerNameMap = useMemo(
    () =>
      new Map(
        customers.map((ledger) => [normalizeExcelNameKey(ledger.name), ledger]),
      ),
    [customers],
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
        voucherTypeLabel: "Credit Note",
        voucherSubtitle: "Sales Return Print Preview",
        voucherNumber: form.number,
        voucherDate: form.date,
        partyLabel: "Customer Details",
        partyName: customerLedger?.name || "",
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
            label: "Credit Note Total",
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
      customerLedger,
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
        if (!isEditMode || !rows[index].persistedFromVoucher) {
          rows[index].rate = resolveItemRateByDate(
            itemMap.get(value),
            null,
            prev.date,
          );
        }
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
    if (isEditMode) {
      setForm((prev) => ({
        ...prev,
        date: value,
      }));
      return;
    }
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
      customerLedger: "",
      returnLedger: "",
      narration: "",
      rows: [emptyRow],
    });
  }

  function navigateToCreateMaster(path) {
    if (isEditMode) return;
    try {
      window.sessionStorage.setItem(
        CREDIT_NOTE_RETURN_STORAGE_KEY,
        JSON.stringify({
          companyId,
          form,
          statusMessage,
        }),
      );
    } catch (error) {
      console.error("Unable to store credit note voucher draft:", error);
    }

    navigate(path, {
      state: {
        returnTo: `${location.pathname}${location.search || ""}`,
        restoreCreditNoteVoucherDraft: true,
      },
    });
  }

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ["Credit Note Import Template"],
      [""],
      ["Item Name", "Qty", "Rate"],
      ...padExcelRows([["", "", ""]], 8, () => ["", "", ""]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 14 }];
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, CREDIT_TEMPLATE_SHEET);
    const refs = [
      ["Customer Ledger", "Current Balance"],
      ...customers.map((ledger) => [
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
      `${companySlug}-credit-note-import-template.xlsx`,
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
      const rows = parseWorksheetRows(workbook, CREDIT_TEMPLATE_SHEET);
      const headerIndex = rows.findIndex(
        (row) =>
          normalizeExcelText(row[0]) === "Item Name" &&
          normalizeExcelText(row[1]) === "Qty",
      );
      if (headerIndex === -1)
        throw new Error("Credit note item table is missing.");
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
        title: "Credit note items loaded from Excel",
        description: `${resolvedRows.length} item row(s) were loaded into the form. Review the header details and save manually.`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description:
          error?.message || "Unable to import credit note from Excel.",
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function save(options = {}) {
    if (!creditTypeId) return alert("Credit note type missing");
    if (!form.customerLedger) return alert("Please select customer");
    if (!form.returnLedger) return alert("Please select return ledger");
    if (validRows.length === 0) return alert("Please add at least one item");

    const payload = {
      voucherTypeId: creditTypeId,
      voucherName: "Credit Note",
      number: form.number,
      date: form.date,
      narration: form.narration || "Credit Note",
      lines: [
        { ledgerId: form.customerLedger, debit: totalAmount, credit: 0 },
        { ledgerId: form.returnLedger, debit: 0, credit: totalAmount },
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
      alert(isEditMode ? "Credit note updated" : "Credit note saved");
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
  }

  return (
    <VoucherWorkspace
      title="Credit Note"
      subtitle="Sales return entry with customer ledger suggestions, typed dates, and keyboard flow."
      icon={ReceiptText}
      iconTone="bg-rose-50 text-rose-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Credit Note"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Customer", value: customerLedger?.name || "-" },
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
      auditLogProps={
        isEditMode
          ? {
              companyId,
              voucherId: editVoucherId,
              voucherTitle: "Credit Note",
            }
          : null
      }
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
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">
                Customer
              </label>
              <button
                type="button"
                className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                onClick={() => navigateToCreateMaster("/masters/create/ledger")}
              >
                Add+
              </button>
            </div>
            <SearchableSelect
              options={customerOptions}
              value={form.customerLedger}
              onChange={(newValue) =>
                setForm((prev) => ({ ...prev, customerLedger: newValue }))
              }
              placeholder="Search customer"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {customerLedger
                ? renderBalance(
                    customerLedger.currentBalanceAbs,
                    customerLedger.currentBalanceSide,
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
        <div className="overflow-x-auto overflow-y-visible border border-[#bccfe3]">
          <table className="min-w-[660px] text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">
                  <div className="flex items-center justify-between gap-3">
                    <span>Item Name</span>
                    <button
                      type="button"
                      className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={() =>
                        navigateToCreateMaster("/masters/create/stock-item")
                      }
                    >
                      Add+
                    </button>
                  </div>
                </th>
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
          placeholder="Sales return against customer invoice."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
