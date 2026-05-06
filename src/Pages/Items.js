import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, ImagePlus, PencilLine, Plus, Trash2, Upload } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import {
  buildNameMap,
  exportMasterWorkbook,
  normalizeExcelNumber,
  readWorkbookFromFile,
  resolveNamedOption,
  worksheetToObjects,
} from "../utils/masterExcel";

const defaultForm = {
  id: "",
  name: "",
  alias: "",
  groupId: "",
  stockCategoryId: "",
  stockCategory: "",
  unitId: "",
  unitOfMeasure: "",
  godownId: "",
  inventoryRole: "standard",
  description: "",
  notes: "",
  picture: "",
  openingQty: "",
  openingRate: "",
  narration: "",
};

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Items() {
  const navigate = useNavigate();
  const location = useLocation();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [stockGroups, setStockGroups] = useState([]);
  const [stockCategories, setStockCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || response.data[0]._id);
      }
    }
    loadCompanies();
  }, []);

  async function loadData(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    await api.get(`/companies/${selectedCompanyId}/masters/overview`);
    const [groupsResponse, itemResponse, categoryResponse, unitsResponse, godownResponse] =
      await Promise.all([
      api.get(`/companies/${selectedCompanyId}/chart-of-accounts/stock-groups`),
      api.get(`/companies/${selectedCompanyId}/items`),
      api.get(`/companies/${selectedCompanyId}/stock-categories`),
      api.get(`/companies/${selectedCompanyId}/units`),
      api.get(`/companies/${selectedCompanyId}/godowns`),
    ]);
    setStockGroups(groupsResponse.data.filter((row) => row.type === "group"));
    setItems(itemResponse.data);
    setStockCategories(categoryResponse.data);
    setUnits(unitsResponse.data);
    setGodowns(godownResponse.data);
  }

  useEffect(() => {
    loadData();
  }, [companyId]);

  useEffect(() => {
    function handleReturnShortcut(event) {
      if (!location.state?.returnTo) return;
      if (event.key !== "Escape" && event.key !== "Backspace") return;
      const target = event.target;
      const tag = String(target?.tagName || "").toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;
      if (event.key === "Backspace" && isTyping) return;
      event.preventDefault();
      navigate(location.state.returnTo, {
        state: { ...location.state },
      });
    }

    window.addEventListener("keydown", handleReturnShortcut);
    return () => window.removeEventListener("keydown", handleReturnShortcut);
  }, [location.state, navigate]);

  const openingValue = useMemo(
    () => (Number(form.openingQty) || 0) * (Number(form.openingRate) || 0),
    [form.openingQty, form.openingRate]
  );

  const categoryOptions = useMemo(() => stockCategories, [stockCategories]);

  const unitOptions = useMemo(() => units, [units]);

  async function saveItem() {
    const payload = {
      ...form,
      groupId: form.groupId,
      stockCategoryId: form.stockCategoryId,
      unitId: form.unitId,
      godownId: form.godownId,
      inventoryRole: form.inventoryRole || "standard",
      openingQty: Number(form.openingQty || 0),
      openingRate: Number(form.openingRate || 0),
      openingValue,
    };

    try {
      if (form.id) {
        await api.put(`/companies/${companyId}/items/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/items`, payload);
      }
      setForm(defaultForm);
      await loadData();
      setStatus("Stock item saved successfully.");
      if (location.state?.returnTo) {
        navigate(location.state.returnTo, {
          state: { ...location.state },
        });
      }
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save stock item");
    }
  }

  async function deleteItem(itemId) {
    if (!window.confirm("Delete this stock item?")) return;
    try {
      await api.delete(`/companies/${companyId}/items/${itemId}`);
      if (form.id === itemId) setForm(defaultForm);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete stock item");
    }
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const encoded = await toBase64(file);
      setForm((current) => ({ ...current, picture: encoded }));
    } catch (error) {
      alert("Unable to read image");
    }
  }

  function exportDemoExcel() {
    const sampleItem = items[0];
    exportMasterWorkbook({
      sheetName: "Stock Items",
      filename: "Stock_Items_demo.xlsx",
      headers: [
        "Item Name",
        "Alias / Barcode",
        "Stock Group",
        "Stock Category",
        "Unit",
        "Godown",
        "Inventory Role",
        "Description",
        "Notes",
        "Opening Qty",
        "Opening Rate",
        "Narration",
      ],
      sampleRows: [
        sampleItem
          ? {
              "Item Name": sampleItem.name,
              "Alias / Barcode": sampleItem.alias || "",
              "Stock Group": sampleItem.group?.name || "",
              "Stock Category":
                sampleItem.stockCategoryMaster?.name || sampleItem.stockCategory || "",
              Unit: sampleItem.unitMaster?.name || sampleItem.unitOfMeasure || "",
              Godown: sampleItem.godownMaster?.name || "",
              "Inventory Role": sampleItem.inventoryRole || "standard",
              Description: sampleItem.description || "",
              Notes: sampleItem.notes || "",
              "Opening Qty": Number(sampleItem.openingQty || 0),
              "Opening Rate": Number(sampleItem.openingRate || 0),
              Narration: sampleItem.narration || "",
            }
          : {
              "Item Name": "",
              "Alias / Barcode": "",
              "Stock Group": stockGroups[0]?.name || "",
              "Stock Category": stockCategories[0]?.name || "",
              Unit: units[0]?.name || "",
              Godown: godowns[0]?.name || "",
              "Inventory Role": "standard",
              Description: "",
              Notes: "",
              "Opening Qty": 0,
              "Opening Rate": 0,
              Narration: "",
            },
      ],
      instructions: [
        "Fill the Stock Items sheet and import it back from this screen.",
        "Each row creates one stock item.",
        "Use exact Stock Group, Stock Category, Unit, and Godown names from the reference sheets.",
        "Inventory Role accepts standard, raw_material, or finished_good.",
        "Picture upload is not part of Excel import in this first version.",
      ],
      referenceSheets: [
        { name: "Stock Groups", rows: stockGroups.map((row) => ({ Name: row.name })) },
        { name: "Stock Categories", rows: stockCategories.map((row) => ({ Name: row.name })) },
        { name: "Units", rows: units.map((row) => ({ Name: row.name, Symbol: row.symbol || "" })) },
        { name: "Godowns", rows: godowns.map((row) => ({ Name: row.name })) },
      ],
    });
  }

  async function importExcelFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !companyId) return;

    setImporting(true);
    setStatus("");
    try {
      const workbook = await readWorkbookFromFile(file);
      const rows = worksheetToObjects(workbook, "Stock Items").filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      const stockGroupMap = buildNameMap(stockGroups, [(row) => row.name]);
      const categoryMap = buildNameMap(stockCategories, [(row) => row.name]);
      const unitMap = buildNameMap(units, [(row) => row.name, (row) => row.symbol]);
      const godownMap = buildNameMap(godowns, [(row) => row.name, (row) => row.alias]);

      for (const row of rows) {
        const stockGroup = resolveNamedOption(stockGroupMap, row["Stock Group"], "Stock Group");
        const stockCategory = row["Stock Category"]
          ? resolveNamedOption(categoryMap, row["Stock Category"], "Stock Category")
          : null;
        const unit = row.Unit ? resolveNamedOption(unitMap, row.Unit, "Unit") : null;
        const godown = row.Godown ? resolveNamedOption(godownMap, row.Godown, "Godown") : null;

        const openingQty = normalizeExcelNumber(row["Opening Qty"], 0);
        const openingRate = normalizeExcelNumber(row["Opening Rate"], 0);

        await api.post(`/companies/${companyId}/items`, {
          name: String(row["Item Name"] || "").trim(),
          alias: String(row["Alias / Barcode"] || "").trim(),
          groupId: stockGroup?._id || stockGroup?.id || "",
          stockCategoryId: stockCategory?._id || "",
          stockCategory: stockCategory?.name || "",
          unitId: unit?._id || "",
          unitOfMeasure: unit?.name || "",
          godownId: godown?._id || "",
          inventoryRole: String(row["Inventory Role"] || "standard").trim() || "standard",
          description: String(row.Description || "").trim(),
          notes: String(row.Notes || "").trim(),
          picture: "",
          openingQty,
          openingRate,
          openingValue: openingQty * openingRate,
          narration: String(row.Narration || "").trim(),
        });
      }

      await loadData();
      setStatus(`${rows.length} stock item row(s) imported successfully.`);
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || "Unable to import stock items.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {status ? (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {status}
            </div>
          ) : null}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <h1 className="mt-4 text-3xl font-bold text-slate-900">
                {form.id ? "Alter Stock Item" : "Create Stock Item"}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Create and alter stock items with barcode aliases, opening quantities, and opening rates.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={exportDemoExcel}
                >
                  <Download className="h-4 w-4" />
                  Export Demo Excel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="h-4 w-4" />
                  {importing ? "Importing..." : "Import Excel"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={importExcelFile}
                />
              </div>
            </div>
            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              label="Company"
              className="w-full max-w-md"
            />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-5">
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Item name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Alias / barcode" value={form.alias} onChange={(event) => setForm((current) => ({ ...current, alias: event.target.value }))} />
            <div className="flex gap-2">
              <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={form.groupId} onChange={(event) => setForm((current) => ({ ...current, groupId: event.target.value }))}>
                <option value="">Select stock group</option>
                {stockGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button type="button" className="rounded-xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={form.stockCategoryId}
              onChange={(event) => {
                const selected = categoryOptions.find((option) => option._id === event.target.value);
                setForm((current) => ({
                  ...current,
                  stockCategoryId: event.target.value,
                  stockCategory: selected?.name || "",
                }));
              }}
            >
              <option value="">Select stock category</option>
              {categoryOptions.map((option) => (
                <option key={option._id} value={option._id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={form.unitId}
              onChange={(event) => {
                const selected = unitOptions.find((option) => option._id === event.target.value);
                setForm((current) => ({
                  ...current,
                  unitId: event.target.value,
                  unitOfMeasure: selected?.name || "",
                }));
              }}
            >
              <option value="">Select unit</option>
              {unitOptions.map((option) => (
                <option key={option._id} value={option._id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={form.inventoryRole}
              onChange={(event) => setForm((current) => ({ ...current, inventoryRole: event.target.value }))}
            >
              <option value="standard">Trading / Standard Item</option>
              <option value="raw_material">Raw Material</option>
              <option value="finished_good">Finished Good</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Basic Details</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1fr_320px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
              <textarea className="min-h-40 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Enter item description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
              <textarea className="min-h-40 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Enter internal notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Picture</label>
              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
                {form.picture ? (
                  <img src={form.picture} alt="Stock item" className="h-40 w-full rounded-2xl object-cover" />
                ) : (
                  <>
                    <ImagePlus className="mb-3 h-8 w-8 text-blue-500" />
                    Drag and drop image here
                    <span className="mt-1 text-xs text-slate-400">or click to browse</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Opening Balance</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <input type="number" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Opening quantity" value={form.openingQty} onChange={(event) => setForm((current) => ({ ...current, openingQty: event.target.value }))} />
            <input type="number" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Opening rate" value={form.openingRate} onChange={(event) => setForm((current) => ({ ...current, openingRate: event.target.value }))} />
            <select
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={form.godownId}
              onChange={(event) => setForm((current) => ({ ...current, godownId: event.target.value }))}
            >
              <option value="">Select default godown</option>
              {godowns.map((godown) => (
                <option key={godown._id} value={godown._id}>
                  {godown.name}
                </option>
              ))}
            </select>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-wide text-slate-400">Opening value</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {openingValue.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <label className="mb-2 block text-sm font-medium text-slate-700">Narration</label>
          <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Enter narration" value={form.narration} onChange={(event) => setForm((current) => ({ ...current, narration: event.target.value }))} />
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setForm(defaultForm)}>
              Cancel
            </button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setForm(defaultForm)}>
              Clear
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50" onClick={saveItem}>
              Save & New
            </button>
            <button type="button" className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700" onClick={saveItem}>
              Save
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Existing Stock Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Stock Group</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 text-right font-medium">Opening Value</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-slate-500">{item.group?.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{item.stockCategoryMaster?.name || item.stockCategory || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{item.unitMaster?.name || item.unitOfMeasure || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{item.inventoryRole || "standard"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {Number(item.openingValue || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() =>
                            setForm({
                              id: item._id,
                              name: item.name,
                              alias: item.alias || "",
                              groupId: item.groupId,
                              stockCategoryId: item.stockCategoryId || item.stockCategoryMaster?._id || "",
                                stockCategory: item.stockCategory || "",
                                unitId: item.unitId || item.unitMaster?._id || "",
                                unitOfMeasure: item.unitOfMeasure || "",
                                godownId: item.godownId || item.godownMaster?._id || "",
                                inventoryRole: item.inventoryRole || "standard",
                                description: item.description || "",
                              notes: item.notes || "",
                              picture: item.picture || "",
                              openingQty: item.openingQty || "",
                              openingRate: item.openingRate || "",
                              narration: item.narration || "",
                            })
                          }
                        >
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => deleteItem(item._id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
