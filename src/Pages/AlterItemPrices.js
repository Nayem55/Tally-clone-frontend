import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, Download, Search, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import SearchableSelect from "../Component/SearchableSelect";
import { canPerformAction, readStoredUser } from "../utils/accessControl";
import {
  exportWorkbookToFile,
  normalizeExcelNameKey,
  normalizeExcelText,
  normalizeImportedExcelDate,
  parseWorksheetRows,
} from "../utils/voucherExcel";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeDateKey(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

function formatDate(value) {
  const key = normalizeDateKey(value);
  if (!key) return "-";
  const [year, month, day] = key.split("-");
  return `${day}-${month}-${year.slice(2)}`;
}

function resolvePriceForDate(item, priceLevelId, effectiveFromDate) {
  const selectedDateKey = normalizeDateKey(effectiveFromDate);
  const normalizedPriceLevelId = priceLevelId ? String(priceLevelId) : "";
  const entries = (item.prices || [])
    .filter(
      (entry) => String(entry.priceLevelId || "") === normalizedPriceLevelId,
    )
    .map((entry) => ({
      ...entry,
      effectiveKey: normalizeDateKey(entry.effectiveFrom),
    }));

  const datedEntries = entries
    .filter(
      (entry) =>
        entry.effectiveKey &&
        (!selectedDateKey || entry.effectiveKey <= selectedDateKey),
    )
    .sort((left, right) => right.effectiveKey.localeCompare(left.effectiveKey));

  if (datedEntries.length > 0) {
    return datedEntries[0];
  }

  const undatedEntry = entries.find((entry) => !entry.effectiveKey);
  return undatedEntry || null;
}

function resolveNextPriceAfterDate(item, priceLevelId, asOnDate) {
  const asOnKey = normalizeDateKey(asOnDate);
  const normalizedPriceLevelId = priceLevelId ? String(priceLevelId) : "";

  return (
    (item.prices || [])
      .filter(
        (entry) => String(entry.priceLevelId || "") === normalizedPriceLevelId,
      )
      .map((entry) => ({
        ...entry,
        effectiveKey: normalizeDateKey(entry.effectiveFrom),
      }))
      .filter(
        (entry) =>
          entry.effectiveKey && (!asOnKey || entry.effectiveKey > asOnKey),
      )
      .sort((left, right) =>
        left.effectiveKey.localeCompare(right.effectiveKey),
      )[0] || null
  );
}

export default function AlterItemPrices() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [rowRates, setRowRates] = useState({});
  const [rowLoadingId, setRowLoadingId] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const fileInputRef = useRef(null);
  const currentUser = readStoredUser();
  const canManagePrices = canPerformAction(currentUser?.role, "masters.price.manage");

  const today = new Date().toISOString().slice(0, 10);
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkPriceLevelId, setBulkPriceLevelId] = useState("");
  const [bulkRate, setBulkRate] = useState("");
  const [asOnDate] = useState(today);
  const [effectiveFrom, setEffectiveFrom] = useState(today);

  useEffect(() => {
    api.get("/companies").then((response) => {
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || response.data[0]._id);
      }
    });
  }, []);

  async function loadData(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    const [groupResponse, itemResponse, priceLevelResponse] = await Promise.all(
      [
        api.get(
          `/companies/${selectedCompanyId}/chart-of-accounts/stock-groups`,
        ),
        api.get(`/companies/${selectedCompanyId}/items`),
        api.get(`/companies/${selectedCompanyId}/price-levels`),
      ],
    );
    setGroups(groupResponse.data.filter((row) => row.type === "group"));
    setItems(itemResponse.data);
    setPriceLevels(priceLevelResponse.data);
    if (!bulkPriceLevelId && priceLevelResponse.data.length > 0) {
      setBulkPriceLevelId(priceLevelResponse.data[0]._id);
    }
  }

  useEffect(() => {
    loadData();
  }, [companyId]);

  async function bulkUpdate() {
    if (!canManagePrices) {
      alert("You do not have permission to update price lists.");
      return;
    }
    if (!bulkPriceLevelId || !bulkRate || !effectiveFrom) {
      alert("Fill price level, rate, and applicable from date");
      return;
    }

    if (!bulkGroupId) {
      alert("Select a group for price update");
      return;
    }

    setLoading(true);
    try {
      await api.put(`/companies/${companyId}/update-prices-by-group`, {
        groupId: bulkGroupId,
        priceLevelId: bulkPriceLevelId,
        rate: Number(bulkRate),
        effectiveFrom,
      });
      setBulkRate("");
      await loadData();
      setStatusMessage({
        tone: "success",
        title: "Group prices updated",
        description: "The selected group's items were updated successfully.",
      });
    } catch (error) {
      alert(error.response?.data?.message || "Price update failed");
    } finally {
      setLoading(false);
    }
  }

  async function updateSingleItem(itemId) {
    if (!canManagePrices) {
      alert("You do not have permission to update item prices.");
      return;
    }
    const rate = rowRates[itemId];
    if (!bulkPriceLevelId || rate === "" || rate === undefined || !effectiveFrom) {
      alert("Select price level, applied from date, and enter a row rate");
      return;
    }

    setRowLoadingId(String(itemId));
    try {
      await api.put(`/companies/${companyId}/update-price-by-item`, {
        itemId,
        priceLevelId: bulkPriceLevelId,
        rate: Number(rate),
        effectiveFrom,
      });
      setRowRates((current) => ({ ...current, [itemId]: "" }));
      await loadData();
      setStatusMessage({
        tone: "success",
        title: "Item price updated",
        description: "The selected item rate was updated successfully.",
      });
    } catch (error) {
      alert(error.response?.data?.message || "Item price update failed");
    } finally {
      setRowLoadingId("");
    }
  }

  const selectedPriceLevel =
    priceLevels.find((level) => level._id === bulkPriceLevelId) ||
    priceLevels[0];

  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) => String(group.id || group._id) === String(bulkGroupId || ""),
      ) || null,
    [groups, bulkGroupId],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const itemGroupId = String(item.group?._id || item.groupId || "");
      if (bulkGroupId && itemGroupId !== String(bulkGroupId))
        return false;
      return `${item.name} ${item.group?.name || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [items, search, bulkGroupId]);

  const hasUpcomingRateView = useMemo(() => {
    const previewIsUpcoming =
      bulkRate !== "" &&
      normalizeDateKey(effectiveFrom) &&
      normalizeDateKey(asOnDate) &&
      normalizeDateKey(effectiveFrom) > normalizeDateKey(asOnDate);

    if (previewIsUpcoming) return true;

    return rows.some((item) =>
      Boolean(
        resolveNextPriceAfterDate(item, selectedPriceLevel?._id, asOnDate),
      ),
    );
  }, [rows, selectedPriceLevel?._id, bulkRate, effectiveFrom, asOnDate]);

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();
    const groupName = selectedGroup?.name || "";
    const priceLevelLabel =
      selectedPriceLevel?.code || selectedPriceLevel?.name || "";
    const sheetRows = [
      ["Price List Import Template"],
      [""],
      ["Company", companies.find((row) => String(row._id) === String(companyId))?.name || ""],
      ["Group", groupName],
      ["Price Level", priceLevelLabel],
      [""],
      ["Item Name", "Group", "Current Rate", "Updated Rate", "Applied From"],
      ...rows.map((item) => {
        const currentEntry = resolvePriceForDate(
          item,
          selectedPriceLevel?._id,
          asOnDate,
        );
        return [
          item.name,
          item.group?.name || "",
          Number(currentEntry?.rate || 0),
          "",
          effectiveFrom,
        ];
      }),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
    sheet["!cols"] = [
      { wch: 34 },
      { wch: 26 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, "Price List");

    const referenceRows = [
      ["Instructions"],
      ["1. Select a group and price level before export."],
      ["2. Fill only Updated Rate for items you want to change."],
      ["3. Applied From can be kept as is or changed per item."],
      ["4. Leave Updated Rate blank for items you do not want to update."],
    ];
    const referenceSheet = XLSX.utils.aoa_to_sheet(referenceRows);
    referenceSheet["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, referenceSheet, "Instructions");
    return workbook;
  }

  function handleExportTemplate() {
    if (!bulkGroupId) {
      alert("Select a group first to export its price list format.");
      return;
    }
    const workbook = buildTemplateWorkbook();
    const companySlug =
      normalizeExcelNameKey(
        companies.find((row) => String(row._id) === String(companyId))?.name ||
          "company",
      ).replace(/[^a-z0-9]+/g, "-") || "company";
    const groupSlug =
      normalizeExcelNameKey(selectedGroup?.name || "group").replace(
        /[^a-z0-9]+/g,
        "-",
      ) || "group";
    exportWorkbookToFile(
      workbook,
      `${companySlug}-${groupSlug}-price-list-template.xlsx`,
    );
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description:
        "Update rates in the sheet and import it back to apply item-wise price changes.",
    });
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!canManagePrices) {
      alert("You do not have permission to import price updates.");
      return;
    }
    if (!bulkGroupId || !bulkPriceLevelId) {
      alert("Select group and price level before importing price updates.");
      return;
    }

    setImportBusy(true);
    setStatusMessage(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const worksheetRows = parseWorksheetRows(workbook, "Price List");
      const headerIndex = worksheetRows.findIndex(
        (row) =>
          normalizeExcelText(row[0]) === "Item Name" &&
          normalizeExcelText(row[3]) === "Updated Rate",
      );
      if (headerIndex === -1) {
        throw new Error("The price list sheet format is invalid.");
      }

      const itemMap = new Map(
        items.map((item) => [normalizeExcelNameKey(item.name), item]),
      );
      const updates = worksheetRows
        .slice(headerIndex + 1)
        .map((row) => ({
          itemName: normalizeExcelText(row[0]),
          updatedRate: normalizeExcelText(row[3]),
          appliedFrom: row[4],
        }))
        .filter((row) => row.itemName && row.updatedRate !== "");

      if (!updates.length) {
        throw new Error("No updated rates were found in the import file.");
      }

      for (const [index, row] of updates.entries()) {
        const item = itemMap.get(normalizeExcelNameKey(row.itemName));
        if (!item) {
          throw new Error(`Row ${index + 1}: Item "${row.itemName}" was not found.`);
        }
        const itemGroupId = String(item.group?._id || item.groupId || "");
        if (itemGroupId !== String(bulkGroupId)) {
          throw new Error(
            `Row ${index + 1}: Item "${row.itemName}" does not belong to the selected group.`,
          );
        }
        const numericRate = Number(row.updatedRate);
        if (!Number.isFinite(numericRate)) {
          throw new Error(`Row ${index + 1}: Updated Rate is invalid.`);
        }
        await api.put(`/companies/${companyId}/update-price-by-item`, {
          itemId: item._id,
          priceLevelId: bulkPriceLevelId,
          rate: numericRate,
          effectiveFrom: normalizeImportedExcelDate(row.appliedFrom || effectiveFrom),
        });
      }

      await loadData();
      setStatusMessage({
        tone: "success",
        title: "Price list imported",
        description: `${updates.length} item rate(s) were updated successfully.`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description: error?.message || "Unable to import price list updates.",
      });
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold text-slate-900">
            Alter Item Prices
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Update price lists in bulk and make the revised rate effective from
            the selected date.
          </p>
          <div className="mt-6 max-w-md">
            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              label="Company"
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={handleExportTemplate}
            >
              <Download className="h-4 w-4" />
              Export Demo Excel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy || !canManagePrices}
            >
              <Upload className="h-4 w-4" />
              {importBusy ? "Importing..." : "Import Excel"}
            </button>
            <input
              disabled={!canManagePrices}
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
            />
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
        {!canManagePrices ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">
            This page is in read-only mode for your role. Group updates, item updates, and import actions are limited.
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Update</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-6">
            {/* Update Mode */}
            <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                Select Group
              </label>
              <SearchableSelect
                className="w-full"
                inputClassName="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={bulkGroupId}
                onChange={(newValue) => {
                  setBulkGroupId(newValue);
                  setSearch("");
                }}
                disabled={!canManagePrices}
                placeholder="Search group"
                options={groups.map((group) => ({
                  value: String(group.id || group._id),
                  label: group.name,
                }))}
              />
            </div>

            {/* Price Level */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Price Level
              </label>

              <select
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={bulkPriceLevelId}
                onChange={(e) => setBulkPriceLevelId(e.target.value)}
              >
                <option value="">Select Price Level</option>
                {priceLevels.map((level) => (
                  <option key={level._id} value={level._id}>
                    {level.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Rate */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Rate
              </label>

              <input
                type="number"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Enter rate"
                value={bulkRate}
                disabled={!canManagePrices}
                onChange={(e) => setBulkRate(e.target.value)}
              />
            </div>

            {/* Applied From */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Applied From
              </label>

              <div className="relative">
                <CalendarRange className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" />

                <input
                  type="date"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={effectiveFrom}
                  disabled={!canManagePrices}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
            </div>

            {/* Button (no label needed) */}
            <div className="flex items-end">
              <button
                type="button"
                className="h-12 w-full rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                onClick={bulkUpdate}
                disabled={loading || !canManagePrices}
              >
                Update Group
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Choose a group to list its items. Use this section to update the whole group, or update a single item directly from the table rows below.
          </p>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Price List - {selectedPriceLevel?.code || "MRP"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                As on: {formatDate(asOnDate)}
              </p>
              {selectedGroup ? (
                <p className="mt-1 text-xs font-medium text-emerald-600">
                  Group filter: {selectedGroup.name}
                </p>
              ) : null}
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Search item..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">S.No.</th>
                  <th className="px-4 py-3 font-medium">Particulars</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  {hasUpcomingRateView ? (
                    <>
                      <th className="px-4 py-3 text-right font-medium">
                        Current Rate
                      </th>
                      <th className="px-4 py-3 font-medium">As on</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Updated Rate
                      </th>
                      <th className="px-4 py-3 font-medium">Effective From</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Effective From</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right font-medium">
                    Cost Price
                  </th>
                  <th className="px-4 py-3 font-medium">Alter Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => {
                  const currentEntry = resolvePriceForDate(
                    item,
                    selectedPriceLevel?._id,
                    asOnDate,
                  );
                  const savedUpcomingEntry = resolveNextPriceAfterDate(
                    item,
                    selectedPriceLevel?._id,
                    asOnDate,
                  );
                  const isPreviewTargetedGroup =
                    bulkGroupId &&
                    String(item.group?._id || item.groupId || "") ===
                      String(bulkGroupId);
                  const previewIsUpcoming =
                    bulkRate !== "" &&
                    isPreviewTargetedGroup &&
                    normalizeDateKey(effectiveFrom) >
                      normalizeDateKey(asOnDate);
                  const previewEntry =
                    previewIsUpcoming && bulkRate !== ""
                      ? {
                          rate: Number(bulkRate || 0),
                          effectiveFrom,
                        }
                      : null;

                  const upcomingEntry = previewEntry || savedUpcomingEntry;
                  const currentRate = Number(currentEntry?.rate || 0);
                  const upcomingRate = Number(upcomingEntry?.rate || 0);
                  const rowHasUpcoming =
                    hasUpcomingRateView &&
                    upcomingEntry &&
                    normalizeDateKey(upcomingEntry.effectiveFrom);
                  const hasCurrentEntry =
                    currentEntry &&
                    (Number(currentEntry?.rate || 0) !== 0 ||
                      Boolean(currentEntry?.effectiveFrom) ||
                      Boolean((item.prices || []).some(
                        (entry) =>
                          String(entry.priceLevelId || "") ===
                          String(selectedPriceLevel?._id || ""),
                      )));
                  const rowRateInput =
                    rowRates[item._id] !== undefined ? rowRates[item._id] : "";

                  return (
                    <tr key={item._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-blue-700">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {item.group?.name || "- -"}
                      </td>
                      {hasUpcomingRateView ? (
                        <>
                          <td className="px-4 py-3 text-right text-slate-800">
                            {hasCurrentEntry ? formatMoney(currentRate) : "- -"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {hasCurrentEntry
                              ? currentEntry?.effectiveFrom
                                ? formatDate(currentEntry.effectiveFrom)
                                : "Opening / Legacy"
                              : "- -"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-800">
                            {rowHasUpcoming ? (
                              <span className="font-semibold text-emerald-600">
                                {formatMoney(upcomingRate)}
                              </span>
                            ) : (
                              "- -"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {rowHasUpcoming
                              ? formatDate(upcomingEntry.effectiveFrom)
                              : "- -"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right text-slate-800">
                            {formatMoney(currentRate)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {currentEntry?.effectiveFrom
                              ? formatDate(currentEntry.effectiveFrom)
                              : "Opening / Legacy"}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatMoney(item.lastPurchaseRate ?? item.openingRate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[220px] items-center gap-2">
                          <input
                            type="number"
                            className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Rate"
                            value={rowRateInput}
                            disabled={!canManagePrices}
                            onChange={(event) =>
                              setRowRates((current) => ({
                                ...current,
                                [item._id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="h-10 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => updateSingleItem(item._id)}
                            disabled={rowLoadingId === String(item._id) || !canManagePrices}
                          >
                            {rowLoadingId === String(item._id)
                              ? "Updating..."
                              : "Update"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            Total Items: {rows.length}
          </div>
        </section>
      </div>
    </div>
  );
}
