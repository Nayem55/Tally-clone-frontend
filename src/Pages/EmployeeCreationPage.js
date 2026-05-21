import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  Download,
  Edit3,
  FilePlus2,
  Landmark,
  Search,
  Upload,
  User,
  X,
} from "lucide-react";
import api from "../api/api";
import { useLocation, useNavigate } from "react-router-dom";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import TallyDateInput from "../Component/TallyDateInput";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";
import {
  exportMasterWorkbook,
  normalizeExcelNumber,
  readWorkbookFromFile,
  toInputDate,
  worksheetToObjects,
} from "../utils/masterExcel";

const COMMON_PAY_HEADS = [
  { name: "Basic Salary", section: "Earning" },
  { name: "House Rent Allowance", section: "Earning" },
  { name: "Medical Allowance", section: "Earning" },
  { name: "Conveyance Allowance", section: "Earning" },
  { name: "Provident Fund", section: "Deduction" },
  { name: "Income Tax", section: "Deduction" },
  { name: "Professional Tax", section: "Deduction" },
  { name: "Other Deduction", section: "Deduction" },
];

const DEFAULT_SHORTCUTS = [
  "F2 Date",
  "F3 Company",
  "F4 Contra",
  "F5 Payment",
  "F6 Receipt",
  "F7 Journal",
  "F8 Sales",
  "F9 Purchase",
  "F10 Other Voucher",
  "F12 Configure",
];

const UNDER_OPTIONS = [
  { label: "Administration", category: "Office Employee" },
  { label: "Accounts", category: "Accounting Employee" },
  { label: "Sales", category: "Sales Employee" },
  { label: "Warehouse", category: "Store Employee" },
  { label: "Management", category: "Management Staff" },
];

const STATUS_OPTIONS = ["Active", "Inactive", "On Leave"];
const EMPLOYEE_TYPES = ["Regular Employee", "Contract Employee", "Intern", "Consultant"];
const FULL_TIME_TYPES = ["Full Time", "Part Time", "Contract"];
const DEPARTMENT_OPTIONS = ["Administration", "Accounts", "Sales", "Warehouse", "HR"];
const GRADE_OPTIONS = ["Grade-1", "Grade-2", "Grade-3", "Grade-4"];
const REPORTING_OPTIONS = ["Manager", "Supervisor", "Head Office", "Director"];
const EDUCATION_OPTIONS = ["Bachelor's Degree", "Master's Degree", "HSC", "SSC", "Diploma"];
const LEAVE_POLICY_OPTIONS = ["Default Leave Policy", "Factory Policy", "Corporate Policy"];
const WEEKLY_OFF_OPTIONS = ["Friday", "Saturday", "Sunday"];
const ATTENDANCE_OPTIONS = ["Monthly Attendance", "Biometric Attendance", "Shift Attendance"];
const BANK_OPTIONS = ["City Bank PLC", "Dutch-Bangla Bank", "Brac Bank", "Eastern Bank"];
const ACCOUNT_TYPES = ["Savings Account", "Current Account"];
const TAX_CATEGORIES = ["Individual", "Corporate", "N/A"];
const INCOME_TAX_REGIMES = ["Old Regime", "New Regime"];
const MARITAL_OPTIONS = ["Single", "Married", "Divorced"];
const RELIGION_OPTIONS = ["Islam", "Hinduism", "Christianity", "Buddhism", "Other"];
const ACCESS_ROLE_OPTIONS = [
  "Viewer",
  "Cashier",
  "Sales Operator",
  "Store Operator",
  "Accountant",
  "Supervisor",
  "Admin",
];
const ACCESS_STATUS_OPTIONS = ["Active", "Inactive"];

function createPayHead(head, rate = 0) {
  return {
    id: `${head.section}-${head.name}`.replace(/\s+/g, "-").toLowerCase(),
    section: head.section,
    name: head.name,
    rate,
    per: "Month",
    payHeadType: "Start Afresh",
    calculationType: "As Per Rate",
    computedOn: formatDateForInput(new Date()),
  };
}

function createEmptyEmployee() {
  return {
    name: "",
    alias: "",
    under: UNDER_OPTIONS[0].label,
    underCategory: UNDER_OPTIONS[0].category,
    employeeNumber: "",
    dateOfJoining: formatDateForInput(new Date()),
    defineSalaryDetails: true,
    photoName: "",
    personalDetails: {
      designation: "",
      functionName: "",
      location: "",
      gender: "Male",
      dateOfBirth: "",
      bloodGroup: "",
      fatherOrMotherName: "",
      spouseName: "",
      address: "",
    },
    contactDetails: {
      phoneCountryCode: "+880",
      phoneNumber: "",
      email: "",
    },
    otherDetails: {
      department: DEPARTMENT_OPTIONS[0],
      employeeType: FULL_TIME_TYPES[0],
      status: STATUS_OPTIONS[0],
      grade: GRADE_OPTIONS[2],
      reportingTo: REPORTING_OPTIONS[0],
      classification: "Regular employee",
    },
    salaryDetails: {
      paymentFrequency: "Monthly",
      paymentMode: "Bank Transfer",
      effectiveFrom: formatDateForInput(new Date()),
      comments: "",
      payHeads: COMMON_PAY_HEADS.map((head) => createPayHead(head)),
    },
    bankDetails: {
      provideBankDetails: true,
      bankAccountNo: "",
      accountHolderName: "",
      bankName: BANK_OPTIONS[0],
      mobileBankingNo: "",
      branchName: "",
      swiftCode: "",
      routingNo: "",
      ibanNo: "",
      accountType: ACCOUNT_TYPES[0],
      currency: "",
    },
    statutoryDetails: {
      identity: {
        nid: "",
        tin: "",
        passport: "",
      },
      tax: {
        applicable: true,
        category: TAX_CATEGORIES[0],
        rate: 0,
      },
      pf: {
        applicable: true,
        number: "",
        contribution: 0,
      },
      esi: {
        applicable: false,
        number: "",
      },
      professionalTax: 0,
      gratuityEligible: true,
      lwfApplicable: false,
      lwfNumber: "",
      compliance: {
        incomeTaxRegime: INCOME_TAX_REGIMES[0],
        panNumber: "",
        uanNumber: "",
        dateOfBirth: "",
      },
      documents: {
        idProof: "",
        taxDocument: "",
        pfDocument: "",
        otherDocument: "",
      },
      notes: "",
    },
    additionalInformation: {
      employmentDetails: {
        employeeType: EMPLOYEE_TYPES[0],
        employmentStatus: STATUS_OPTIONS[0],
        probationPeriodDays: 90,
        confirmationDate: "",
      },
      workDetails: {
        workLocation: "Head Office",
        department: DEPARTMENT_OPTIONS[0],
        reportingTo: REPORTING_OPTIONS[0],
        jobTitle: "",
      },
      leaveAttendance: {
        leavePolicy: LEAVE_POLICY_OPTIONS[0],
        weeklyOff: WEEKLY_OFF_OPTIONS[0],
        attendanceType: ATTENDANCE_OPTIONS[0],
        defaultLeaveBalanceDays: 12,
      },
      skillsQualifications: {
        highestEducation: EDUCATION_OPTIONS[0],
        professionalQualification: "",
        skills: "",
      },
      emergencyContact: {
        name: "",
        relationship: "",
        phone: "",
        address: "",
      },
      previousEmployment: {
        employer: "",
        designation: "",
        totalExperienceYears: 0,
        relevantExperienceYears: 0,
      },
      otherInformation: {
        maritalStatus: MARITAL_OPTIONS[0],
        nationality: "Bangladeshi",
        religion: RELIGION_OPTIONS[0],
        languages: "Bangla, English",
        hobbies: "",
      },
    },
    accessControl: {
      loginEnabled: false,
      username: "",
      role: ACCESS_ROLE_OPTIONS[0],
      status: ACCESS_STATUS_OPTIONS[0],
      hasPassword: false,
      password: "",
      confirmPassword: "",
    },
  };
}

