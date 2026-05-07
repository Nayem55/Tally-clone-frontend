import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Download, FileText, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import SaveVoucherModal from "../Component/SaveVoucherModal";
import TallyDateInput from "../Component/TallyDateInput";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import { previewVoucherNode, printVoucherNode } from "../utils/printVoucher";
import { resolveItemRateByDate } from "../utils/pricing";
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

function getVoucherMode(voucherName) {
  const key = voucherName.toLowerCase();
  if (key === "stock journal") return "transfer";
  if (key === "delivery note") return "outward";
  return "inward";
}

export default function InventoryVoucherPage({
  voucherName,
  editVoucherId = "",
  companyIdOverride = "",
}) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const mode = getVoucherMode(voucherName);
  const { companyId, selectedCompany } = useActiveCompany();
  const effectiveCompanyId = companyIdOverride || companyId;
  const companyName = selectedCompany?.name || "";
  const isEditMode = Boolean(editVoucherId);
  const [voucherTypeId, setVoucherTypeId] = useState("");
  const [items, setItems] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    narration: "",
    rows: [
      {
        itemId: "",
        qty: "1",
        rate: "",
        amount: "",
        godownId: "",
        toGodownId: "",
      },
    ],
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId: effectiveCompanyId,
    voucherTypeId,
    companyName,
    voucherLabel: voucherName,
    disabled: isEditMode,
  });
  const inventoryReturnStorageKey = useMemo(
    () =>
      `inventory-voucher-return-draft-${normalizeExcelNameKey(voucherName).replace(/[^a-z0-9]+/g, "-")}`,
    [voucherName],
  );

  useEffect(() => {
    async function loadData() {
      if (!effectiveCompanyId) return;
      setLoading(true);
      try {
        const [voucherTypeResponse, itemsResponse, godownsResponse] = await Promise.all([
          api.get(`/companies/${effectiveCompanyId}/voucher-types`),
          api.get(`/companies/${effectiveCompanyId}/items`),
          api.get(`/companies/${effectiveCompanyId}/godowns`),
        ]);
        const match = voucherTypeResponse.data.find(
          (row) => row.name.toLowerCase() === voucherName.toLowerCase()
        );
        setVoucherTypeId(match?._id || "");
        setItems(itemsResponse.data);
        setGodowns(godownsResponse.data);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [effectiveCompanyId, voucherName]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) => (prev.number ? prev : { ...prev, number: suggestedNumber }));
  }, [suggestedNumber, isEditMode]);

  useEffect(() => {
    if (!isEditMode && effectiveCompanyId && location.state?.restoreInventoryVoucherDraft) {
      try {
        const raw = window.sessionStorage.getItem(inventoryReturnStorageKey);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (String(draft?.companyId || "") !== String(effectiveCompanyId)) return;
        if (!draft?.form) return;
        setForm(draft.form);
        setStatusMessage(draft.statusMessage || null);
        window.sessionStorage.removeItem(inventoryReturnStorageKey);
      } catch (error) {
        console.error("Unable to restore inventory voucher draft:", error);
      }
    }
  }, [effectiveCompanyId, inventoryReturnStorageKey, isEditMode, location.state]);

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!effectiveCompanyId || !editVoucherId) return;
      const response = await api.get(`/companies/${effectiveCompanyId}/vouchers/${editVoucherId}`);
      const voucher = response.data;
      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date ? String(voucher.date).slice(0, 10) : formatDateForInput(new Date()),
        narration: voucher.narration || "",
        rows:
          (voucher.inventoryLines || []).map((line) => ({
            itemId: String(line.itemId || ""),
            qty: String(line.qty || 1),
            rate: Number(line.rate || 0),
            amount: String(line.amount || ""),
            godownId: String(line.godownId || ""),
            toGodownId: String(line.toGodownId || ""),
          })) || [
            {
              itemId: "",
              qty: "1",
              rate: "",
              amount: "",
              godownId: "",
              toGodownId: "",
            },
          ],
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [effectiveCompanyId, editVoucherId]);

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector("[data-voucher-date='true']");
      target?.focus();
      target?.select?.();
    });
    return () => window.cancelAnimationFrame(handle);
  }, []);

  const validRows = useMemo(
    () => form.rows.filter((row) => row.itemId && Number(row.qty || 0) > 0),
    [form.rows]
  );
  const itemNameMap = useMemo(
    () => new Map(items.map((item) => [normalizeExcelNameKey(item.name), item])),
    [items]
  );
  const godownNameMap = useMemo(
    () => new Map(godowns.map((godown) => [normalizeExcelNameKey(godown.name), godown])),
    [godowns]
  );

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };

      if (key === "itemId" && value) {
        const item = items.find((entry) => entry._id === value);
        const rate = resolveItemRateByDate(item, null, prev.date);
        rows[index].rate = rate;
      }

      rows[index].amount = (
        Number(rows[index].qty || 0) * Number(rows[index].rate || 0)
      ).toFixed(2);

      if (key === "itemId" && value && index === rows.length - 1) {
        rows.push({
          itemId: "",
          qty: "1",
          rate: "",
          amount: "",
          godownId: "",
          toGodownId: "",
        });
      }

      return { ...prev, rows };
    });
  };

  const updateVoucherDate = (value) => {
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) => {
        if (!row.itemId) return row;
        const item = items.find((entry) => entry._id === row.itemId);
        const rate = resolveItemRateByDate(item, null, value);
        return {
          ...row,
          rate,
          amount: (Number(row.qty || 0) * Number(rate || 0)).toFixed(2),
        };
      }),
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  function resetForm(nextNumber = suggestedNumber) {
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      narration: "",
      rows: [
        {
          itemId: "",
          qty: "1",
          rate: "",
          amount: "",
          godownId: "",
          toGodownId: "",
        },
      ],
    });
  }

  function navigateToCreateMaster(path) {
    if (isEditMode) return;
    try {
      window.sessionStorage.setItem(
        inventoryReturnStorageKey,
        JSON.stringify({
          companyId: effectiveCompanyId,
          form,
          statusMessage,
        }),
      );
    } catch (error) {
      console.error("Unable to store inventory voucher draft:", error);
    }

    navigate(path, {
      state: {
        returnTo: `${location.pathname}${location.search || ""}`,
        restoreInventoryVoucherDraft: true,
      },
    });
  }

  function getTemplateSheetName() {
    return `${voucherName} Voucher`;
  }

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();
    const rowHeader =
      mode === "transfer"
        ? ["Item Name", "Qty", "Rate", "Godown", "To Godown"]
        : ["Item Name", "Qty", "Rate", "Godown"];
    const rows = [
      [`${voucherName} Import Template`],
      [""],
      ["Field", "Value"],
      ["Voucher No.", suggestedNumber || ""],
      ["Voucher Date", form.date],
      ["Narration", `Imported from Excel - ${voucherName}`],
      [""],
      ["Rows"],
      rowHeader,
      ...padExcelRows([rowHeader.map(() => "")], 8, () => rowHeader.map(() => "")),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = rowHeader.map(() => ({ wch: 24 }));
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: rowHeader.length - 1 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, getTemplateSheetName());
    const refs = [
      ["Item Name", "Current Rate"],
      ...items.map((item) => [item.name, resolveItemRateByDate(item, null, form.date)]),
      [""],
      ["Godown Name"],
      ...godowns.map((godown) => [godown.name]),
    ];
    const refSheet = XLSX.utils.aoa_to_sheet(refs);
    refSheet["!cols"] = [{ wch: 34 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, refSheet, "Reference Data");
    return workbook;
  }

  function handleExportTemplate() {
    const workbook = buildTemplateWorkbook();
    const companySlug = normalizeExcelNameKey(companyName).replace(/[^a-z0-9]+/g, "-") || "company";
    const voucherSlug = normalizeExcelNameKey(voucherName).replace(/[^a-z0-9]+/g, "-") || "voucher";
    exportWorkbookToFile(workbook, `${companySlug}-${voucherSlug}-import-template.xlsx`);
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description: `Fill the same structure and import it back to create a ${voucherName}.`,
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
      const rows = parseWorksheetRows(workbook, getTemplateSheetName());
      const fieldMap = parseFieldValueMap(rows, ["Field", "Rows", "Item Name"]);
      const headerIndex = rows.findIndex(
        (row) =>
          normalizeExcelText(row[0]) === "Item Name" &&
          normalizeExcelText(row[1]) === "Qty"
      );
      if (headerIndex === -1) throw new Error("Inventory row table is missing.");
      const importedRows = rows
        .slice(headerIndex + 1)
        .map((row) => ({
          itemName: normalizeExcelText(row[0]),
          qty: normalizeExcelText(row[1]),
          rate: normalizeExcelText(row[2]),
          godownName: normalizeExcelText(row[3]),
          toGodownName: normalizeExcelText(row[4]),
        }))
        .filter((row) => row.itemName || row.qty || row.rate || row.godownName || row.toGodownName);
      if (!importedRows.length) throw new Error("At least one inventory row is required.");
      const resolvedRows = importedRows.map((row, index) => {
        const item = itemNameMap.get(normalizeExcelNameKey(row.itemName));
        if (!item) throw new Error(`Row ${index + 1}: Item "${row.itemName}" was not found.`);
        const godown = row.godownName
          ? godownNameMap.get(normalizeExcelNameKey(row.godownName))
          : null;
        if (row.godownName && !godown) {
          throw new Error(`Row ${index + 1}: Godown "${row.godownName}" was not found.`);
        }
        const toGodown = row.toGodownName
          ? godownNameMap.get(normalizeExcelNameKey(row.toGodownName))
          : null;
        if (row.toGodownName && !toGodown) {
          throw new Error(`Row ${index + 1}: To Godown "${row.toGodownName}" was not found.`);
        }
        const qty = Number(row.qty || 0);
        const rate = Number(row.rate || resolveItemRateByDate(item, null, form.date) || 0);
        if (!(qty > 0)) throw new Error(`Row ${index + 1}: Qty must be greater than 0.`);
        if (!(rate >= 0)) throw new Error(`Row ${index + 1}: Rate is invalid.`);
        return {
          itemId: item._id,
          itemName: item.name,
          qty,
          rate,
          amount: Number((qty * rate).toFixed(2)),
          godownId: godown?._id || "",
          godownName: godown?.name || "",
          toGodownId: toGodown?._id || "",
          toGodownName: toGodown?.name || "",
        };
      });
      const payload = {
        voucherTypeId,
        voucherName,
        number:
          normalizeExcelText(fieldMap.get("Voucher No.")) || (await refreshSuggestedNumber()),
        date: normalizeImportedExcelDate(fieldMap.get("Voucher Date")),
        narration: normalizeExcelText(fieldMap.get("Narration")) || voucherName,
        lines: [],
        inventoryLines: resolvedRows,
      };
      await api.post(`/companies/${effectiveCompanyId}/vouchers`, payload);
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
      setStatusMessage({
        tone: "success",
        title: `${voucherName} imported successfully`,
        description: `${payload.number} was created with ${resolvedRows.length} inventory row(s).`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description: error?.message || `Unable to import ${voucherName} from Excel.`,
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function save(options = {}) {
    if (!voucherTypeId) return alert("Voucher type is missing");
    if (validRows.length === 0) return alert("Please add at least one stock line");

    const inventoryLines = validRows.map((row) => {
      const item = items.find((entry) => entry._id === row.itemId);
      const sourceGodown = godowns.find((entry) => entry._id === row.godownId);
      const targetGodown = godowns.find((entry) => entry._id === row.toGodownId);
      return {
        itemId: row.itemId,
        itemName: item?.name || "",
        qty: Number(row.qty || 0),
        rate: Number(row.rate || 0),
        amount: Number(row.amount || 0),
        godownId: row.godownId || "",
        godownName: sourceGodown?.name || "",
        toGodownId: row.toGodownId || "",
        toGodownName: targetGodown?.name || "",
      };
    });

    const body = {
      voucherTypeId,
      voucherName,
      number: form.number,
      date: form.date,
      narration: form.narration || voucherName,
      lines: [],
      inventoryLines,
    };

    try {
      const payload = { ...body, voucherName };
      if (isEditMode) {
        await api.put(`/companies/${effectiveCompanyId}/vouchers/${editVoucherId}`, payload);
      } else {
        await api.post(`/companies/${effectiveCompanyId}/vouchers`, payload);
      }
      if (options.printAfterSave) {
        await options.printVoucher?.();
      } else {
        alert(isEditMode ? `${voucherName} updated successfully` : `${voucherName} saved successfully`);
      }
      if (!isEditMode) {
        const nextNumber = await refreshSuggestedNumber();
        resetForm(nextNumber);
      }
    } catch (error) {
      alert(error.response?.data?.message || `Unable to save ${voucherName}`);
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading {voucherName}...</div>;
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
                <FileText className="h-8 w-8 text-blue-600" />
                {voucherName}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Maintain inventory movement with item, quantity, rate, and godown details.
              </p>
            </div>
            {!isEditMode ? (
              <div className="flex flex-wrap items-start justify-end gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                  onClick={handleExportTemplate}
                >
                  <Download className="h-4 w-4" />
                  Export Demo Excel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
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
              </div>
            ) : null}
          </div>
        </section>

        {statusMessage ? (
          <section
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              statusMessage.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <p className="font-semibold">{statusMessage.title}</p>
            <p className="mt-1">{statusMessage.description}</p>
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Voucher No"
              value={form.number}
              onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
            />
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <TallyDateInput
                data-voucher-date="true"
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm"
                value={form.date}
                onChange={updateVoucherDate}
              />
            </div>
            <textarea
              rows="1"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Narration"
              value={form.narration}
              onChange={(event) => setForm((current) => ({ ...current, narration: event.target.value }))}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    <div className="flex items-center justify-between gap-3">
                      <span>Item</span>
                      <button
                        type="button"
                        className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        onClick={() => navigateToCreateMaster("/masters/create/stock-item")}
                      >
                        Add+
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">
                    <div className="flex items-center justify-between gap-3">
                      <span>Godown</span>
                      <button
                        type="button"
                        className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        onClick={() => navigateToCreateMaster("/masters/create/godown")}
                      >
                        Add+
                      </button>
                    </div>
                  </th>
                  {mode === "transfer" ? (
                    <th className="px-4 py-3 font-medium">
                      <div className="flex items-center justify-between gap-3">
                        <span>To Godown</span>
                        <button
                          type="button"
                          className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          onClick={() => navigateToCreateMaster("/masters/create/godown")}
                        >
                          Add+
                        </button>
                      </div>
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {form.rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={row.itemId}
                        onChange={(event) => updateRow(index, "itemId", event.target.value)}
                      >
                        <option value="">Select item</option>
                        {items.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        className="w-28 rounded-lg border border-slate-200 px-3 py-2"
                        value={row.qty}
                        onChange={(event) => updateRow(index, "qty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        className="w-32 rounded-lg border border-slate-200 px-3 py-2"
                        value={row.rate}
                        onChange={(event) => updateRow(index, "rate", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={row.godownId}
                        onChange={(event) => updateRow(index, "godownId", event.target.value)}
                      >
                        <option value="">Select godown</option>
                        {godowns.map((godown) => (
                          <option key={godown._id} value={godown._id}>
                            {godown.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {mode === "transfer" ? (
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          value={row.toGodownId}
                          onChange={(event) => updateRow(index, "toGodownId", event.target.value)}
                        >
                          <option value="">Select target godown</option>
                          {godowns.map((godown) => (
                            <option key={godown._id} value={godown._id}>
                              {godown.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {Number(row.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.itemId && form.rows.length > 1 ? (
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
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
            onClick={() => previewVoucherNode(containerRef.current, voucherName)}
          >
            Print Preview
          </button>
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white"
            onClick={() => setShowSaveConfirm(true)}
          >
            Save {voucherName}
          </button>
        </section>
      </div>

      <SaveVoucherModal
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onSave={async () => {
          setShowSaveConfirm(false);
          await save();
        }}
        onSaveAndPrint={async () => {
          setShowSaveConfirm(false);
          await save({
            printAfterSave: true,
            printVoucher: () => printVoucherNode(containerRef.current, voucherName),
          });
        }}
        title={`Save ${voucherName}?`}
        description={`We are ready to post this ${voucherName.toLowerCase()}. You can save it now or save and open a printable copy immediately.`}
      />
    </div>
  );
}
