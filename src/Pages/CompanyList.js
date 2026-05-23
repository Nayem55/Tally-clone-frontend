import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, PencilLine, Upload } from "lucide-react";
import { useLocation } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";

const defaultCurrencies = [
  { code: "BDT", symbol: "TK", name: "Bangladeshi Taka", decimalPlaces: 2 },
  { code: "INR", symbol: "Rs", name: "Indian Rupee", decimalPlaces: 2 },
  { code: "USD", symbol: "$", name: "US Dollar", decimalPlaces: 2 },
  { code: "EUR", symbol: "EUR", name: "Euro", decimalPlaces: 2 },
];

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
  baseCurrencyCode: "BDT",
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
  requireCompanyLogin: false,
  masterUsername: "",
  masterPassword: "",
  confirmMasterPassword: "",
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

export default function CompanyList() {
  const location = useLocation();
  const { companyId } = useActiveCompany();
  const [companies, setCompanies] = useState([]);
  const [currencies, setCurrencies] = useState(defaultCurrencies);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const isAlterMode = useMemo(
    () => location.pathname.includes("/company/alter"),
    [location.pathname],
  );

  async function loadCompanies() {
    const response = await api.get("/companies");
    setCompanies(response.data);
    return response.data || [];
  }

  useEffect(() => {
    async function loadInitialCompanies() {
      const rows = await loadCompanies();
      if (!isAlterMode || !companyId) return;
      const currentCompany =
        rows.find((company) => String(company._id) === String(companyId)) || null;
      if (currentCompany) {
        applyCompany(currentCompany);
      }
    }
    loadInitialCompanies();
  }, [companyId, isAlterMode]);

  useEffect(() => {
    async function loadReferenceCurrencies() {
      const allCompanies = await api.get("/companies");
      const firstCompanyId = allCompanies.data?.[0]?._id;
      if (!firstCompanyId) return;
      try {
        const response = await api.get(`/companies/${firstCompanyId}/currencies`);
        if (response.data.length > 0) {
          setCurrencies((current) => {
            const merged = [...current];
            response.data.forEach((currency) => {
              if (!merged.some((entry) => entry.code === currency.code)) {
                merged.push(currency);
              }
            });
            return merged;
          });
        }
      } catch (_error) {
        // keep defaults when no company currencies exist yet
      }
    }
    loadReferenceCurrencies();
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
    if (form.requireCompanyLogin) {
      if (!form.masterUsername.trim()) {
        alert("Master username is required when company login is enabled");
        return;
      }
      if (!form.id && !form.masterPassword) {
        alert("Master password is required when company login is enabled");
        return;
      }
      if (form.masterPassword !== form.confirmMasterPassword) {
        alert("Master password and confirm password must match");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        masterUsername: form.masterUsername.trim(),
      };

      if (form.id) {
        await api.put(`/companies/${form.id}`, payload);
      } else {
        await api.post("/companies", payload);
      }

      const rows = await loadCompanies();
      if (isAlterMode && companyId) {
        const currentCompany =
          rows.find((company) => String(company._id) === String(companyId)) || null;
        if (currentCompany) {
          applyCompany(currentCompany);
          return;
        }
      }
      setForm(defaultForm);
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save company");
    } finally {
      setSaving(false);
    }
  }

  function applyCompany(company) {
    if (
      company.baseCurrencyCode &&
      !currencies.some((currency) => currency.code === company.baseCurrencyCode)
    ) {
      setCurrencies((current) => [
        ...current,
        {
          code: company.baseCurrencyCode,
          symbol: company.baseCurrencySymbol,
          name: company.formalName,
          decimalPlaces: company.decimalPlaces || 2,
        },
      ]);
    }

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
      requireCompanyLogin: Boolean(company.requiresCompanyLogin),
      masterUsername: company.masterUsername || "",
      masterPassword: "",
      confirmMasterPassword: "",
    });
  }

  function field(name, value) {
    return {
      value: value ?? "",
      onChange: (event) =>
        setForm((current) => ({ ...current, [name]: event.target.value })),
    };
  }

  function applyCurrency(code) {
    const selected = currencies.find((currency) => currency.code === code);
    setForm((current) => ({
      ...current,
      baseCurrencyCode: selected?.code || code,
      baseCurrencySymbol: selected?.symbol || current.baseCurrencySymbol,
      formalName: selected?.name || current.formalName,
      decimalPlaces: Number(selected?.decimalPlaces || current.decimalPlaces || 2),
    }));
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
                {isAlterMode ? "Alter Company" : "Create Company"}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {isAlterMode
                  ? "You are updating the currently opened company. Other companies are not listed here."
                  : "Only company name is mandatory. Everything else can be completed later."}
              </p>
            </div>

            {!isAlterMode ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Import Company
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Company Name *</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="Company Name *" 
                    {...field("name", form.name)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Financial Year From</label>
                  <input 
                    type="date" 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    {...field("financialYearFrom", form.financialYearFrom)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Books Beginning From</label>
                  <input 
                    type="date" 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    {...field("booksBeginningFrom", form.booksBeginningFrom)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Financial Year To</label>
                  <input 
                    type="date" 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    {...field("financialYearTo", form.financialYearTo)} 
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              {/* Mailing & Address Details */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Mailing & Address Details</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Mailing Name</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="Mailing Name" 
                      {...field("mailingName", form.mailingName)} 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Country</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="Country" 
                      {...field("country", form.country)} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
                    <textarea 
                      className="min-h-36 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="Address" 
                      {...field("address", form.address)} 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">State / Province</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="State / Province" 
                      {...field("state", form.state)} 
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">City</label>
                      <input 
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                        placeholder="City" 
                        {...field("city", form.city)} 
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Postal Code</label>
                      <input 
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                        placeholder="Postal Code" 
                        {...field("postalCode", form.postalCode)} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Contact Details</h2>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Telephone</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="Telephone" 
                      {...field("telephone", form.telephone)} 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Mobile</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="Mobile" 
                      {...field("mobile", form.mobile)} 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Fax</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="Fax" 
                      {...field("fax", form.fax)} 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="E-mail" 
                      {...field("email", form.email)} 
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Website</label>
                    <input 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                      placeholder="Website" 
                      {...field("website", form.website)} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Company Details */}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Company Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Division</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="Division" 
                    {...field("division", form.division)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Base Currency</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={form.baseCurrencyCode}
                    onChange={(event) => applyCurrency(event.target.value)}
                  >
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Base Currency Symbol</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="Base Currency Symbol" 
                    {...field("baseCurrencySymbol", form.baseCurrencySymbol)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Formal Name</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="Formal Name" 
                    {...field("formalName", form.formalName)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Decimal Places</label>
                  <select 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    value={form.decimalPlaces} 
                    onChange={(event) => setForm((current) => ({ ...current, decimalPlaces: Number(event.target.value) }))}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Additional Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Income Tax Number</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="Income Tax Number" 
                    {...field("incomeTaxNumber", form.incomeTaxNumber)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">VAT / TIN Number</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="VAT / TIN Number" 
                    {...field("vatTinNumber", form.vatTinNumber)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Service Tax Number</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="Service Tax Number" 
                    {...field("serviceTaxNumber", form.serviceTaxNumber)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">PAN Number</label>
                  <input 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                    placeholder="PAN Number" 
                    {...field("panNumber", form.panNumber)} 
                  />
                </div>
              </div>
            </div>
{/* 
            <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm ring-1 ring-amber-100">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Company Login Security</h2>
                  <p className="mt-1 text-sm text-amber-900/80">
                    Enable this if the company should always require master credentials before entry.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                  Important
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 cursor-pointer shadow-sm transition hover:bg-amber-50">
                  <input
                    type="checkbox"
                    checked={form.requireCompanyLogin}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        requireCompanyLogin: event.target.checked,
                        masterPassword: event.target.checked ? current.masterPassword : "",
                        confirmMasterPassword: event.target.checked
                          ? current.confirmMasterPassword
                          : "",
                      }))
                    }
                  />
                  Require master username and password for company entry
                </label>
              </div>

              {form.requireCompanyLogin ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Master Username
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Master Username"
                      {...field("masterUsername", form.masterUsername)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      {form.id ? "New Master Password" : "Master Password"}
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder={form.id ? "Leave blank to keep current password" : "Master Password"}
                      {...field("masterPassword", form.masterPassword)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Confirm Password"
                      {...field("confirmMasterPassword", form.confirmMasterPassword)}
                    />
                  </div>
                </div>
              ) : null}
            </div> */}

            {/* More Options */}
            {/* <div>
              <h2 className="text-lg font-semibold text-slate-900">More Options</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["enableInventoryManagement", "Enable Inventory Management"],
                  ["enableBillWiseDetails", "Enable Bill-wise Details"],
                  ["enableCostCentres", "Enable Cost Centres"],
                  ["enableMultiCurrency", "Enable Multi-Currency"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-100">
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
            </div> */}

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
                  {isAlterMode ? "Update Company" : "Create Company"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {false && (
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
        )}
      </div>
    </div>
  );
}
