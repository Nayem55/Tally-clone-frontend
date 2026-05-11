import { useEffect, useMemo, useRef, useState } from "react";
import { Download, PencilLine, Plus, Search, Trash2, Upload } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import SearchableSelect from "../Component/SearchableSelect";
import {
  exportMasterWorkbook,
  readWorkbookFromFile,
  worksheetToObjects,
} from "../utils/masterExcel";

const defaultForm = {
  id: "",
  name: "",
  category: "ACCOUNTING",
};

export default function VoucherTypesPage({
  title = "Voucher Types",
  subtitle = "Create and alter voucher types used for accounting and inventory transactions.",
}) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [voucherTypes, setVoucherTypes] = useState([]);
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

  async function loadVoucherTypes(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    const response = await api.get(`/companies/${selectedCompanyId}/voucher-types`);
    setVoucherTypes(response.data);
  }

  useEffect(() => {
    loadVoucherTypes();
  }, [companyId]);

  async function saveVoucherType() {
    if (!companyId || !form.name.trim()) {
      alert("Voucher type name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
    };

    try {
      if (form.id) {
        await api.put(`/companies/${companyId}/voucher-types/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/voucher-types`, payload);
      }
      setForm(defaultForm);
      await loadVoucherTypes();
      setStatus("Voucher type saved successfully.");
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save voucher type");
    }
  }

  async function deleteVoucherType(id) {
    if (!window.confirm("Delete this voucher type?")) return;
    try {
      await api.delete(`/companies/${companyId}/voucher-types/${id}`);
      if (form.id === id) setForm(defaultForm);
      await loadVoucherTypes();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete voucher type");
    }
  }

  const filteredVoucherTypes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return voucherTypes.filter((voucherType) =>
      `${voucherType.name} ${voucherType.category}`.toLowerCase().includes(query)
    );
  }, [voucherTypes, search]);

  function exportDemoExcel() {
    exportMasterWorkbook({
      sheetName: "Voucher Types",
      filename: "Voucher_Types_demo.xlsx",
      headers: ["Voucher Type Name", "Category"],
      sampleRows: [
        voucherTypes[0]
          ? {
              "Voucher Type Name": voucherTypes[0].name,
              Category: voucherTypes[0].category || "ACCOUNTING",
            }
          : { "Voucher Type Name": "", Category: "ACCOUNTING" },
      ],
      instructions: [
        "Fill the Voucher Types sheet and import it back from this screen.",
        "Category should be ACCOUNTING or INVENTORY.",
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
      const rows = worksheetToObjects(workbook, "Voucher Types").filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      for (const row of rows) {
        await api.post(`/companies/${companyId}/voucher-types`, {
          name: String(row["Voucher Type Name"] || "").trim(),
          category: String(row.Category || "ACCOUNTING").trim().toUpperCase() || "ACCOUNTING",
        });
      }

      await loadVoucherTypes();
      setStatus(`${rows.length} voucher type row(s) imported successfully.`);
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || "Unable to import voucher types.");
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
                Accounting master
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

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {status ? (
              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {status}
              </div>
            ) : null}
            <h2 className="text-lg font-semibold text-slate-900">
              {form.id ? "Alter Voucher Type" : "Create Voucher Type"}
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
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Voucher type name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />

              <SearchableSelect
                className="w-full"
                inputClassName="rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={form.category}
                onChange={(newValue) =>
                  setForm((current) => ({ ...current, category: newValue }))
                }
                placeholder="Select category"
                options={[
                  { value: "ACCOUNTING", label: "Accounting" },
                  { value: "INVENTORY", label: "Inventory" },
                ]}
              />

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                onClick={saveVoucherType}
              >
                <Plus className="h-4 w-4" />
                {form.id ? "Update Voucher Type" : "Create Voucher Type"}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Existing Voucher Types</h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Search voucher type..."
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
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoucherTypes.map((voucherType) => (
                    <tr key={voucherType._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{voucherType.name}</td>
                      <td className="px-4 py-3 text-slate-500">{voucherType.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() =>
                              setForm({
                                id: voucherType._id,
                                name: voucherType.name,
                                category: voucherType.category || "ACCOUNTING",
                              })
                            }
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => deleteVoucherType(voucherType._id)}
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