function hydrateEmployeeRecord(row = {}) {
  const base = createEmptyEmployee();
  const general = row.general || {};

  return {
    ...base,
    ...row,
    name: row.name || general.name || base.name,
    alias: row.alias || general.alias || base.alias,
    under: row.under || general.under || base.under,
    underCategory: row.underCategory || general.underCategory || base.underCategory,
    employeeNumber:
      row.employeeNumber || general.employeeNumber || base.employeeNumber,
    dateOfJoining: row.dateOfJoining || general.dateOfJoining || base.dateOfJoining,
    defineSalaryDetails:
      row.defineSalaryDetails ?? general.defineSalaryDetails ?? base.defineSalaryDetails,
    photoName: row.photoName || general.photoName || base.photoName,
    personalDetails: {
      ...base.personalDetails,
      ...(row.personalDetails || {}),
    },
    contactDetails: {
      ...base.contactDetails,
      ...(row.contactDetails || {}),
    },
    otherDetails: {
      ...base.otherDetails,
      ...(row.otherDetails || {}),
    },
    salaryDetails: {
      ...base.salaryDetails,
      ...(row.salaryDetails || {}),
      payHeads:
        row.salaryDetails?.payHeads?.length
          ? row.salaryDetails.payHeads
          : base.salaryDetails.payHeads,
    },
    bankDetails: {
      ...base.bankDetails,
      ...(row.bankDetails || {}),
    },
    statutoryDetails: {
      ...base.statutoryDetails,
      ...(row.statutoryDetails || {}),
      identity: {
        ...base.statutoryDetails.identity,
        ...(row.statutoryDetails?.identity || {}),
      },
      tax: {
        ...base.statutoryDetails.tax,
        ...(row.statutoryDetails?.tax || {}),
      },
      pf: {
        ...base.statutoryDetails.pf,
        ...(row.statutoryDetails?.pf || {}),
      },
      esi: {
        ...base.statutoryDetails.esi,
        ...(row.statutoryDetails?.esi || {}),
      },
      compliance: {
        ...base.statutoryDetails.compliance,
        ...(row.statutoryDetails?.compliance || {}),
      },
      documents: {
        ...base.statutoryDetails.documents,
        ...(row.statutoryDetails?.documents || {}),
      },
    },
    additionalInformation: {
      ...base.additionalInformation,
      ...(row.additionalInformation || {}),
      employmentDetails: {
        ...base.additionalInformation.employmentDetails,
        ...(row.additionalInformation?.employmentDetails || {}),
      },
      workDetails: {
        ...base.additionalInformation.workDetails,
        ...(row.additionalInformation?.workDetails || {}),
      },
      leaveAttendance: {
        ...base.additionalInformation.leaveAttendance,
        ...(row.additionalInformation?.leaveAttendance || {}),
      },
      skillsQualifications: {
        ...base.additionalInformation.skillsQualifications,
        ...(row.additionalInformation?.skillsQualifications || {}),
      },
      emergencyContact: {
        ...base.additionalInformation.emergencyContact,
        ...(row.additionalInformation?.emergencyContact || {}),
      },
      previousEmployment: {
        ...base.additionalInformation.previousEmployment,
        ...(row.additionalInformation?.previousEmployment || {}),
      },
      otherInformation: {
        ...base.additionalInformation.otherInformation,
        ...(row.additionalInformation?.otherInformation || {}),
      },
    },
    accessControl: {
      ...base.accessControl,
      ...(row.accessControl || {}),
      password: "",
      confirmPassword: "",
    },
  };
}

function formatMoney(value, symbol = "") {
  const amount = Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol} ${amount}` : amount;
}

function calculateSalarySummary(employee) {
  const heads = employee.salaryDetails?.payHeads || [];
  const totalEarnings = heads
    .filter((head) => head.section !== "Deduction")
    .reduce((sum, head) => sum + Number(head.rate || 0), 0);
  const totalDeductions = heads
    .filter((head) => head.section === "Deduction")
    .reduce((sum, head) => sum + Number(head.rate || 0), 0);
  const grossSalary = totalEarnings + totalDeductions;
  return {
    grossSalary,
    totalEarnings,
    totalDeductions,
    netPayable: totalEarnings - totalDeductions,
  };
}

function getPayHeadRate(payHeads = [], name) {
  return Number(payHeads.find((head) => head.name === name)?.rate || 0);
}

function setPayHeadRate(payHeads = [], name, rate) {
  const normalizedRate = Number(rate || 0);
  const existingIndex = payHeads.findIndex((head) => head.name === name);
  if (existingIndex >= 0) {
    return payHeads.map((head, index) =>
      index === existingIndex ? { ...head, rate: normalizedRate } : head
    );
  }
  const common = COMMON_PAY_HEADS.find((head) => head.name === name) || {
    name,
    section: "Earning",
  };
  return [...payHeads, createPayHead(common, normalizedRate)];
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-2 pb-3 pt-1 text-[15px] font-semibold ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 ${
        props.className || ""
      }`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 ${
        props.className || ""
      }`}
    />
  );
}

function Select({ value, onChange, options, className = "" }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 ${className}`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function TogglePills({ value, onChange, trueLabel = "Yes", falseLabel = "No" }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`min-w-[96px] rounded-lg px-4 py-2 text-sm font-semibold ${
          value ? "bg-blue-500 text-white" : "text-slate-600"
        }`}
      >
        {trueLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`min-w-[96px] rounded-lg px-4 py-2 text-sm font-semibold ${
          !value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
        }`}
      >
        {falseLabel}
      </button>
    </div>
  );
}

function RadioPair({ value, onChange, trueLabel = "Yes", falseLabel = "No" }) {
  return (
    <div className="flex gap-6 text-sm">
      <label className="inline-flex items-center gap-2">
        <input type="radio" checked={value === true} onChange={() => onChange(true)} />
        {trueLabel}
      </label>
      <label className="inline-flex items-center gap-2">
        <input type="radio" checked={value === false} onChange={() => onChange(false)} />
        {falseLabel}
      </label>
    </div>
  );
}

