import { useEffect, useMemo, useRef, useState } from "react";
import { Download, PencilLine, Plus, Search, Tag, Trash2, Upload } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { canPerformAction, readStoredUser } from "../utils/accessControl";
import {
  exportMasterWorkbook,
  readWorkbookFromFile,
  worksheetToObjects,
} from "../utils/masterExcel";

const defaultForm = {
  id: "",
  code: "",
  name: "",
};

export default function PriceLevels() {
  const navigate = useNavigate();
  const location = useLocation();
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [levels, setLevels] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const currentUser = readStoredUser();
  const canManagePriceLevels = canPerformAction(currentUser?.role, "masters.price.manage");

  useEffect(() => {
    api.get("/companies").then((res) => {
      setCompanies(res.data);
      if (res.data.length > 0) {
        setCompanyId((current) => current || res.data[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (companyId) loadLevels();
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

  const loadLevels = async () => {
    const res = await api.get(`/companies/${companyId}/price-levels`);
    setLevels(res.data);
  };

  const filteredLevels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return levels.filter((level) =>
      `${level.code} ${level.name}`.toLowerCase().includes(query)
    );
  }, [levels, search]);

  const save = async () => {
    if (!canManagePriceLevels) {
      alert("You do not have permission to manage price lists.");
      return;
    }
    try {
      if (form.id) {
        await api.put(`/companies/${companyId}/price-levels/${form.id}`, form);
      } else {
        await api.post(`/companies/${companyId}/price-levels`, form);
      }
      setForm(defaultForm);
      setStatus("Price list saved successfully.");
      await loadLevels();
      if (location.state?.returnTo) {
        navigate(location.state.returnTo, {
          state: { ...location.state },
        });
      }
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save price list");
    }
  };

  const deleteLevel = async (id) => {
    if (!canManagePriceLevels) {
      alert("You do not have permission to delete price lists.");
      return;
    }
    if (!window.confirm("Delete this price level?")) return;
    await api.delete(`/companies/${companyId}/price-levels/${id}`);
    loadLevels();
  };

  function exportDemoExcel() {
    exportMasterWorkbook({
      sheetName: "Price Lists",
      filename: "Price_Lists_demo.xlsx",
      headers: ["Code", "Name"],
      sampleRows: [
        levels[0]
          ? { Code: levels[0].code, Name: levels[0].name }
          : { Code: "", Name: "" },
      ],
      instructions: [
        "Fill the Price Lists sheet and import it back from this screen.",
        "Each row creates one price level.",
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
      const rows = worksheetToObjects(workbook, "Price Lists").filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      for (const row of rows) {
        await api.post(`/companies/${companyId}/price-levels`, {
          code: String(row.Code || "").trim(),
          name: String(row.Name || "").trim(),
        });
      }

      await loadLevels();
      setStatus(`${rows.length} price list row(s) imported successfully.`);
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || "Unable to import price lists.");
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
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
                <Tag className="h-3.5 w-3.5" />
                Pricing master
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Price Lists</h1>
              <p className="mt-2 text-sm text-slate-500">
                Create and alter reusable price levels for item pricing and customer-specific selling rates.
              </p>
            </div>
            <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} label="Company" />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {status ? (
              <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                {status}
              </div>
            ) : null}
            {!canManagePriceLevels ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                This page is in read-only mode for your role. Create, update, delete, and import actions are limited.
              </div>
            ) : null}
            <h2 className="text-lg font-semibold text-slate-900">
              {form.id ? "Alter Price List" : "Create Price List"}
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
                disabled={importing || !canManagePriceLevels}
              >
                <Upload className="h-4 w-4" />
                {importing ? "Importing..." : "Import Excel"}
              </button>
              <input
                disabled={!canManagePriceLevels}
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={importExcelFile}
              />
            </div>

            <div className="mt-5 space-y-4">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                placeholder="Price level code"
                value={form.code}
                disabled={!canManagePriceLevels}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                placeholder="Display name"
                value={form.name}
                disabled={!canManagePriceLevels}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white"
                onClick={save}
                disabled={!canManagePriceLevels}
              >
                <Plus className="h-4 w-4" />
                {form.id ? "Update Price List" : "Create Price List"}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Existing Price Lists</h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  placeholder="Search price list..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLevels.map((level) => (
                    <tr key={level._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{level.code}</td>
                      <td className="px-4 py-3 text-slate-700">{level.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            disabled={!canManagePriceLevels}
                            onClick={() => setForm({ id: level._id, code: level.code, name: level.name })}
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                            disabled={!canManagePriceLevels}
                            onClick={() => deleteLevel(level._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredLevels.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-6 text-center text-sm text-slate-500">
                        No price lists found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
