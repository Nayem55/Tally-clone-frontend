import { useEffect, useMemo, useRef, useState } from "react";
import { Download, PencilLine, Plus, Search, Trash2, Upload } from "lucide-react";
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

function getInitialForm(fields) {
  return fields.reduce((accumulator, field) => {
    accumulator[field.name] = field.defaultValue || "";
    return accumulator;
  }, { id: "" });
}

export default function MasterDataPage({
  title,
  subtitle,
  endpoint,
  fields,
  parentOptionsEndpoint = "",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [parentOptions, setParentOptions] = useState([]);
  const initialForm = useMemo(() => getInitialForm(fields), [fields]);
  const [form, setForm] = useState(initialForm);
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

  async function loadRows(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    const [rowsResponse, parentResponse] = await Promise.all([
      api.get(`/companies/${selectedCompanyId}/${endpoint}`),
      parentOptionsEndpoint
        ? api.get(`/companies/${selectedCompanyId}/${parentOptionsEndpoint}`)
        : Promise.resolve({ data: [] }),
    ]);
    setRows(rowsResponse.data);
    setParentOptions(parentResponse.data || []);
  }

  useEffect(() => {
    loadRows();
  }, [companyId]);

  useEffect(() => {
    function handleBack(event) {
      if (!location.state?.returnTo) return;
      if (event.key !== "Escape" && event.key !== "Backspace") return;
      const target = event.target;
      const tag = String(target?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select";
      if (event.key === "Backspace" && isTyping) return;
      event.preventDefault();
      navigate(location.state.returnTo, {
        replace: true,
        state: { ...location.state },
      });
    }

    window.addEventListener("keydown", handleBack);
    return () => window.removeEventListener("keydown", handleBack);
  }, [location.state, navigate]);

  async function save() {
    if (!companyId) return;
    const payload = fields.reduce((accumulator, field) => {
      accumulator[field.name] = form[field.name];
      return accumulator;
    }, {});

    try {
      if (form.id) {
        await api.put(`/companies/${companyId}/${endpoint}/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/${endpoint}`, payload);
      }
      if (location.state?.returnTo) {
        navigate(location.state.returnTo, {
          replace: true,
          state: { ...location.state },
        });
        return;
      }
      setForm(initialForm);
      await loadRows();
      setStatus(`${title} saved successfully.`);
    } catch (error) {
      alert(error.response?.data?.message || `Unable to save ${title.toLowerCase()}`);
    }
  }

  async function remove(id) {
    if (!window.confirm(`Delete this ${title.toLowerCase()}?`)) return;
    try {
      await api.delete(`/companies/${companyId}/${endpoint}/${id}`);
      if (form.id === id) setForm(initialForm);
      await loadRows();
    } catch (error) {
      alert(error.response?.data?.message || `Unable to delete ${title.toLowerCase()}`);
    }
  }

  const filteredRows = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase())
  );

  function exportDemoExcel() {
    const headers = fields.map((field) => field.label);
    const demoRow = Object.fromEntries(
      fields.map((field) => {
        if (field.type === "select") {
          const options = field.options || parentOptions;
          return [field.label, options[0]?.name || ""];
        }
        if (field.type === "number") {
          return [field.label, 0];
        }
        return [field.label, ""];
      })
    );
    const referenceSheets = [];
    const selectFields = fields.filter((field) => field.type === "select");
    selectFields.forEach((field) => {
      const options = field.options || parentOptions;
      if (!options?.length) return;
      referenceSheets.push({
        name: `${field.label} Ref`.slice(0, 31),
        rows: options.map((option) => ({ Name: option.name })),
      });
    });
    exportMasterWorkbook({
      sheetName: title.slice(0, 31),
      filename: `${title.replace(/\s+/g, "_")}_demo.xlsx`,
      headers,
      sampleRows: [demoRow],
      instructions: [
        `Fill the ${title} sheet and import it back from this screen.`,
        "Each row creates one master record.",
        "For select columns, use the exact names from the reference sheets.",
      ],
      referenceSheets,
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
      const importedRows = worksheetToObjects(workbook, title.slice(0, 31)).filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      const optionMaps = new Map();
      fields
        .filter((field) => field.type === "select")
        .forEach((field) => {
          const options = field.options || parentOptions;
          optionMaps.set(
            field.name,
            buildNameMap(options, [(row) => row.name, (row) => row.code])
          );
        });

      for (const row of importedRows) {
        const payload = {};
        fields.forEach((field) => {
          const rawValue = row[field.label] ?? row[field.name] ?? "";
          if (field.type === "select") {
            const option = resolveNamedOption(
              optionMaps.get(field.name) || new Map(),
              rawValue,
              field.label
            );
            payload[field.name] = option?._id || "";
            return;
          }
          if (field.type === "number") {
            payload[field.name] = normalizeExcelNumber(rawValue, 0);
            return;
          }
          payload[field.name] = String(rawValue ?? "").trim();
        });
        await api.post(`/companies/${companyId}/${endpoint}`, payload);
      }

      await loadRows();
      setStatus(`${importedRows.length} ${title.toLowerCase()} row(s) imported successfully.`);
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || `Unable to import ${title.toLowerCase()}.`);
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
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                Master maintenance
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
            </div>
            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              label="Company"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {status ? (
              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {status}
              </div>
            ) : null}
            <h2 className="text-lg font-semibold text-slate-900">
              {form.id ? `Alter ${title}` : `Create ${title}`}
            </h2>
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
              {fields.map((field) => {
                if (field.type === "select") {
                  const options = field.options || parentOptions;
                  return (
                    <select
                      key={field.name}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      value={form[field.name]}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [field.name]: event.target.value }))
                      }
                    >
                      <option value="">{field.placeholder || `Select ${field.label}`}</option>
                      {options.map((option) => (
                        <option key={option._id || option.id} value={option._id || option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  );
                }

                return (
                  <input
                    key={field.name}
                    type={field.type || "text"}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    placeholder={field.placeholder || field.label}
                    value={form[field.name]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                );
              })}

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                onClick={save}
              >
                <Plus className="h-4 w-4" />
                {form.id ? `Update ${title}` : `Create ${title}`}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Existing {title}</h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm"
                  placeholder={`Search ${title.toLowerCase()}...`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    {fields.map((field) => (
                      <th key={field.name} className="px-4 py-3 font-medium">
                        {field.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row._id} className="border-t border-slate-100">
                      {fields.map((field) => (
                        <td key={field.name} className="px-4 py-3 text-slate-700">
                          {field.type === "select"
                            ? row.parent?.name || row[field.displayKey || field.name] || "-"
                            : row[field.displayKey || field.name] || "-"}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            onClick={() =>
                              setForm(
                                fields.reduce(
                                  (accumulator, field) => ({
                                    ...accumulator,
                                    id: row._id,
                                    [field.name]:
                                      row[field.name] ||
                                      row[field.displayKey || field.name] ||
                                      "",
                                  }),
                                  { id: row._id }
                                )
                              )
                            }
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                            onClick={() => remove(row._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
