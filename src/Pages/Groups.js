import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FolderTree, PencilLine, Plus, Search, Trash2, Upload } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import SearchableSelect from "../Component/SearchableSelect";
import {
  buildNameMap,
  exportMasterWorkbook,
  normalizeExcelBoolean,
  readWorkbookFromFile,
  resolveNamedOption,
  worksheetToObjects,
} from "../utils/masterExcel";

const defaultForm = {
  id: "",
  name: "",
  parentId: "",
  nature: "",
  affectsGrossProfit: false,
};

function nameKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

export default function Groups({
  stockOnly = false,
  title = "Groups",
  subtitle = "Build your chart structure for assets, liabilities, income, expenses, and stock classification.",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
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

  async function loadGroups(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    await api.get(`/companies/${selectedCompanyId}/masters/overview`);
    const response = await api.get(`/companies/${selectedCompanyId}/groups`);
    setGroups(response.data);
  }

  useEffect(() => {
    loadGroups();
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
        replace: true,
        state: { ...location.state },
      });
    }

    window.addEventListener("keydown", handleReturnShortcut);
    return () => window.removeEventListener("keydown", handleReturnShortcut);
  }, [location.state, navigate]);

  const sortedGroups = useMemo(
    () => [...groups].sort((left, right) => left.name.localeCompare(right.name)),
    [groups]
  );

  const visibleGroups = useMemo(() => {
    if (!stockOnly) return sortedGroups;
    const allById = new Map(sortedGroups.map((group) => [String(group._id), group]));
    const primary = sortedGroups.find((group) =>
      ["stock-in-trade", "stock in trade", "primary"].includes(nameKey(group.name))
    );
    if (!primary) return [];
    const rootId = String(primary._id);
    const allowed = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      sortedGroups.forEach((group) => {
        const parentId = group.parentId ? String(group.parentId) : "";
        if (parentId && allowed.has(parentId) && !allowed.has(String(group._id))) {
          allowed.add(String(group._id));
          changed = true;
        }
      });
    }
    return sortedGroups.filter((group) => allowed.has(String(group._id)));
  }, [sortedGroups, stockOnly]);

  const rootParentOption = useMemo(() => {
    if (!stockOnly) return null;
    return visibleGroups.find((group) =>
      ["stock-in-trade", "stock in trade", "primary"].includes(nameKey(group.name))
    );
  }, [visibleGroups, stockOnly]);

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return visibleGroups;

    return visibleGroups.filter((group) => {
      const parent = visibleGroups.find(
        (candidate) => String(candidate._id) === String(group.parentId),
      );
      const parentLabel =
        parent?.name ||
        (stockOnly ? rootParentOption?.name || "Stock-in-Trade" : "Primary");

      return [group.name, group.nature, parentLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [searchTerm, visibleGroups, stockOnly, rootParentOption]);

  const selectedParentGroup = useMemo(() => {
    if (!form.parentId) return null;
    return visibleGroups.find((group) => String(group._id) === String(form.parentId)) || null;
  }, [form.parentId, visibleGroups]);

  const effectiveNature = stockOnly
    ? "ASSET"
    : selectedParentGroup?.nature || form.nature;

  const isNatureEditable = !stockOnly && !selectedParentGroup;

  async function saveGroup() {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        parentId: form.parentId || (stockOnly ? rootParentOption?._id || null : null),
        nature: effectiveNature,
        affectsGrossProfit: stockOnly ? false : form.affectsGrossProfit,
      };

      if (form.id) {
        await api.put(`/companies/${companyId}/groups/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/groups`, payload);
      }

      if (location.state?.returnTo) {
        navigate(location.state.returnTo, {
          replace: true,
          state: { ...location.state },
        });
        return;
      }

      setForm(defaultForm);
      await loadGroups();
      setStatus(`${stockOnly ? "Stock group" : "Group"} saved successfully.`);
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save group");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(groupId) {
    if (!window.confirm("Delete this group?")) return;
    try {
      await api.delete(`/companies/${companyId}/groups/${groupId}`);
      if (form.id === groupId) setForm(defaultForm);
      await loadGroups();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete group");
    }
  }

  function exportDemoExcel() {
    const rows = visibleGroups.slice(0, 1).map((group) => ({
      Name: group.name,
      "Parent Group":
        visibleGroups.find((candidate) => String(candidate._id) === String(group.parentId))?.name ||
        (stockOnly ? rootParentOption?.name || "" : "Primary"),
      Nature: group.nature || "ASSET",
      "Affects Gross Profit": group.affectsGrossProfit ? "Yes" : "No",
    }));

    exportMasterWorkbook({
      sheetName: stockOnly ? "Stock Groups" : "Groups",
      filename: `${stockOnly ? "Stock_Groups" : "Groups"}_demo.xlsx`,
      headers: ["Name", "Parent Group", "Nature", "Affects Gross Profit"],
      sampleRows:
        rows.length > 0
          ? rows
          : [
              {
                Name: "",
                "Parent Group": stockOnly ? rootParentOption?.name || "" : "Primary",
                Nature: stockOnly ? "ASSET" : "ASSET",
                "Affects Gross Profit": stockOnly ? "No" : "No",
              },
            ],
      instructions: [
        `Fill the ${stockOnly ? "Stock Groups" : "Groups"} sheet and import it back from this screen.`,
        "Each row creates one group master.",
        stockOnly
          ? "Parent Group must be a stock group under Stock-in-Trade."
          : "Parent Group can be Primary or an existing group name.",
      ],
      referenceSheets: [
        {
          name: "Parent Groups",
          rows: visibleGroups.map((group) => ({ Name: group.name })),
        },
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
      const rows = worksheetToObjects(workbook, stockOnly ? "Stock Groups" : "Groups").filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      const localGroups = [...visibleGroups];
      const groupMap = buildNameMap(localGroups, [(row) => row.name]);

      for (const row of rows) {
        const parentName = String(row["Parent Group"] || "").trim();
        let parentId = null;
        if (parentName) {
          if (!stockOnly && nameKey(parentName) === "primary") {
            parentId = null;
          } else {
            const parent = resolveNamedOption(groupMap, parentName, "Parent Group");
            parentId = parent?._id || null;
          }
        } else if (stockOnly) {
          parentId = rootParentOption?._id || null;
        }

        const payload = {
          name: String(row.Name || "").trim(),
          parentId,
          nature:
            stockOnly
              ? "ASSET"
              : parentId
              ? resolveNamedOption(groupMap, parentName, "Parent Group")?.nature || "ASSET"
              : String(row.Nature || "ASSET").trim().toUpperCase() || "ASSET",
          affectsGrossProfit: stockOnly
            ? false
            : normalizeExcelBoolean(row["Affects Gross Profit"], false),
        };

        const response = await api.post(`/companies/${companyId}/groups`, payload);
        localGroups.push(response.data);
        groupMap.set(nameKey(response.data.name), response.data);
      }

      await loadGroups();
      setStatus(`${rows.length} ${stockOnly ? "stock group" : "group"} row(s) imported successfully.`);
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || "Unable to import groups.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
                <FolderTree className="h-3.5 w-3.5" />
                Master maintenance
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">{subtitle}</p>
            </div>

            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              label="Company"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {status ? (
              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {status}
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {form.id ? `Alter ${stockOnly ? "Stock Group" : "Group"}` : `Create ${stockOnly ? "Stock Group" : "Group"}`}
              </h2>
              {form.id && (
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                  onClick={() => setForm(defaultForm)}
                >
                  Cancel edit
                </button>
              )}
            </div>

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

            <div className="mt-5 space-y-4">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Group name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />

              <SearchableSelect
                className="w-full"
                inputClassName="rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={form.parentId}
                onChange={(newValue) =>
                  setForm((current) => ({ ...current, parentId: newValue }))
                }
                placeholder={stockOnly ? rootParentOption?.name || "Stock-in-Trade" : "Primary group"}
                options={[
                  {
                    value: "",
                    label: stockOnly ? rootParentOption?.name || "Stock-in-Trade" : "Primary group",
                  },
                  ...visibleGroups
                    .filter((group) => group._id !== form.id)
                    .filter((group) => !stockOnly || String(group._id) !== String(rootParentOption?._id))
                    .map((group) => ({
                      value: group._id,
                      label: group.name,
                    })),
                ]}
              />

              {!stockOnly ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Group Nature
                    </label>
                    <SearchableSelect
                      className="w-full"
                      inputClassName={`rounded-xl border border-slate-200 px-4 py-3 text-sm ${
                        isNatureEditable
                          ? "bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          : "cursor-not-allowed bg-slate-50 text-slate-500"
                      }`}
                      value={effectiveNature}
                      onChange={(newValue) =>
                        setForm((current) => ({ ...current, nature: newValue }))
                      }
                      placeholder="Select group nature"
                      options={[
                        { value: "ASSET", label: "Asset" },
                        { value: "LIABILITY", label: "Liability" },
                        { value: "INCOME", label: "Income" },
                        { value: "EXPENSE", label: "Expense" },
                      ]}
                      dataNav={isNatureEditable}
                      disabled={!isNatureEditable}
                    />
                    <p className="text-xs text-slate-500">
                      {isNatureEditable
                        ? "Choose the nature only for a primary group."
                        : `Inherited automatically from parent group: ${selectedParentGroup?.name}.`}
                    </p>
                  </div>
                </>
              ) : null}

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveGroup}
                disabled={saving}
              >
                <Plus className="h-4 w-4" />
                {form.id ? `Update ${stockOnly ? "Stock Group" : "Group"}` : `Create ${stockOnly ? "Stock Group" : "Group"}`}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Existing {stockOnly ? "Stock Groups" : "Groups"}
              </h2>
              <div className="relative mt-4 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder={`Search existing ${stockOnly ? "stock groups" : "groups"}...`}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Nature</th>
                    <th className="px-4 py-3 font-medium">Parent</th>
                    <th className="px-4 py-3 font-medium">Gross Profit</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => {
                    const parent = visibleGroups.find((candidate) => candidate._id === group.parentId);
                    return (
                      <tr key={group._id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">{group.name}</td>
                        <td className="px-4 py-3 text-slate-600">{group.nature}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {parent?.name || (stockOnly ? rootParentOption?.name || "Stock-in-Trade" : "Primary")}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {group.affectsGrossProfit ? "Yes" : "No"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              onClick={() =>
                                setForm({
                                  id: group._id,
                                  name: group.name,
                                  parentId: group.parentId || "",
                                  nature: group.nature,
                                  affectsGrossProfit: Boolean(group.affectsGrossProfit),
                                })
                              }
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => deleteGroup(group._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {visibleGroups.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No {stockOnly ? "stock groups" : "groups"} found for this company yet.
                </div>
              )}

              {visibleGroups.length > 0 && filteredGroups.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No matching {stockOnly ? "stock groups" : "groups"} found for your search.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
