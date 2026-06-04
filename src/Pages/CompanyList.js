import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, PencilLine, ShieldCheck, Upload, UserPlus, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import {
  STORAGE_KEY,
  useActiveCompany,
} from "../Contexts/ActiveCompanyContext";
import { canPerformAction, readStoredUser } from "../utils/accessControl";
import { EMPLOYEE_SESSION_TOKEN_KEY } from "../utils/accessControl";

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

const defaultAdminForm = {
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  phoneNumber: "",
  email: "",
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

export default function CompanyList({ standaloneCreate = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { companyId, setCompanyId } = useActiveCompany();
  const [companies, setCompanies] = useState([]);
  const [currencies, setCurrencies] = useState(defaultCurrencies);
  const [form, setForm] = useState(defaultForm);
  const [createAdminUser, setCreateAdminUser] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState(defaultAdminForm);
  const [saving, setSaving] = useState(false);
  const isAlterMode = useMemo(
    () => !standaloneCreate && location.pathname.includes("/company/alter"),
    [location.pathname, standaloneCreate],
  );
  const currentUser = useMemo(readStoredUser, []);
  const canManageCompany = useMemo(
    () => standaloneCreate || canPerformAction(currentUser?.role, "company.manage"),
    [currentUser, standaloneCreate],
  );

  function persistWorkspaceSession(companyIdToOpen, user = null, token = "") {
    const normalizedCompanyId = String(companyIdToOpen || "");
    if (!normalizedCompanyId) return;
    setCompanyId(normalizedCompanyId);
    window.localStorage.setItem(STORAGE_KEY, normalizedCompanyId);

    if (user && token) {
      window.localStorage.setItem("pos-user", JSON.stringify(user));
      window.localStorage.setItem(EMPLOYEE_SESSION_TOKEN_KEY, String(token));
      window.localStorage.setItem(
        "attendance-user",
        JSON.stringify({
          _id: user.attendance_id || user.employeeId || user._id,
        }),
      );
      return;
    }

    window.localStorage.removeItem("pos-user");
    window.localStorage.removeItem("attendance-user");
    window.localStorage.removeItem(EMPLOYEE_SESSION_TOKEN_KEY);
  }

  async function authenticateNewAdmin(createdCompanyId) {
    const response = await api.post(
      `/companies/${createdCompanyId}/employee-authenticate`,
      {
        username: adminForm.username.trim(),
        password: adminForm.password,
      },
      { preserveCompanyId: true },
    );
    const user = response.data?.user;
    const token = response.data?.token;
    if (!user || !token) {
      throw new Error("Admin login response is incomplete.");
    }
    persistWorkspaceSession(createdCompanyId, user, token);
  }

  async function loadCompanies() {
    const response = await api.get("/companies");
    setCompanies(response.data);
    return response.data || [];
  }

  useEffect(() => {
    async function loadInitialCompanies() {
      if (standaloneCreate) return;
      const rows = await loadCompanies();
      if (!isAlterMode || !companyId) return;
      const currentCompany =
        rows.find((company) => String(company._id) === String(companyId)) || null;
      if (currentCompany) {
        applyCompany(currentCompany);
      }
    }
    loadInitialCompanies();
  }, [companyId, isAlterMode, standaloneCreate]);

  useEffect(() => {
    async function loadReferenceCurrencies() {
      if (standaloneCreate) return;
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
  }, [standaloneCreate]);

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
    if (!canManageCompany) {
      alert("You do not have permission to update company details.");
      return;
    }
    if (!form.name.trim()) {
      alert("Company name is required");
      return;
    }
    if (!form.id && createAdminUser) {
      const adminName = adminForm.name.trim();
      const username = adminForm.username.trim();
      if (!adminName) {
        alert("Admin name is required");
        setShowAdminModal(true);
        return;
      }
      if (!username) {
        alert("Admin username is required");
        setShowAdminModal(true);
        return;
      }
      if (!adminForm.password) {
        alert("Admin password is required");
        setShowAdminModal(true);
        return;
      }
      if (adminForm.password.length < 4) {
        alert("Admin password must be at least 4 characters long");
        setShowAdminModal(true);
        return;
      }
      if (adminForm.password !== adminForm.confirmPassword) {
        alert("Admin password and confirm password must match");
        setShowAdminModal(true);
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
        const response = await api.post("/companies", payload);
        const createdCompany = response.data?.company || response.data;
        const createdCompanyId = createdCompany?._id;
        if (createAdminUser && createdCompanyId) {
          await api.post(
            `/companies/${createdCompanyId}/employees`,
            buildAdminEmployeePayload(adminForm),
            { preserveCompanyId: true },
          );
        }
        if (standaloneCreate && createdCompanyId) {
          if (createAdminUser) {
            await authenticateNewAdmin(createdCompanyId);
          } else {
            persistWorkspaceSession(createdCompanyId);
          }
          navigate("/", { replace: true });
          return;
        }
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
      setCreateAdminUser(false);
      setAdminForm(defaultAdminForm);
      setShowAdminModal(false);
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

  function buildAdminEmployeePayload(values) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      name: values.name.trim(),
      alias: "Admin",
      under: "Management",
      underCategory: "Management Staff",
      dateOfJoining: today,
      defineSalaryDetails: false,
      personalDetails: {
        designation: "Administrator",
        functionName: "Administration",
        location: "",
        gender: "",
        dateOfBirth: "",
        bloodGroup: "",
        fatherOrMotherName: "",
        spouseName: "",
        address: "",
      },
      contactDetails: {
        phoneCountryCode: "+880",
        phoneNumber: values.phoneNumber.trim(),
        email: values.email.trim(),
      },
      otherDetails: {
        department: "Administration",
        employeeType: "Full Time",
        status: "Active",
        grade: "",
        reportingTo: "Director",
        classification: "Admin user",
      },
      salaryDetails: {
        paymentFrequency: "",
        paymentMode: "",
        effectiveFrom: today,
        comments: "",
        payHeads: [],
      },
      bankDetails: {},
      statutoryDetails: {},
      additionalInformation: {
        employmentDetails: {
          employeeType: "Regular Employee",
          employmentStatus: "Active",
          probationPeriodDays: 0,
          confirmationDate: "",
        },
        workDetails: {
          workLocation: "Head Office",
          department: "Administration",
          reportingTo: "Director",
          jobTitle: "Administrator",
        },
      },
      accessControl: {
        loginEnabled: true,
        username: values.username.trim(),
        role: "Admin",
        status: "Active",
        password: values.password,
        confirmPassword: values.confirmPassword,
      },
    };
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
    <div className={`min-h-screen bg-slate-100 p-6 ${standaloneCreate ? "lg:py-10" : ""}`}>
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
              {!canManageCompany ? (
                <p className="mt-2 text-sm font-medium text-amber-700">
                  You can review company information here, but company changes are limited to admin
                  or supervisor roles.
                </p>
              ) : null}
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

            {!isAlterMode ? (
              <div className="rounded-3xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm ring-1 ring-blue-100">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Workspace Access Protection
                      </h2>
                      <p className="mt-1 max-w-3xl text-sm text-slate-600">
                        Create the first admin user now if this company should require employee
                        username and password before opening the workspace.
                      </p>
                      <p className="mt-2 text-xs font-medium text-blue-800">
                        If no employee is created, the company remains open as before. Once an
                        employee login exists, users must sign in to enter that company.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    Recommended
                  </span>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50">
                    <input
                      type="checkbox"
                      checked={createAdminUser}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setCreateAdminUser(checked);
                        if (checked) setShowAdminModal(true);
                      }}
                    />
                    Create admin user and protect this company
                  </label>
                  {createAdminUser ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                      onClick={() => setShowAdminModal(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Edit Admin Details
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
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
                  disabled={saving || !canManageCompany}
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

      {showAdminModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                  <UserPlus className="h-3.5 w-3.5" />
                  First Admin User
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">
                  Create Admin Login
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  This admin can open the company and manage users, vouchers, masters, and reports.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  if (!adminForm.name && !adminForm.username && !adminForm.password) {
                    setCreateAdminUser(false);
                  }
                  setShowAdminModal(false);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Admin Name *
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. Company Administrator"
                  value={adminForm.name}
                  onChange={(event) =>
                    setAdminForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Login Username *
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. admin"
                  value={adminForm.username}
                  onChange={(event) =>
                    setAdminForm((current) => ({ ...current, username: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password *
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="At least 4 characters"
                  value={adminForm.password}
                  onChange={(event) =>
                    setAdminForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Repeat password"
                  value={adminForm.confirmPassword}
                  onChange={(event) =>
                    setAdminForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Phone
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Optional"
                  value={adminForm.phoneNumber}
                  onChange={(event) =>
                    setAdminForm((current) => ({
                      ...current,
                      phoneNumber: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Optional"
                  value={adminForm.email}
                  onChange={(event) =>
                    setAdminForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Role will be saved as <span className="font-semibold text-slate-700">Admin</span>
                  {" "}with active employee login.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setCreateAdminUser(false);
                      setShowAdminModal(false);
                    }}
                  >
                    Skip Protection
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                    onClick={() => {
                      setCreateAdminUser(true);
                      setShowAdminModal(false);
                    }}
                  >
                    Use This Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