function RightSummaryCard({ currencySymbol, summary }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">Summary</h3>
      <div className="mt-6 space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Monthly Gross Salary</span>
          <span className="font-semibold text-emerald-600">
            {formatMoney(summary.grossSalary, currencySymbol)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Total Earnings</span>
          <span className="font-semibold text-emerald-600">
            {formatMoney(summary.totalEarnings, currencySymbol)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Total Deductions</span>
          <span className="font-semibold text-rose-500">
            {formatMoney(summary.totalDeductions, currencySymbol)}
          </span>
        </div>
      </div>
      <div className="mt-6 border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-slate-900">Net Payable</span>
          <span className="text-2xl font-bold text-blue-600">
            {formatMoney(summary.netPayable, currencySymbol)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ShortcutCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">Shortcuts</h3>
      <div className="mt-5 space-y-3">
        {DEFAULT_SHORTCUTS.map((item) => {
          const [key, ...rest] = item.split(" ");
          return (
            <div
              key={item}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            >
              <span className="font-semibold text-blue-600">{key}</span>
              <span className="text-slate-700">{rest.join(" ")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, icon = null, actions = null, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <h3 className="text-[28px] leading-none font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function CardTitle({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h4 className="text-[20px] font-semibold text-slate-900">{title}</h4>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function EmployeeCreationPage({ mode = "create" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId, selectedCompany } = useActiveCompany();
  const isAlterMode = mode === "alter";
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [employee, setEmployee] = useState(createEmptyEmployee);
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRefs = useRef({});
  const masterFileInputRef = useRef(null);
  const [importingMaster, setImportingMaster] = useState(false);

  const currency = getCompanyCurrency(selectedCompany);
  const summary = useMemo(() => calculateSalarySummary(employee), [employee]);
  const returnTo = location.state?.returnTo || "";
  const returnState = useMemo(() => {
    if (!location.state) return undefined;
    const { returnTo: _returnTo, ...rest } = location.state;
    return Object.keys(rest || {}).length > 0 ? rest : undefined;
  }, [location.state]);

  const goBackToReturnTarget = useCallback(() => {
    if (showEditModal) {
      setShowEditModal(false);
      return;
    }
    if (returnTo) {
      navigate(returnTo, { state: returnState });
      return;
    }
    window.history.back();
  }, [navigate, returnState, returnTo, showEditModal]);

  const loadEmployees = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const response = await api.get(`/companies/${companyId}/employees`);
      const rows = (response.data || []).map(hydrateEmployeeRecord);
      setEmployees(rows);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (isAlterMode || showEditModal) return undefined;

    function handleKeydown(event) {
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        event.preventDefault();
        goBackToReturnTarget();
        return;
      }

      if (
        event.key === "Backspace" &&
        !isEditable
      ) {
        event.preventDefault();
        goBackToReturnTarget();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [goBackToReturnTarget, isAlterMode, showEditModal]);

  useEffect(() => {
    if (!companyId || !selectedEmployeeId) {
      if (!isAlterMode) {
        setEmployee(createEmptyEmployee());
      }
      return;
    }

    async function loadEmployee() {
      setLoading(true);
      try {
        const response = await api.get(
          `/companies/${companyId}/employees/${selectedEmployeeId}`,
        );
        setEmployee(hydrateEmployeeRecord(response.data));
      } finally {
        setLoading(false);
      }
    }
    loadEmployee();
  }, [companyId, selectedEmployeeId, isAlterMode]);

  useEffect(() => {
    if (!employee.bankDetails.currency && currency.code) {
      setEmployee((current) => ({
        ...current,
        bankDetails: {
          ...current.bankDetails,
          currency: `${currency.code} (${currency.symbol || currency.code})`,
        },
      }));
    }
  }, [currency.code, currency.symbol, employee.bankDetails.currency]);

  function updateGeneral(key, value) {
    setEmployee((current) => {
      const next = { ...current, [key]: value };
      if (key === "under") {
        const match = UNDER_OPTIONS.find((option) => option.label === value);
        next.underCategory = match?.category || "";
      }
      return next;
    });
  }

  function updateNested(section, key, value) {
    setEmployee((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  }

  function updateDeep(section, group, key, value) {
    setEmployee((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [group]: {
          ...current[section][group],
          [key]: value,
        },
      },
    }));
  }

  function updatePayHead(index, key, value) {
    setEmployee((current) => {
      const nextHeads = [...current.salaryDetails.payHeads];
      nextHeads[index] = {
        ...nextHeads[index],
        [key]: key === "rate" ? Number(value || 0) : value,
      };
      return {
        ...current,
        salaryDetails: {
          ...current.salaryDetails,
          payHeads: nextHeads,
        },
      };
    });
  }

  function addCommonPayHead(head) {
    setEmployee((current) => {
      const exists = current.salaryDetails.payHeads.some(
        (row) => row.name === head.name,
      );
      if (exists) return current;
      return {
        ...current,
        salaryDetails: {
          ...current.salaryDetails,
          payHeads: [...current.salaryDetails.payHeads, createPayHead(head)],
        },
      };
    });
  }

  function setDocumentName(bucket, file) {
    if (!file) return;
    setEmployee((current) => ({
      ...current,
      statutoryDetails: {
        ...current.statutoryDetails,
        documents: {
          ...current.statutoryDetails.documents,
          [bucket]: file.name,
        },
      },
    }));
  }

  async function persistEmployee({ resetAfterSave = false } = {}) {
    if (!companyId) return;

    if (employee.accessControl?.loginEnabled) {
      const username = String(employee.accessControl.username || "").trim();
      const password = String(employee.accessControl.password || "");
      const confirmPassword = String(employee.accessControl.confirmPassword || "");

      if (!username) {
        setNotice("Login username is required when employee login is enabled.");
        return;
      }
      if (!employee.accessControl.role) {
        setNotice("Access role is required when employee login is enabled.");
        return;
      }
      if (!isAlterMode && !password) {
        setNotice("Login password is required when employee login is enabled.");
        return;
      }
      if (password || confirmPassword) {
        if (password.length < 4) {
          setNotice("Login password must be at least 4 characters long.");
          return;
        }
        if (password !== confirmPassword) {
          setNotice("Password and confirm password must match.");
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (isAlterMode && selectedEmployeeId) {
        const response = await api.put(
          `/companies/${companyId}/employees/${selectedEmployeeId}`,
          employee,
        );
        const updated = hydrateEmployeeRecord(response.data);
        setEmployee(updated);
        await loadEmployees();
        setNotice("Employee updated successfully.");
        setShowEditModal(false);
      } else {
        const response = await api.post(
          `/companies/${companyId}/employees`,
          employee,
        );
        const created = hydrateEmployeeRecord(response.data);
        await loadEmployees();
        if (resetAfterSave) {
          setEmployee(createEmptyEmployee());
          setActiveTab("general");
        } else {
          setEmployee(created);
          setSelectedEmployeeId(created._id);
        }
        setNotice("Employee saved successfully.");
        if (!resetAfterSave && returnTo) {
          navigate(returnTo, { state: returnState });
          return;
        }
      }
    } catch (error) {
      setNotice(
        error.response?.data?.message || "Unable to save employee right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  function exportEmployeeDemoExcel() {
    const payHeads = employee.salaryDetails?.payHeads || [];
    exportMasterWorkbook({
      sheetName: "Employees",
      filename: "Employees_demo.xlsx",
      headers: [
        "Employee Name",
        "Alias",
        "Under",
        "Employee Number",
        "Date of Joining",
        "Department",
        "Designation",
        "Phone No",
        "Email",
        "Employee Type",
        "Status",
        "Work Location",
        "Reporting To",
        "Job Title",
        "Bank Account No",
        "Bank Name",
        "Branch Name",
        "NID",
        "TIN",
        "Basic Salary",
        "House Rent Allowance",
        "Medical Allowance",
        "Conveyance Allowance",
        "Provident Fund",
        "Income Tax",
        "Professional Tax",
        "Other Deduction",
        "Leave Policy",
      ],
      sampleRows: [
        {
          "Employee Name": employee.name || "",
          Alias: employee.alias || "",
          Under: employee.under || UNDER_OPTIONS[0].label,
          "Employee Number": employee.employeeNumber || "",
          "Date of Joining": employee.dateOfJoining || formatDateForInput(new Date()),
          Department:
            employee.otherDetails.department ||
            employee.additionalInformation.workDetails.department ||
            "",
          Designation:
            employee.personalDetails.designation ||
            employee.additionalInformation.workDetails.jobTitle ||
            "",
          "Phone No": employee.contactDetails.phoneNumber || "",
          Email: employee.contactDetails.email || "",
          "Employee Type": employee.otherDetails.employeeType || FULL_TIME_TYPES[0],
          Status: employee.otherDetails.status || STATUS_OPTIONS[0],
          "Work Location": employee.additionalInformation.workDetails.workLocation || "",
          "Reporting To":
            employee.otherDetails.reportingTo ||
            employee.additionalInformation.workDetails.reportingTo ||
            "",
          "Job Title": employee.additionalInformation.workDetails.jobTitle || "",
          "Bank Account No": employee.bankDetails.bankAccountNo || "",
          "Bank Name": employee.bankDetails.bankName || "",
          "Branch Name": employee.bankDetails.branchName || "",
          NID: employee.statutoryDetails.identity.nid || "",
          TIN: employee.statutoryDetails.identity.tin || "",
          "Basic Salary": getPayHeadRate(payHeads, "Basic Salary"),
          "House Rent Allowance": getPayHeadRate(payHeads, "House Rent Allowance"),
          "Medical Allowance": getPayHeadRate(payHeads, "Medical Allowance"),
          "Conveyance Allowance": getPayHeadRate(payHeads, "Conveyance Allowance"),
          "Provident Fund": getPayHeadRate(payHeads, "Provident Fund"),
          "Income Tax": getPayHeadRate(payHeads, "Income Tax"),
          "Professional Tax": getPayHeadRate(payHeads, "Professional Tax"),
          "Other Deduction": getPayHeadRate(payHeads, "Other Deduction"),
          "Leave Policy": employee.additionalInformation.leaveAttendance.leavePolicy || "",
        },
      ],
      instructions: [
        "Fill the Employees sheet and import it back from this create screen.",
        "Each row creates one employee master.",
        "Any blank field will use the employee defaults already configured in the system.",
        "Date accepts dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy, or Excel date cells.",
      ],
      referenceSheets: [
        { name: "Under Options", rows: UNDER_OPTIONS.map((row) => ({ Under: row.label, Category: row.category })) },
        { name: "Departments", rows: DEPARTMENT_OPTIONS.map((row) => ({ Department: row })) },
        { name: "Employee Types", rows: FULL_TIME_TYPES.map((row) => ({ Type: row })) },
        { name: "Statuses", rows: STATUS_OPTIONS.map((row) => ({ Status: row })) },
        { name: "Banks", rows: BANK_OPTIONS.map((row) => ({ Bank: row })) },
      ],
    });
  }

  async function importEmployeeExcel(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !companyId) return;

    setImportingMaster(true);
    setNotice("");
    try {
      const workbook = await readWorkbookFromFile(file);
      const rows = worksheetToObjects(workbook, "Employees").filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      for (const row of rows) {
        let nextEmployee = createEmptyEmployee();
        const underValue = String(row.Under || "").trim() || nextEmployee.under;
        const underMatch = UNDER_OPTIONS.find((option) => option.label === underValue);
        nextEmployee = {
          ...nextEmployee,
          name: String(row["Employee Name"] || "").trim(),
          alias: String(row.Alias || "").trim(),
          under: underValue,
          underCategory: underMatch?.category || nextEmployee.underCategory,
          employeeNumber: String(row["Employee Number"] || "").trim(),
          dateOfJoining: row["Date of Joining"]
            ? toInputDate(row["Date of Joining"])
            : nextEmployee.dateOfJoining,
          personalDetails: {
            ...nextEmployee.personalDetails,
            designation: String(row.Designation || "").trim(),
          },
          contactDetails: {
            ...nextEmployee.contactDetails,
            phoneNumber: String(row["Phone No"] || row["Phone No."] || "").trim(),
            email: String(row.Email || "").trim(),
          },
          otherDetails: {
            ...nextEmployee.otherDetails,
            department: String(row.Department || nextEmployee.otherDetails.department).trim(),
            employeeType: String(row["Employee Type"] || nextEmployee.otherDetails.employeeType).trim(),
            status: String(row.Status || nextEmployee.otherDetails.status).trim(),
            reportingTo: String(row["Reporting To"] || nextEmployee.otherDetails.reportingTo).trim(),
          },
          bankDetails: {
            ...nextEmployee.bankDetails,
            bankAccountNo: String(row["Bank Account No"] || "").trim(),
            bankName: String(row["Bank Name"] || nextEmployee.bankDetails.bankName).trim(),
            branchName: String(row["Branch Name"] || "").trim(),
          },
          statutoryDetails: {
            ...nextEmployee.statutoryDetails,
            identity: {
              ...nextEmployee.statutoryDetails.identity,
              nid: String(row.NID || "").trim(),
              tin: String(row.TIN || "").trim(),
            },
          },
          additionalInformation: {
            ...nextEmployee.additionalInformation,
            workDetails: {
              ...nextEmployee.additionalInformation.workDetails,
              workLocation: String(row["Work Location"] || "").trim(),
              department: String(row.Department || nextEmployee.additionalInformation.workDetails.department).trim(),
              reportingTo: String(row["Reporting To"] || nextEmployee.additionalInformation.workDetails.reportingTo).trim(),
              jobTitle: String(row["Job Title"] || row.Designation || "").trim(),
            },
            leaveAttendance: {
              ...nextEmployee.additionalInformation.leaveAttendance,
              leavePolicy: String(row["Leave Policy"] || nextEmployee.additionalInformation.leaveAttendance.leavePolicy).trim(),
            },
          },
        };

        let payHeads = nextEmployee.salaryDetails.payHeads || [];
        [
          "Basic Salary",
          "House Rent Allowance",
          "Medical Allowance",
          "Conveyance Allowance",
          "Provident Fund",
          "Income Tax",
          "Professional Tax",
          "Other Deduction",
        ].forEach((headName) => {
          payHeads = setPayHeadRate(payHeads, headName, normalizeExcelNumber(row[headName], 0));
        });

        nextEmployee.salaryDetails = {
          ...nextEmployee.salaryDetails,
          payHeads,
        };

        await api.post(`/companies/${companyId}/employees`, nextEmployee);
      }

      await loadEmployees();
      setNotice(`${rows.length} employee row(s) imported successfully.`);
    } catch (error) {
      setNotice(error.response?.data?.message || error.message || "Unable to import employees.");
    } finally {
      setImportingMaster(false);
    }
  }

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((row) =>
      [row.name, row.employeeNumber, row.personalDetails?.designation, row.otherDetails?.department]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [employees, search]);

  const topSummaryRows = [
    { label: "Employee Name", value: employee.name || "-" },
    { label: "Under", value: employee.under || "-" },
    {
      label: "Employee Number",
      value: employee.employeeNumber || "Auto on save",
    },
    { label: "Date of Joining", value: employee.dateOfJoining || "-" },
  ];

  const generalTab = (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px_130px]">
          <div className="space-y-4">
            <Field label="Employee Name">
              <Input
                value={employee.name}
                onChange={(event) => updateGeneral("name", event.target.value)}
              />
            </Field>
            <Field label="(Alias)">
              <Input
                value={employee.alias}
                onChange={(event) => updateGeneral("alias", event.target.value)}
              />
            </Field>
          </div>
          <div className="space-y-4">
            <Field label="Under">
              <Select
                value={employee.under}
                onChange={(event) => updateGeneral("under", event.target.value)}
                options={UNDER_OPTIONS.map((option) => option.label)}
              />
            </Field>
            <div className="text-sm italic text-slate-500">
              ({employee.underCategory || "Office Employee"})
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Date of Joining">
              <TallyDateInput
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                value={employee.dateOfJoining}
                onChange={(value) => updateGeneral("dateOfJoining", value)}
              />
            </Field>
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Define Salary Details
              </span>
              <TogglePills
                value={employee.defineSalaryDetails}
                onChange={(value) => updateGeneral("defineSalaryDetails", value)}
              />
            </div>
          </div>
          <div>
            <span className="mb-2 block text-sm font-semibold text-slate-700">Photo</span>
            <button
              type="button"
              onClick={() => fileRefs.current.photo?.click()}
              className="flex h-[160px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500"
            >
              <User className="h-8 w-8" />
              <span className="mt-3 text-sm font-semibold">Upload Photo</span>
              <span className="mt-1 text-xs">{employee.photoName || "No file selected"}</span>
            </button>
            <input
              ref={(node) => {
                fileRefs.current.photo = node;
              }}
              type="file"
              className="hidden"
              onChange={(event) =>
                updateGeneral("photoName", event.target.files?.[0]?.name || "")
              }
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardTitle title="Personal Details" />
          <div className="grid gap-4">
            <Field label="Employee Number">
              <Input
                value={employee.employeeNumber}
                onChange={(event) => updateGeneral("employeeNumber", event.target.value)}
              />
            </Field>
            <Field label="Designation">
              <Input
                value={employee.personalDetails.designation}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      designation: event.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Function">
              <Input
                value={employee.personalDetails.functionName}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      functionName: event.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Location">
              <Input
                value={employee.personalDetails.location}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      location: event.target.value,
                    },
                  }))
                }
              />
            </Field>
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Gender</span>
              <div className="flex gap-6">
                {["Male", "Female"].map((gender) => (
                  <label key={gender} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={employee.personalDetails.gender === gender}
                      onChange={() =>
                        setEmployee((current) => ({
                          ...current,
                          personalDetails: {
                            ...current.personalDetails,
                            gender,
                          },
                        }))
                      }
                    />
                    {gender}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Date of Birth">
              <TallyDateInput
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                value={employee.personalDetails.dateOfBirth}
                onChange={(value) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      dateOfBirth: value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Blood Group">
              <Input
                value={employee.personalDetails.bloodGroup}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      bloodGroup: event.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Father's / Mother's Name">
              <Input
                value={employee.personalDetails.fatherOrMotherName}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      fatherOrMotherName: event.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Spouse's Name">
              <Input
                value={employee.personalDetails.spouseName}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      spouseName: event.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Address">
              <Textarea
                className="min-h-[130px]"
                value={employee.personalDetails.address}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    personalDetails: {
                      ...current.personalDetails,
                      address: event.target.value,
                    },
                  }))
                }
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardTitle title="Contact Details" />
          <div className="grid gap-4">
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Phone No.</span>
              <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
                <Input
                  value={employee.contactDetails.phoneCountryCode}
                  onChange={(event) =>
                    setEmployee((current) => ({
                      ...current,
                      contactDetails: {
                        ...current.contactDetails,
                        phoneCountryCode: event.target.value,
                      },
                    }))
                  }
                />
                <Input
                  value={employee.contactDetails.phoneNumber}
                  onChange={(event) =>
                    setEmployee((current) => ({
                      ...current,
                      contactDetails: {
                        ...current.contactDetails,
                        phoneNumber: event.target.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
            <Field label="Email">
              <Input
                value={employee.contactDetails.email}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    contactDetails: {
                      ...current.contactDetails,
                      email: event.target.value,
                    },
                  }))
                }
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardTitle title="Other Details" />
          <div className="grid gap-4">
            <Field label="Department">
              <Select
                value={employee.otherDetails.department}
                onChange={(event) => updateNested("otherDetails", "department", event.target.value)}
                options={DEPARTMENT_OPTIONS}
              />
            </Field>
            <Field label="Employee Type">
              <Select
                value={employee.otherDetails.employeeType}
                onChange={(event) => updateNested("otherDetails", "employeeType", event.target.value)}
                options={FULL_TIME_TYPES}
              />
            </Field>
            <Field label="Status">
              <Select
                value={employee.otherDetails.status}
                onChange={(event) => updateNested("otherDetails", "status", event.target.value)}
                options={STATUS_OPTIONS}
              />
            </Field>
            <Field label="Grade">
              <Select
                value={employee.otherDetails.grade}
                onChange={(event) => updateNested("otherDetails", "grade", event.target.value)}
                options={GRADE_OPTIONS}
              />
            </Field>
            <Field label="Reporting To">
              <Select
                value={employee.otherDetails.reportingTo}
                onChange={(event) => updateNested("otherDetails", "reportingTo", event.target.value)}
                options={REPORTING_OPTIONS}
              />
            </Field>
            <Field label="">
              <Input
                value={employee.otherDetails.classification}
                onChange={(event) =>
                  updateNested("otherDetails", "classification", event.target.value)
                }
              />
            </Field>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-[#f7fbff] p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <User className="h-5 w-5 text-slate-500" />
          <h4 className="text-[22px] font-semibold text-slate-900">Summary</h4>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Employee Name", employee.name || "-"],
            ["Employee Number", employee.employeeNumber || "Auto on save"],
            ["Under", employee.under || "-"],
            ["Date of Joining", employee.dateOfJoining || "-"],
            ["Status", employee.otherDetails.status || "-"],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-slate-200 pr-4 last:border-r-0">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-3 text-xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const salaryTab = (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_240px]">
            {topSummaryRows.map((row) => (
              <div key={row.label}>
                <p className="text-sm text-slate-500">{row.label}</p>
                <p className="mt-3 text-[18px] font-semibold text-slate-900">{row.value}</p>
                {row.label === "Under" ? (
                  <p className="mt-1 text-sm italic text-slate-500">
                    ({employee.underCategory || "Office Employee"})
                  </p>
                ) : null}
              </div>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-5 text-center">
              <p className="text-sm text-slate-500">Monthly Gross Salary</p>
              <p className="mt-4 text-[20px] font-bold text-emerald-600">
                {formatMoney(summary.grossSalary, currency.symbol)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardTitle title="Salary Structure" />
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Pay Head</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Per</th>
                  <th className="px-4 py-3">Pay Head Type</th>
                  <th className="px-4 py-3">Calculation Type</th>
                  <th className="px-4 py-3">Computed On</th>
                </tr>
              </thead>
              <tbody>
                {["Earning", "Deduction"].map((section) => (
                  <Fragment key={section}>
                    <tr key={`${section}-header`} className="border-t border-slate-100 bg-slate-50/60">
                      <td className={`px-4 py-3 font-semibold ${section === "Deduction" ? "text-rose-500" : "text-emerald-600"}`}>
                        {section === "Deduction" ? "Deductions" : "Earnings"}
                      </td>
                      <td colSpan={5} />
                    </tr>
                    {employee.salaryDetails.payHeads
                      .filter((head) => head.section === section)
                      .map((head) => {
                        const index = employee.salaryDetails.payHeads.findIndex(
                          (row) => row.id === head.id,
                        );
                        return (
                          <tr key={head.id} className="border-t border-slate-100">
                            <td className="px-4 py-3">{head.name}</td>
                            <td className="px-4 py-3">
                              <Input
                                className="py-2"
                                type="number"
                                value={head.rate}
                                onChange={(event) =>
                                  updatePayHead(index, "rate", event.target.value)
                                }
                              />
                            </td>
                            <td className="px-4 py-3">{head.per}</td>
                            <td className="px-4 py-3">{head.payHeadType}</td>
                            <td className="px-4 py-3">{head.calculationType}</td>
                            <td className="px-4 py-3">{head.computedOn}</td>
                          </tr>
                        );
                      })}
                  </Fragment>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-4 py-4 font-semibold">Total Earnings</td>
                  <td className="px-4 py-4 font-semibold text-emerald-600">
                    {formatMoney(summary.totalEarnings, currency.symbol)}
                  </td>
                  <td />
                  <td className="px-4 py-4 font-semibold text-rose-500">
                    Total Deductions
                  </td>
                  <td />
                  <td className="px-4 py-4 font-semibold text-rose-500">
                    {formatMoney(summary.totalDeductions, currency.symbol)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[260px_repeat(3,minmax(0,1fr))]">
            <div className="rounded-2xl bg-[#eef5ff] p-5 text-center">
              <p className="text-lg font-semibold text-slate-900">Net Payable</p>
              <p className="mt-2 text-xs text-slate-500">
                (Total Earnings - Total Deductions)
              </p>
              <p className="mt-4 text-[28px] font-bold text-blue-600">
                {formatMoney(summary.netPayable, currency.symbol)}
              </p>
            </div>
            <Field label="Payment Frequency">
              <Select
                value={employee.salaryDetails.paymentFrequency}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    salaryDetails: {
                      ...current.salaryDetails,
                      paymentFrequency: event.target.value,
                    },
                  }))
                }
                options={["Monthly", "Bi-Monthly", "Weekly"]}
              />
            </Field>
            <Field label="Payment Mode">
              <Select
                value={employee.salaryDetails.paymentMode}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    salaryDetails: {
                      ...current.salaryDetails,
                      paymentMode: event.target.value,
                    },
                  }))
                }
                options={["Bank Transfer", "Cash", "Mobile Banking"]}
              />
            </Field>
            <Field label="Effective From">
              <TallyDateInput
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                value={employee.salaryDetails.effectiveFrom}
                onChange={(value) =>
                  setEmployee((current) => ({
                    ...current,
                    salaryDetails: {
                      ...current.salaryDetails,
                      effectiveFrom: value,
                    },
                  }))
                }
              />
            </Field>
          </div>

          <div className="mt-6">
            <Field label="Salary Comments (Optional)">
              <Textarea
                value={employee.salaryDetails.comments}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    salaryDetails: {
                      ...current.salaryDetails,
                      comments: event.target.value,
                    },
                  }))
                }
              />
            </Field>
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <RightSummaryCard currencySymbol={currency.symbol} summary={summary} />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Common Pay Heads</h3>
          <div className="mt-5 space-y-3 text-sm">
            {COMMON_PAY_HEADS.map((head) => (
              <button
                key={head.name}
                type="button"
                onClick={() => addCommonPayHead(head)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-slate-700 hover:bg-slate-50"
              >
                <span>{head.name}</span>
                <span className="text-lg text-slate-400">+</span>
              </button>
            ))}
          </div>
        </div>
        <ShortcutCard />
      </div>
    </div>
  );

  const bankTab = (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            {topSummaryRows.map((row) => (
              <div key={row.label}>
                <p className="text-sm text-slate-500">{row.label}</p>
                <p className="mt-3 text-[18px] font-semibold text-slate-900">{row.value}</p>
                {row.label === "Under" ? (
                  <p className="mt-1 text-sm italic text-slate-500">
                    ({employee.underCategory || "Office Employee"})
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Landmark className="h-6 w-6 text-blue-600" />
                <h4 className="text-[22px] font-semibold text-slate-900">Bank Details</h4>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Provide bank details for salary transfer and statutory reports
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={employee.bankDetails.provideBankDetails}
                onChange={(event) =>
                  setEmployee((current) => ({
                    ...current,
                    bankDetails: {
                      ...current.bankDetails,
                      provideBankDetails: event.target.checked,
                    },
                  }))
                }
              />
              Provide Bank Details
            </label>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <Field label="Bank Account No.">
                <Input
                  value={employee.bankDetails.bankAccountNo}
                  onChange={(event) => updateNested("bankDetails", "bankAccountNo", event.target.value)}
                />
              </Field>
              <Field label="Bank Name">
                <Select
                  value={employee.bankDetails.bankName}
                  onChange={(event) => updateNested("bankDetails", "bankName", event.target.value)}
                  options={BANK_OPTIONS}
                />
              </Field>
              <Field label="Branch Name">
                <Input
                  value={employee.bankDetails.branchName}
                  onChange={(event) => updateNested("bankDetails", "branchName", event.target.value)}
                />
              </Field>
              <Field label="Routing No. / Branch Code">
                <Input
                  value={employee.bankDetails.routingNo}
                  onChange={(event) => updateNested("bankDetails", "routingNo", event.target.value)}
                />
              </Field>
              <Field label="Account Type">
                <Select
                  value={employee.bankDetails.accountType}
                  onChange={(event) => updateNested("bankDetails", "accountType", event.target.value)}
                  options={ACCOUNT_TYPES}
                />
              </Field>
            </div>
            <div className="space-y-4">
              <Field label="Account Holder Name">
                <Input
                  value={employee.bankDetails.accountHolderName}
                  onChange={(event) =>
                    updateNested("bankDetails", "accountHolderName", event.target.value)
                  }
                />
              </Field>
              <Field label="Mobile Banking No.">
                <Input
                  value={employee.bankDetails.mobileBankingNo}
                  onChange={(event) =>
                    updateNested("bankDetails", "mobileBankingNo", event.target.value)
                  }
                />
              </Field>
              <Field label="SWIFT Code">
                <Input
                  value={employee.bankDetails.swiftCode}
                  onChange={(event) => updateNested("bankDetails", "swiftCode", event.target.value)}
                />
              </Field>
              <Field label="IBAN No.">
                <Input
                  value={employee.bankDetails.ibanNo}
                  onChange={(event) => updateNested("bankDetails", "ibanNo", event.target.value)}
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={employee.bankDetails.currency}
                  onChange={(event) => updateNested("bankDetails", "currency", event.target.value)}
                  options={[employee.bankDetails.currency || `${currency.code} (${currency.symbol})`]}
                />
              </Field>
            </div>
            <div className="rounded-2xl bg-[#f8fbff] p-5">
              <h5 className="text-lg font-semibold text-slate-900">Note</h5>
              <p className="mt-4 text-sm text-slate-500">Bank details will be used for:</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li>Salary Payment</li>
                <li>Bank Transfer</li>
                <li>Statutory Reports</li>
                <li>Payslip Generation</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
      <div className="space-y-4">
        <ShortcutCard />
        <RightSummaryCard currencySymbol={currency.symbol} summary={summary} />
      </div>
    </div>
  );

  const statutoryTab = (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px_220px_90px]">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <User className="h-8 w-8" />
              </div>
              <div>
                <p className="text-[28px] leading-none font-semibold text-slate-900">
                  {employee.name || "Employee"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {employee.employeeNumber || "Auto on save"} | {employee.under}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {employee.underCategory || "Office Employee"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500">Date of Joining</p>
              <p className="mt-3 text-[18px] font-semibold text-slate-900">
                {employee.dateOfJoining || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Employee Type</p>
              <p className="mt-3 text-[18px] font-semibold text-slate-900">
                {employee.otherDetails.employeeType || "-"}
              </p>
            </div>
            <div className="flex items-center justify-center text-blue-600">
              <Building2 className="h-9 w-9" />
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Identity & Government Information" />
            <div className="grid gap-4">
              <Field label="NID / National ID No.">
                <Input
                  value={employee.statutoryDetails.identity.nid}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "identity", "nid", event.target.value)
                  }
                />
              </Field>
              <Field label="TIN Number">
                <Input
                  value={employee.statutoryDetails.identity.tin}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "identity", "tin", event.target.value)
                  }
                />
              </Field>
              <Field label="Passport Number (Optional)">
                <Input
                  value={employee.statutoryDetails.identity.passport}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "identity", "passport", event.target.value)
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Tax Information" />
            <div className="grid gap-4">
              <div>
                <span className="mb-2 block text-sm font-semibold text-slate-700">Tax Applicable</span>
                <RadioPair
                  value={employee.statutoryDetails.tax.applicable}
                  onChange={(value) =>
                    updateDeep("statutoryDetails", "tax", "applicable", value)
                  }
                />
              </div>
              <Field label="Tax Category">
                <Select
                  value={employee.statutoryDetails.tax.category}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "tax", "category", event.target.value)
                  }
                  options={TAX_CATEGORIES}
                />
              </Field>
              <Field label="Tax Rate (%)">
                <Input
                  type="number"
                  value={employee.statutoryDetails.tax.rate}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "tax", "rate", Number(event.target.value))
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Social Security / PF / ESI" />
            <div className="grid gap-4">
              <div>
                <span className="mb-2 block text-sm font-semibold text-slate-700">PF Applicable</span>
                <RadioPair
                  value={employee.statutoryDetails.pf.applicable}
                  onChange={(value) =>
                    updateDeep("statutoryDetails", "pf", "applicable", value)
                  }
                />
              </div>
              <Field label="PF Number">
                <Input
                  value={employee.statutoryDetails.pf.number}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "pf", "number", event.target.value)
                  }
                />
              </Field>
              <Field label="PF Contribution (%)">
                <Input
                  type="number"
                  value={employee.statutoryDetails.pf.contribution}
                  onChange={(event) =>
                    updateDeep(
                      "statutoryDetails",
                      "pf",
                      "contribution",
                      Number(event.target.value),
                    )
                  }
                />
              </Field>
              <div className="border-t border-slate-200 pt-4">
                <span className="mb-2 block text-sm font-semibold text-slate-700">ESI Applicable</span>
                <RadioPair
                  value={employee.statutoryDetails.esi.applicable}
                  onChange={(value) =>
                    updateDeep("statutoryDetails", "esi", "applicable", value)
                  }
                />
              </div>
              <Field label="ESI Number">
                <Input
                  value={employee.statutoryDetails.esi.number}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "esi", "number", event.target.value)
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Other Statutory Information" />
            <div className="grid gap-4">
              <Field label="Professional Tax">
                <Input
                  type="number"
                  value={employee.statutoryDetails.professionalTax}
                  onChange={(event) =>
                    setEmployee((current) => ({
                      ...current,
                      statutoryDetails: {
                        ...current.statutoryDetails,
                        professionalTax: Number(event.target.value),
                      },
                    }))
                  }
                />
              </Field>
              <div>
                <span className="mb-2 block text-sm font-semibold text-slate-700">Gratuity Eligible</span>
                <RadioPair
                  value={employee.statutoryDetails.gratuityEligible}
                  onChange={(value) =>
                    setEmployee((current) => ({
                      ...current,
                      statutoryDetails: {
                        ...current.statutoryDetails,
                        gratuityEligible: value,
                      },
                    }))
                  }
                />
              </div>
              <div>
                <span className="mb-2 block text-sm font-semibold text-slate-700">LWF Applicable</span>
                <RadioPair
                  value={employee.statutoryDetails.lwfApplicable}
                  onChange={(value) =>
                    setEmployee((current) => ({
                      ...current,
                      statutoryDetails: {
                        ...current.statutoryDetails,
                        lwfApplicable: value,
                      },
                    }))
                  }
                />
              </div>
              <Field label="LWF Number">
                <Input
                  value={employee.statutoryDetails.lwfNumber}
                  onChange={(event) =>
                    setEmployee((current) => ({
                      ...current,
                      statutoryDetails: {
                        ...current.statutoryDetails,
                        lwfNumber: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Compliance & Additional" />
            <div className="grid gap-4">
              <Field label="Income Tax Regime">
                <Select
                  value={employee.statutoryDetails.compliance.incomeTaxRegime}
                  onChange={(event) =>
                    updateDeep(
                      "statutoryDetails",
                      "compliance",
                      "incomeTaxRegime",
                      event.target.value,
                    )
                  }
                  options={INCOME_TAX_REGIMES}
                />
              </Field>
              <Field label="PAN Number">
                <Input
                  value={employee.statutoryDetails.compliance.panNumber}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "compliance", "panNumber", event.target.value)
                  }
                />
              </Field>
              <Field label="UAN Number (PF)">
                <Input
                  value={employee.statutoryDetails.compliance.uanNumber}
                  onChange={(event) =>
                    updateDeep("statutoryDetails", "compliance", "uanNumber", event.target.value)
                  }
                />
              </Field>
              <Field label="Date of Birth">
                <TallyDateInput
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                  value={employee.statutoryDetails.compliance.dateOfBirth}
                  onChange={(value) =>
                    updateDeep("statutoryDetails", "compliance", "dateOfBirth", value)
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Documents Upload" />
            <div className="space-y-3">
              {[
                ["idProof", "Upload NID / ID Proof"],
                ["taxDocument", "Upload Tax Documents"],
                ["pfDocument", "Upload PF Documents"],
                ["otherDocument", "Upload Other Documents"],
              ].map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {employee.statutoryDetails.documents[key] || "No file selected"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-600"
                    onClick={() => fileRefs.current[key]?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </button>
                  <input
                    ref={(node) => {
                      fileRefs.current[key] = node;
                    }}
                    type="file"
                    className="hidden"
                    onChange={(event) => setDocumentName(key, event.target.files?.[0])}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Field label="Notes">
            <Textarea
              value={employee.statutoryDetails.notes}
              onChange={(event) =>
                setEmployee((current) => ({
                  ...current,
                  statutoryDetails: {
                    ...current.statutoryDetails,
                    notes: event.target.value,
                  },
                }))
              }
            />
          </Field>
        </section>
      </div>
      <div className="space-y-4">
        <ShortcutCard />
        <RightSummaryCard currencySymbol={currency.symbol} summary={summary} />
      </div>
    </div>
  );

  const additionalTab = (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-3">
          <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm xl:col-span-3">
            <CardTitle
              title="Access Control"
              subtitle="Enable employee login now and assign a baseline role for the larger role-based access batch."
            />
            <div className="grid gap-4 xl:grid-cols-4">
              <Field label="Enable Login">
                <TogglePills
                  value={employee.accessControl.loginEnabled}
                  onChange={(value) => updateNested("accessControl", "loginEnabled", value)}
                  trueLabel="Enabled"
                  falseLabel="Disabled"
                />
              </Field>
              <Field label="Access Role" required={employee.accessControl.loginEnabled}>
                <Select
                  value={employee.accessControl.role}
                  onChange={(event) =>
                    updateNested("accessControl", "role", event.target.value)
                  }
                  options={ACCESS_ROLE_OPTIONS}
                />
              </Field>
              <Field label="Login Status">
                <Select
                  value={employee.accessControl.status}
                  onChange={(event) =>
                    updateNested("accessControl", "status", event.target.value)
                  }
                  options={ACCESS_STATUS_OPTIONS}
                />
              </Field>
              <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-800">Password State</div>
                <div className="mt-1">
                  {employee.accessControl.hasPassword
                    ? "Password already set. Leave it blank during alter to keep the current password."
                    : "No password saved yet. Set one if login is enabled."}
                </div>
              </div>
              <Field label="Login Username" required={employee.accessControl.loginEnabled}>
                <Input
                  value={employee.accessControl.username}
                  onChange={(event) =>
                    updateNested("accessControl", "username", event.target.value)
                  }
                  placeholder="Enter employee login username"
                  autoComplete="off"
                />
              </Field>
              <Field label="Password" required={employee.accessControl.loginEnabled && !isAlterMode}>
                <Input
                  type="password"
                  value={employee.accessControl.password}
                  onChange={(event) =>
                    updateNested("accessControl", "password", event.target.value)
                  }
                  placeholder={
                    isAlterMode
                      ? "Leave blank to keep current password"
                      : "Enter login password"
                  }
                  autoComplete="new-password"
                />
              </Field>
              <Field
                label="Confirm Password"
                required={employee.accessControl.loginEnabled && Boolean(employee.accessControl.password)}
              >
                <Input
                  type="password"
                  value={employee.accessControl.confirmPassword}
                  onChange={(event) =>
                    updateNested("accessControl", "confirmPassword", event.target.value)
                  }
                  placeholder="Re-enter login password"
                  autoComplete="new-password"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Employment Details" />
            <div className="grid gap-4">
              <Field label="Employee Type">
                <Select
                  value={employee.additionalInformation.employmentDetails.employeeType}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "employmentDetails",
                      "employeeType",
                      event.target.value,
                    )
                  }
                  options={EMPLOYEE_TYPES}
                />
              </Field>
              <Field label="Employment Status">
                <Select
                  value={employee.additionalInformation.employmentDetails.employmentStatus}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "employmentDetails",
                      "employmentStatus",
                      event.target.value,
                    )
                  }
                  options={STATUS_OPTIONS}
                />
              </Field>
              <Field label="Probation Period (Days)">
                <Input
                  type="number"
                  value={employee.additionalInformation.employmentDetails.probationPeriodDays}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "employmentDetails",
                      "probationPeriodDays",
                      Number(event.target.value),
                    )
                  }
                />
              </Field>
              <Field label="Confirmation Date">
                <TallyDateInput
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                  value={employee.additionalInformation.employmentDetails.confirmationDate}
                  onChange={(value) =>
                    updateDeep(
                      "additionalInformation",
                      "employmentDetails",
                      "confirmationDate",
                      value,
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Work Details" />
            <div className="grid gap-4">
              <Field label="Work Location">
                <Input
                  value={employee.additionalInformation.workDetails.workLocation}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "workDetails",
                      "workLocation",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Department">
                <Select
                  value={employee.additionalInformation.workDetails.department}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "workDetails",
                      "department",
                      event.target.value,
                    )
                  }
                  options={DEPARTMENT_OPTIONS}
                />
              </Field>
              <Field label="Reporting To">
                <Select
                  value={employee.additionalInformation.workDetails.reportingTo}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "workDetails",
                      "reportingTo",
                      event.target.value,
                    )
                  }
                  options={REPORTING_OPTIONS}
                />
              </Field>
              <Field label="Job Title">
                <Input
                  value={employee.additionalInformation.workDetails.jobTitle}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "workDetails",
                      "jobTitle",
                      event.target.value,
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Leave & Attendance" />
            <div className="grid gap-4">
              <Field label="Leave Policy">
                <Select
                  value={employee.additionalInformation.leaveAttendance.leavePolicy}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "leaveAttendance",
                      "leavePolicy",
                      event.target.value,
                    )
                  }
                  options={LEAVE_POLICY_OPTIONS}
                />
              </Field>
              <Field label="Weekly Off">
                <Select
                  value={employee.additionalInformation.leaveAttendance.weeklyOff}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "leaveAttendance",
                      "weeklyOff",
                      event.target.value,
                    )
                  }
                  options={WEEKLY_OFF_OPTIONS}
                />
              </Field>
              <Field label="Attendance Type">
                <Select
                  value={employee.additionalInformation.leaveAttendance.attendanceType}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "leaveAttendance",
                      "attendanceType",
                      event.target.value,
                    )
                  }
                  options={ATTENDANCE_OPTIONS}
                />
              </Field>
              <Field label="Default Leave Balance (Days)">
                <Input
                  type="number"
                  value={employee.additionalInformation.leaveAttendance.defaultLeaveBalanceDays}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "leaveAttendance",
                      "defaultLeaveBalanceDays",
                      Number(event.target.value),
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Skills & Qualifications" />
            <div className="grid gap-4">
              <Field label="Highest Education">
                <Select
                  value={employee.additionalInformation.skillsQualifications.highestEducation}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "skillsQualifications",
                      "highestEducation",
                      event.target.value,
                    )
                  }
                  options={EDUCATION_OPTIONS}
                />
              </Field>
              <Field label="Professional Qualification">
                <Input
                  value={
                    employee.additionalInformation.skillsQualifications.professionalQualification
                  }
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "skillsQualifications",
                      "professionalQualification",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Skills / Certifications">
                <Textarea
                  value={employee.additionalInformation.skillsQualifications.skills}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "skillsQualifications",
                      "skills",
                      event.target.value,
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Emergency Contact" />
            <div className="grid gap-4">
              <Field label="Contact Person Name">
                <Input
                  value={employee.additionalInformation.emergencyContact.name}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "emergencyContact",
                      "name",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <div className="grid grid-cols-[minmax(0,1fr)_170px] gap-3">
                <Field label="Relationship">
                  <Input
                    value={employee.additionalInformation.emergencyContact.relationship}
                    onChange={(event) =>
                      updateDeep(
                        "additionalInformation",
                        "emergencyContact",
                        "relationship",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Phone No.">
                  <Input
                    value={employee.additionalInformation.emergencyContact.phone}
                    onChange={(event) =>
                      updateDeep(
                        "additionalInformation",
                        "emergencyContact",
                        "phone",
                        event.target.value,
                      )
                    }
                  />
                </Field>
              </div>
              <Field label="Address">
                <Textarea
                  value={employee.additionalInformation.emergencyContact.address}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "emergencyContact",
                      "address",
                      event.target.value,
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardTitle title="Previous Employment" />
            <div className="grid gap-4">
              <Field label="Previous Employer">
                <Input
                  value={employee.additionalInformation.previousEmployment.employer}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "previousEmployment",
                      "employer",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Designation">
                <Input
                  value={employee.additionalInformation.previousEmployment.designation}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "previousEmployment",
                      "designation",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Total Experience (Years)">
                <Input
                  type="number"
                  value={employee.additionalInformation.previousEmployment.totalExperienceYears}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "previousEmployment",
                      "totalExperienceYears",
                      Number(event.target.value),
                    )
                  }
                />
              </Field>
              <Field label="Relevant Experience (Years)">
                <Input
                  type="number"
                  value={employee.additionalInformation.previousEmployment.relevantExperienceYears}
                  onChange={(event) =>
                    updateDeep(
                      "additionalInformation",
                      "previousEmployment",
                      "relevantExperienceYears",
                      Number(event.target.value),
                    )
                  }
                />
              </Field>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardTitle title="Other Information" />
          <div className="grid gap-4 md:grid-cols-5">
            <Field label="Marital Status">
              <Select
                value={employee.additionalInformation.otherInformation.maritalStatus}
                onChange={(event) =>
                  updateDeep(
                    "additionalInformation",
                    "otherInformation",
                    "maritalStatus",
                    event.target.value,
                  )
                }
                options={MARITAL_OPTIONS}
              />
            </Field>
            <Field label="Nationality">
              <Input
                value={employee.additionalInformation.otherInformation.nationality}
                onChange={(event) =>
                  updateDeep(
                    "additionalInformation",
                    "otherInformation",
                    "nationality",
                    event.target.value,
                  )
                }
              />
            </Field>
            <Field label="Religion">
              <Select
                value={employee.additionalInformation.otherInformation.religion}
                onChange={(event) =>
                  updateDeep(
                    "additionalInformation",
                    "otherInformation",
                    "religion",
                    event.target.value,
                  )
                }
                options={RELIGION_OPTIONS}
              />
            </Field>
            <Field label="Language Known">
              <Input
                value={employee.additionalInformation.otherInformation.languages}
                onChange={(event) =>
                  updateDeep(
                    "additionalInformation",
                    "otherInformation",
                    "languages",
                    event.target.value,
                  )
                }
              />
            </Field>
            <Field label="Hobbies / Interests">
              <Textarea
                className="min-h-[84px]"
                value={employee.additionalInformation.otherInformation.hobbies}
                onChange={(event) =>
                  updateDeep(
                    "additionalInformation",
                    "otherInformation",
                    "hobbies",
                    event.target.value,
                  )
                }
              />
            </Field>
          </div>
        </section>
      </div>
      <div className="space-y-4">
        <ShortcutCard />
        <RightSummaryCard currencySymbol={currency.symbol} summary={summary} />
      </div>
    </div>
  );

  const tabContent = {
    general: generalTab,
    salary: salaryTab,
    bank: bankTab,
    statutory: statutoryTab,
    additional: additionalTab,
  };

  function renderEditorShell({ inModal = false } = {}) {
    return (
      <div className={inModal ? "space-y-6 bg-white p-4 rounded-lg" : "mx-auto max-w-[1500px] space-y-6"}>
        <SectionCard
          title="Employee Creation"
          subtitle={
            isAlterMode
              ? "Review existing employee masters and update salary, statutory, and bank details."
              : "Create a new employee and define salary details."
          }
          icon={
            <button
              type="button"
              className="rounded-full border border-slate-200 p-2 text-slate-500"
              onClick={() => {
                goBackToReturnTarget();
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          }
          actions={
            <div className="flex flex-wrap gap-3">
              {!inModal ? (
                <>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
                    onClick={exportEmployeeDemoExcel}
                  >
                    <Download className="h-4 w-4" />
                    Export Demo Excel
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
                    onClick={() => masterFileInputRef.current?.click()}
                    disabled={importingMaster}
                  >
                    <Upload className="h-4 w-4" />
                    {importingMaster ? "Importing..." : "Import Excel"}
                  </button>
                  <input
                    ref={masterFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={importEmployeeExcel}
                  />
                </>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
                onClick={() => {
                  if (inModal) {
                    setShowEditModal(false);
                  } else if (returnTo) {
                    goBackToReturnTarget();
                  } else {
                    setEmployee(createEmptyEmployee());
                  }
                }}
              >
                {inModal ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {inModal ? "Close" : "Cancel"}
              </button>
              {!inModal ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
                  onClick={() => persistEmployee({ resetAfterSave: true })}
                  disabled={saving}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Save & New
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white"
                onClick={() => persistEmployee()}
                disabled={saving}
              >
                <Check className="h-4 w-4" />
                {saving ? "Saving..." : isAlterMode ? "Update Employee" : "Save Employee"}
              </button>
            </div>
          }
        >
          {notice ? (
            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {notice}
            </div>
          ) : null}

          <div className="border-b border-slate-200">
            <div className="flex flex-wrap gap-6">
              <TabButton active={activeTab === "general"} onClick={() => setActiveTab("general")}>
                General Information
              </TabButton>
              <TabButton active={activeTab === "salary"} onClick={() => setActiveTab("salary")}>
                Salary Details
              </TabButton>
              <TabButton active={activeTab === "bank"} onClick={() => setActiveTab("bank")}>
                Bank Details
              </TabButton>
              <TabButton active={activeTab === "statutory"} onClick={() => setActiveTab("statutory")}>
                Statutory Details
              </TabButton>
              <TabButton active={activeTab === "additional"} onClick={() => setActiveTab("additional")}>
                Additional Information
              </TabButton>
            </div>
          </div>
        </SectionCard>

        {tabContent[activeTab]}
      </div>
    );
  }

  if (!isAlterMode) {
    return <div className="px-6 py-6">{renderEditorShell()}</div>;
  }

  return (
    <div className="px-6 py-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <SectionCard
          title="Alter Employee"
          subtitle="Browse employee masters and open any record in the edit modal."
          icon={
            <button
              type="button"
              className="rounded-full border border-slate-200 p-2 text-slate-500"
              onClick={goBackToReturnTarget}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          }
        >
          {notice ? (
            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {notice}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-11"
                placeholder="Search employee by name, employee number, designation..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              {loading
                ? "Loading employees..."
                : `${filteredEmployees.length} employee record(s) found.`}
            </div>
          </div>
        </SectionCard>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1.6fr)_180px_180px_160px_130px] gap-4 border-b border-slate-200 px-6 py-4 text-sm font-semibold text-slate-500">
            <span>Employee</span>
            <span>Department</span>
            <span>Designation</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredEmployees.map((row) => (
              <div
                key={row._id}
                className="grid grid-cols-[minmax(0,1.6fr)_180px_180px_160px_130px] gap-4 px-6 py-4 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {row.name || "Unnamed Employee"}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {row.employeeNumber || "Auto Number"}{row.alias ? ` | ${row.alias}` : ""}
                  </p>
                </div>
                <div className="text-slate-700">
                  {row.otherDetails?.department || row.additionalInformation?.workDetails?.department || "-"}
                </div>
                <div className="text-slate-700">
                  {row.personalDetails?.designation || row.additionalInformation?.workDetails?.jobTitle || "-"}
                </div>
                <div>
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {row.otherDetails?.status || row.additionalInformation?.employmentDetails?.employmentStatus || "-"}
                  </span>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      setSelectedEmployeeId(row._id);
                      setActiveTab("general");
                      setShowEditModal(true);
                      setNotice("");
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
            {!loading && filteredEmployees.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                No employee found for this search.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {showEditModal ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 px-6 py-8">
          <div className="mx-auto max-w-[1520px]">
            {renderEditorShell({ inModal: true })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default EmployeeCreationPage;
