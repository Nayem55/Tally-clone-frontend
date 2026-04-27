import { useEffect, useState } from "react";
import { Building2, CalendarDays, PencilLine, Upload } from "lucide-react";
import api from "../api/api";

const defaultForm = {
  id: "",
  name: "",
  financialYearFrom: "",
  booksBeginningFrom: "",
  financialYearTo: "",
  mailingName: "",
  country: "",
  address: "",
  state: "",
  city: "",
  postalCode: "",
  telephone: "",
  mobile: "",
  fax: "",
  email: "",
  website: "",
  division: "",
  baseCurrencySymbol: "TK",
  formalName: "Bangladeshi Taka",
  decimalPlaces: 2,
  incomeTaxNumber: "",
  vatTinNumber: "",
  serviceTaxNumber: "",
  panNumber: "",
  enableInventoryManagement: true,
  enableBillWiseDetails: false,
  enableCostCentres: false,
  enableMultiCurrency: false,
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

export default function CompanyList() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  async function loadCompanies() {
    const response = await api.get("/companies");
    setCompanies(response.data);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (form.financialYearFrom && !form.financialYearTo) {
      const from = new Date(form.financialYearFrom);
      if (!Number.isNaN(from.getTime())) {
        const next = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate() - 1);
        setForm((current) => ({
          ...current,
          financialYearTo: next.toISOString().slice(0, 10),
        }));
      }
    }
  }, [form.financialYearFrom, form.financialYearTo]);

  async function saveCompany() {
    if (!form.name.trim()) {
      alert("Company name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
      };

      if (form.id) {
        await api.put(`/companies/${form.id}`, payload);
      } else {
        await api.post("/companies", payload);
      }

      setForm(defaultForm);
      await loadCompanies();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save company");
    } finally {
      setSaving(false);
    }
  }

  function applyCompany(company) {
    setForm({
      ...defaultForm,
      ...company,
      id: company._id,
      financialYearFrom: toDateInput(company.financialYearFrom),
      booksBeginningFrom: toDateInput(company.booksBeginningFrom),
      financialYearTo: toDateInput(company.financialYearTo),
      enableInventoryManagement: company.options?.enableInventoryManagement !== false,
      enableBillWiseDetails: Boolean(company.options?.enableBillWiseDetails),
      enableCostCentres: Boolean(company.options?.enableCostCentres),
      enableMultiCurrency: Boolean(company.options?.enableMultiCurrency),
    });
  }

  function field(name, value) {
    return {
      value: value ?? "",
      onChange: (event) =>
        setForm((current) => ({ ...current, [name]: event.target.value })),
    };
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <Building2 className="h-3.5 w-3.5" />
                Company master
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                {form.id ? "Alter Company" : "Create Company"}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Only company name is mandatory. Everything else can be completed later.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              Import Company
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Company Name *" {...field("name", form.name)} />
                <input type="date" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" {...field("financialYearFrom", form.financialYearFrom)} />
                <input type="date" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" {...field("booksBeginningFrom", form.booksBeginningFrom)} />
                <input type="date" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" {...field("financialYearTo", form.financialYearTo)} />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Mailing & Address Details</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Mailing Name" {...field("mailingName", form.mailingName)} />
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Country" {...field("country", form.country)} />
                  <textarea className="min-h-36 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:col-span-2" placeholder="Address" {...field("address", form.address)} />
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="State / Province" {...field("state", form.state)} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="City" {...field("city", form.city)} />
                    <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Postal Code" {...field("postalCode", form.postalCode)} />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">Contact Details</h2>
                <div className="mt-4 grid gap-4">
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Telephone" {...field("telephone", form.telephone)} />
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Mobile" {...field("mobile", form.mobile)} />
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Fax" {...field("fax", form.fax)} />
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="E-mail" {...field("email", form.email)} />
                  <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Website" {...field("website", form.website)} />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Company Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Division" {...field("division", form.division)} />
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Base Currency Symbol" {...field("baseCurrencySymbol", form.baseCurrencySymbol)} />
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Formal Name" {...field("formalName", form.formalName)} />
                <select className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={form.decimalPlaces} onChange={(event) => setForm((current) => ({ ...current, decimalPlaces: Number(event.target.value) }))}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Additional Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Income Tax Number" {...field("incomeTaxNumber", form.incomeTaxNumber)} />
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="VAT / TIN Number" {...field("vatTinNumber", form.vatTinNumber)} />
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Service Tax Number" {...field("serviceTaxNumber", form.serviceTaxNumber)} />
                <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="PAN Number" {...field("panNumber", form.panNumber)} />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">More Options</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["enableInventoryManagement", "Enable Inventory Management"],
                  ["enableBillWiseDetails", "Enable Bill-wise Details"],
                  ["enableCostCentres", "Enable Cost Centres"],
                  ["enableMultiCurrency", "Enable Multi-Currency"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [key]: event.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4" />
                Optional details can always be altered later.
              </div>
              <div className="flex gap-3">
                {form.id && (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    onClick={() => setForm(defaultForm)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
                  onClick={saveCompany}
                  disabled={saving}
                >
                  {form.id ? "Update Company" : "Create Company"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Existing Companies</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Mailing Name</th>
                  <th className="px-4 py-3 font-medium">Financial Year</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{company.name}</td>
                    <td className="px-4 py-3 text-slate-500">{company.mailingName || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {company.financialYearFrom || "Not set"} to {company.financialYearTo || "Not set"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {[company.city, company.country].filter(Boolean).join(", ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        onClick={() => applyCompany(company)}
                      >
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </button>
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
