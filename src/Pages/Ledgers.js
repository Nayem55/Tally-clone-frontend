import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Download, PencilLine, Plus, Search, Trash2, Upload } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import SearchableSelect from "../Component/SearchableSelect";
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
  groupId: "",
  openingBalance: "",
  openingDrCr: "DR",
  priceLevelId: "",
  bankDetails: {
    accountHolderName: "",
    accountNumber: "",
    bankCode: "",
    swiftCode: "",
    bankName: "",
    branchName: "",
    branchCode: "",
    bankConfigurationEnabled: false,
    mailingName: "",
    mailingAddress: "",
    division: "",
    country: "",
    postalCode: "",
  },
};

export default function Ledgers() {
  const navigate = useNavigate();
  const location = useLocation();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [groups, setGroups] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
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

  async function loadMasters(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    const [overview, ledgerResponse, priceLevelResponse] = await Promise.all([
      api.get(`/companies/${selectedCompanyId}/masters/overview`),
      api.get(`/companies/${selectedCompanyId}/ledgers`),
      api.get(`/companies/${selectedCompanyId}/price-levels`),
    ]);
    setGroups(overview.data.groups);
    setLedgers(ledgerResponse.data);
    setPriceLevels(priceLevelResponse.data);
  }

  useEffect(() => {
    loadMasters();
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

  const sortedGroups = useMemo(
    () => [...groups].sort((left, right) => left.name.localeCompare(right.name)),
    [groups]
  );

  const groupById = useMemo(
    () => new Map(groups.map((group) => [String(group._id), group])),
    [groups]
  );

  const priceLevelById = useMemo(
    () => new Map(priceLevels.map((level) => [String(level._id), level])),
    [priceLevels]
  );

  const bankAccountGroupIds = useMemo(() => {
    const bankRoots = groups.filter((group) => String(group.name || "").trim().toLowerCase() === "bank accounts");
    if (bankRoots.length === 0) return new Set();

    const childMap = new Map();
    groups.forEach((group) => {
      const parentKey = group.parentId ? String(group.parentId) : "ROOT";
      if (!childMap.has(parentKey)) childMap.set(parentKey, []);
      childMap.get(parentKey).push(group);
    });

    const visited = new Set();
    const stack = bankRoots.map((group) => String(group._id));
    while (stack.length) {
      const currentId = stack.pop();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);
      (childMap.get(currentId) || []).forEach((child) => stack.push(String(child._id)));
    }

    return visited;
  }, [groups]);

  const isBankLedger = useMemo(
    () => bankAccountGroupIds.has(String(form.groupId || "")),
    [bankAccountGroupIds, form.groupId]
  );

  const selectedGroup = useMemo(
    () => groupById.get(String(form.groupId || "")) || null,
    [groupById, form.groupId]
  );

  function updateBankDetail(key, value) {
    setForm((current) => ({
      ...current,
      bankDetails: {
        ...(current.bankDetails || defaultForm.bankDetails),
        [key]: value,
      },
    }));
  }

  async function saveLedger() {
    if (!companyId) return;
    try {
      const payload = {
        name: form.name,
        groupId: form.groupId,
        openingBalance: Number(form.openingBalance || 0),
        openingDrCr: form.openingDrCr,
        priceLevelId: form.priceLevelId || null,
        bankDetails: isBankLedger ? form.bankDetails : null,
      };

      if (form.id) {
        await api.put(`/companies/${companyId}/ledgers/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/ledgers`, payload);
      }

      setForm(defaultForm);
      await loadMasters();
      setStatus("Ledger saved successfully.");
      if (location.state?.returnTo) {
        navigate(location.state.returnTo, {
          state: { ...location.state },
        });
      }
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save ledger");
    }
  }

  const filteredLedgers = useMemo(
    () =>
      ledgers.filter((ledger) =>
        `${ledger.name} ${ledger.group?.name || ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [ledgers, search]
  );

  async function deleteLedger(ledgerId) {
    if (!window.confirm("Delete this ledger?")) return;
    try {
      await api.delete(`/companies/${companyId}/ledgers/${ledgerId}`);
      if (form.id === ledgerId) setForm(defaultForm);
      await loadMasters();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete ledger");
    }
  }

  function exportDemoExcel() {
    const sampleLedger = filteredLedgers[0];
    exportMasterWorkbook({
      sheetName: "Ledgers",
      filename: "Ledgers_demo.xlsx",
      headers: ["Ledger Name", "Group", "Opening Balance", "Opening Type", "Price Level"],
      sampleRows: [
        sampleLedger
          ? {
              "Ledger Name": sampleLedger.name,
              Group: sampleLedger.group?.name || "",
              "Opening Balance": Number(sampleLedger.openingBalance || 0),
              "Opening Type": sampleLedger.openingDrCr || "DR",
              "Price Level":
                priceLevelById.get(String(sampleLedger.priceLevelId))?.code ||
                priceLevelById.get(String(sampleLedger.priceLevelId))?.name ||
                "",
            }
          : {
              "Ledger Name": "",
              Group: sortedGroups[0]?.name || "",
              "Opening Balance": 0,
              "Opening Type": "DR",
              "Price Level": priceLevels[0]?.code || "",
            },
      ],
      instructions: [
        "Fill the Ledgers sheet and import it back from this screen.",
        "Each row creates one ledger.",
        "Use exact group and price level names from the reference sheets.",
      ],
      referenceSheets: [
        { name: "Groups", rows: sortedGroups.map((group) => ({ Name: group.name })) },
        {
          name: "Price Levels",
          rows: priceLevels.map((level) => ({ Code: level.code, Name: level.name })),
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
      const rows = worksheetToObjects(workbook, "Ledgers").filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      const groupMap = buildNameMap(sortedGroups, [(row) => row.name]);
      const priceLevelMap = buildNameMap(priceLevels, [(row) => row.name, (row) => row.code]);

      for (const row of rows) {
        const group = resolveNamedOption(groupMap, row.Group, "Group");
        const priceLevel = row["Price Level"]
          ? resolveNamedOption(priceLevelMap, row["Price Level"], "Price Level")
          : null;

        await api.post(`/companies/${companyId}/ledgers`, {
          name: String(row["Ledger Name"] || "").trim(),
          groupId: group?._id || "",
          openingBalance: normalizeExcelNumber(row["Opening Balance"], 0),
          openingDrCr: String(row["Opening Type"] || "DR").trim().toUpperCase() || "DR",
          priceLevelId: priceLevel?._id || null,
        });
      }

      await loadMasters();
      setStatus(`${rows.length} ledger row(s) imported successfully.`);
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || "Unable to import ledgers.");
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
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                <BookOpen className="h-3.5 w-3.5" />
                Ledger control
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Ledgers</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Maintain customer, supplier, cash, bank, sales, and purchase ledgers with proper opening balances and price-level linkage.
              </p>
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
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {status}
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {form.id ? "Alter Ledger" : "Create Ledger"}
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

            <div className="mt-5 grid gap-4">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Ledger name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />

              <SearchableSelect
                className="w-full"
                inputClassName="rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.groupId}
                onChange={(newValue) => setForm((current) => ({ ...current, groupId: newValue }))}
                placeholder="Select group"
                options={[
                  ...sortedGroups.map((group) => ({
                    value: group._id,
                    label: group.name,
                  })),
                ]}
              />

              <SearchableSelect
                className="w-full"
                inputClassName="rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.priceLevelId}
                onChange={(newValue) =>
                  setForm((current) => ({ ...current, priceLevelId: newValue }))
                }
                placeholder="No price level mapping"
                options={[
                  { value: "", label: "No price level mapping" },
                  ...priceLevels.map((level) => ({
                    value: level._id,
                    label: `${level.code} - ${level.name}`,
                  })),
                ]}
              />

              {isBankLedger ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Bank Account Details</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      This ledger sits under <span className="font-medium text-slate-700">{selectedGroup?.name || "Bank Accounts"}</span>, so bank details are available here automatically.
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="A/c Holder's Name"
                        value={form.bankDetails.accountHolderName}
                        onChange={(event) => updateBankDetail("accountHolderName", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="A/c No."
                        value={form.bankDetails.accountNumber}
                        onChange={(event) => updateBankDetail("accountNumber", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Bank Code"
                        value={form.bankDetails.bankCode}
                        onChange={(event) => updateBankDetail("bankCode", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="SWIFT Code"
                        value={form.bankDetails.swiftCode}
                        onChange={(event) => updateBankDetail("swiftCode", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Bank Name"
                        value={form.bankDetails.bankName}
                        onChange={(event) => updateBankDetail("bankName", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Branch"
                        value={form.bankDetails.branchName}
                        onChange={(event) => updateBankDetail("branchName", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Branch Code"
                        value={form.bankDetails.branchCode}
                        onChange={(event) => updateBankDetail("branchCode", event.target.value)}
                      />
                      <SearchableSelect
                        className="w-full"
                        inputClassName="rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        value={form.bankDetails.bankConfigurationEnabled ? "yes" : "no"}
                        onChange={(newValue) => updateBankDetail("bankConfigurationEnabled", newValue === "yes")}
                        placeholder="Set/Alter Bank configuration"
                        options={[
                          { value: "no", label: "Set/Alter Bank configuration: No" },
                          { value: "yes", label: "Set/Alter Bank configuration: Yes" },
                        ]}
                      />
                    </div>

                    <div className="space-y-4">
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Mailing Name"
                        value={form.bankDetails.mailingName}
                        onChange={(event) => updateBankDetail("mailingName", event.target.value)}
                      />
                      <textarea
                        className="min-h-[96px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Address"
                        value={form.bankDetails.mailingAddress}
                        onChange={(event) => updateBankDetail("mailingAddress", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Division"
                        value={form.bankDetails.division}
                        onChange={(event) => updateBankDetail("division", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Country"
                        value={form.bankDetails.country}
                        onChange={(event) => updateBankDetail("country", event.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Postal Code"
                        value={form.bankDetails.postalCode}
                        onChange={(event) => updateBankDetail("postalCode", event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Opening balance"
                  value={form.openingBalance}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      openingBalance: event.target.value,
                    }))
                  }
                />

                <SearchableSelect
                  className="w-full"
                  inputClassName="rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.openingDrCr}
                  onChange={(newValue) =>
                    setForm((current) => ({ ...current, openingDrCr: newValue }))
                  }
                  placeholder="Select opening type"
                  options={[
                    { value: "DR", label: "Debit" },
                    { value: "CR", label: "Credit" },
                  ]}
                />
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700"
                onClick={saveLedger}
              >
                <Plus className="h-4 w-4" />
                {form.id ? "Update Ledger" : "Create Ledger"}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Existing Ledgers</h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Search ledger..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-4 py-3 font-medium">Opening</th>
                    <th className="px-4 py-3 font-medium">Price Level</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgers.map((ledger) => (
                    <tr key={ledger._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{ledger.name}</td>
                      <td className="px-4 py-3 text-slate-500">{ledger.group?.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {Number(ledger.openingBalance || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {ledger.openingDrCr}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {priceLevelById.get(String(ledger.priceLevelId))?.name ||
                          priceLevelById.get(String(ledger.priceLevelId))?.code ||
                          "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() =>
                              setForm({
                                id: ledger._id,
                                name: ledger.name,
                                groupId: ledger.groupId,
                                openingBalance: ledger.openingBalance,
                                openingDrCr: ledger.openingDrCr,
                                priceLevelId: ledger.priceLevelId || "",
                                bankDetails: {
                                  ...defaultForm.bankDetails,
                                  ...(ledger.bankDetails || {}),
                                },
                              })
                            }
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => deleteLedger(ledger._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLedgers.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No ledgers matched this view.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
