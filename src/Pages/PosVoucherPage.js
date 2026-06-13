import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CreditCard,
  Download,
  Focus,
  History,
  Plus,
  Printer,
  ScanLine,
  ShoppingCart,
  Trash2,
  Upload,
  UserSearch,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import api from "../api/api";
import { useLocation, useNavigate } from "react-router-dom";
import SaveVoucherModal from "../Component/SaveVoucherModal";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import useVoucherShortcuts from "../hooks/useVoucherShortcuts";
import {
  previewPosInvoiceDocument,
  printPosInvoiceDocument,
} from "../utils/printVoucher";
import { voucherShortcuts } from "../utils/shortcuts";
import { getCompanyCurrency } from "../utils/currency";
import { resolveItemRateByDate } from "../utils/pricing";
import { formatDateForInput } from "../utils/voucherDates";
import {
  exportWorkbookToFile,
  normalizeExcelNameKey,
  normalizeExcelText,
  padExcelRows,
  parseWorksheetRows,
} from "../utils/voucherExcel";

const POS_TEMPLATE_SHEET = "POS Voucher";
const POS_VOUCHER_RETURN_STORAGE_KEY = "pos-voucher-return-draft";
const emptyAdjustmentRow = { ledgerId: "", mode: "fixed", value: "" };
const emptyBankPaymentRow = { ledgerId: "", amount: "" };

function formatMaskedPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 5) return digits;
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-2);
  const masked = "x".repeat(Math.max(0, digits.length - 5));
  return `${prefix}${masked}${suffix}`;
}

function formatInvoiceTime24(value) {
  const date = value ? new Date(value) : new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}.${minutes}`;
}

function employeeBelongsToSalesRole(employee = {}) {
  return (
    String(employee.under || "")
      .trim()
      .toLowerCase() === "sales"
  );
}

function formatMoney(value, symbol = "Tk") {
  return `${symbol} ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeMonthDayInput(value = "") {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatLongDisplayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.getDate();
  const mod100 = day % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  const month = date.toLocaleString("en-GB", { month: "long" });
  const year = date.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

/* ─── tiny shared primitives ─────────────────────────────────────── */

function Label({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
    >
      {children}
    </label>
  );
}

function Field({ label, htmlFor, action, children }) {
  return (
    <div>
      {(label || action) && (
        <div className="mb-1 flex items-center justify-between gap-2">
          {label && <Label htmlFor={htmlFor}>{label}</Label>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function AddLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
    >
      <Plus className="h-3 w-3" /> Add
    </button>
  );
}

const inputBase =
  "w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 placeholder:text-slate-400";
const numInput = inputBase + " text-right";
const readonlyInput =
  inputBase + " cursor-not-allowed bg-slate-100 text-slate-500";

/* ─── Voucher-number field with dropdown suggestion ─────────────── */
function VoucherNumberInput({ value, onChange, suggestedNumber }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const suggestions = useMemo(() => {
    const base = suggestedNumber || value;
    if (!base) return [];
    const match = base.match(/^(.*?)(\d+)$/);
    if (!match) return [{ label: base, sub: "Current" }];
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    const pad = match[2].length;
    return [
      { label: base, sub: "Next auto number" },
      ...(num > 1
        ? [
            {
              label: `${prefix}${String(num - 1).padStart(pad, "0")}`,
              sub: "Previous",
            },
          ]
        : []),
    ];
  }, [suggestedNumber, value]);

  useEffect(() => {
    function outside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex">
        <input
          data-vnav="true"
          className={inputBase + " rounded-r-none pr-8"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center rounded-r border border-l-0 border-slate-200 bg-slate-50 px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Show number suggestions"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded border border-slate-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.label);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-slate-50 ${
                i === 0 ? "bg-blue-50/60" : ""
              }`}
            >
              <span className="font-medium text-slate-900">{s.label}</span>
              <span className="text-[11px] text-slate-400">{s.sub}</span>
              {i === 0 && (
                <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  Auto
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function PosVoucherPage({
  editVoucherId = "",
  companyIdOverride = "",
}) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const scannerBufferRef = useRef("");
  const scannerLastKeyTimeRef = useRef(0);
  const scannerTimerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { companies, companyId } = useActiveCompany();
  const effectiveCompanyId = companyIdOverride || companyId;
  const companyName =
    companies.find((e) => String(e._id) === String(effectiveCompanyId))?.name ||
    "";
  const isEditMode = Boolean(editVoucherId);

  const [voucherTypeId, setVoucherTypeId] = useState("");
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [salesLedgers, setSalesLedgers] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerInsight, setCustomerInsight] = useState({
    customer: null,
    purchases: [],
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);

  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    customerName: "",
    phone: "",
    salesPersonId: "",
    salesLedger: "",
    address: "",
    birthDate: "",
    anniversary: "",
    note: "",
    additionalRows: [emptyAdjustmentRow],
    redeemLedgerId: "",
    redeemAmount: "",
    bankPayments: [{ ...emptyBankPaymentRow }],
    cashPayment: "",
    cashTendered: "",
    rows: [],
  });

  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId: effectiveCompanyId,
    voucherTypeId,
    companyName,
    voucherLabel: "POS Voucher",
    disabled: isEditMode,
  });

  /* ── master data load ── */
  useEffect(() => {
    async function loadMasters() {
      if (!effectiveCompanyId) return;
      const [
        voucherTypeResponse,
        itemResponse,
        levelResponse,
        defaultResponse,
        employeeResponse,
        balanceResponse,
        salesLedgerResponse,
      ] = await Promise.all([
        api.get(`/companies/${effectiveCompanyId}/voucher-types`),
        api.get(`/companies/${effectiveCompanyId}/items`),
        api.get(`/companies/${effectiveCompanyId}/price-levels`),
        api.get(`/companies/${effectiveCompanyId}/ledgers/defaults`),
        api.get(`/companies/${effectiveCompanyId}/employees`),
        api.get(`/companies/${effectiveCompanyId}/ledgers/with-balances`, {
          params: { to: form.date },
        }),
        api.get(
          `/companies/${effectiveCompanyId}/ledgers/by-group?names=Sales Accounts`,
        ),
      ]);
      setItems(itemResponse.data);
      setPriceLevels(levelResponse.data);
      setEmployees(employeeResponse.data || []);
      setAllLedgers(balanceResponse.data || []);
      setSalesLedgers(salesLedgerResponse.data || []);
      setDefaults(defaultResponse.data || {});
      const voucherType = voucherTypeResponse.data.find(
        (r) => r.name.toLowerCase() === "pos voucher",
      );
      setVoucherTypeId(voucherType?._id || "");
      setForm((prev) => ({
        ...prev,
        salesLedger:
          prev.salesLedger || defaultResponse.data?.salesLedger?._id || "",
      }));
    }
    loadMasters();
  }, [effectiveCompanyId, form.date]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) =>
      prev.number ? prev : { ...prev, number: suggestedNumber },
    );
  }, [suggestedNumber, isEditMode]);

  useEffect(() => {
    if (
      isEditMode ||
      !effectiveCompanyId ||
      !location.state?.restorePosVoucherDraft
    )
      return;
    try {
      const raw = window.sessionStorage.getItem(POS_VOUCHER_RETURN_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (String(draft?.companyId || "") !== String(effectiveCompanyId)) return;
      if (!draft?.form) return;
      setForm(draft.form);
      setStatusMessage(draft.statusMessage || null);
      window.sessionStorage.removeItem(POS_VOUCHER_RETURN_STORAGE_KEY);
    } catch (err) {
      console.error("Unable to restore POS voucher draft:", err);
    }
  }, [effectiveCompanyId, isEditMode, location.state]);

  /* ── customer phone search ── */
  useEffect(() => {
    const phone = form.phone.replace(/\D/g, "");
    if (!effectiveCompanyId || phone.length < 6) {
      setCustomerSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await api.get(`/companies/${effectiveCompanyId}/customers`, {
        params: { phone, limit: 8 },
      });
      setCustomerSuggestions(res.data);
      setShowCustomerSuggestions(true);
    }, 250);
    return () => clearTimeout(handle);
  }, [effectiveCompanyId, form.phone]);

  /* ── purchase history ── */
  useEffect(() => {
    const phone = form.phone.replace(/\D/g, "");
    if (!effectiveCompanyId || phone.length < 6) {
      setCustomerInsight({ customer: null, purchases: [] });
      setHistoryLoading(false);
      return;
    }
    let alive = true;
    setHistoryLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.get(
          `/companies/${effectiveCompanyId}/customers/purchase-history`,
          { params: { phone } },
        );
        if (!alive) return;
        setCustomerInsight({
          customer: res.data?.customer || null,
          purchases: res.data?.purchases || [],
        });
      } catch {
        if (alive) setCustomerInsight({ customer: null, purchases: [] });
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [effectiveCompanyId, form.phone]);

  /* ── auto-focus date on mount ── */
  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector(
        "[data-voucher-date='true']",
      );
      target?.focus();
      target?.select?.();
    });
    return () => window.cancelAnimationFrame(handle);
  }, []);

  /* ── load voucher for edit ── */
  useEffect(() => {
    let alive = true;
    async function loadVoucherForEdit() {
      if (
        !effectiveCompanyId ||
        !editVoucherId ||
        items.length === 0 ||
        allLedgers.length === 0
      )
        return;
      const res = await api.get(
        `/companies/${effectiveCompanyId}/vouchers/${editVoucherId}`,
      );
      const voucher = res.data;
      const selectedSalesLedgerId =
        (voucher.lines || []).find((line) => {
          if (!(Number(line.credit || 0) > 0)) return false;
          const ledger = allLedgers.find(
            (e) => String(e._id) === String(line.ledgerId || ""),
          );
          return (
            String(ledger?.group?.name || "")
              .trim()
              .toLowerCase() === "sales accounts"
          );
        })?.ledgerId || "";
      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date
          ? String(voucher.date).slice(0, 10)
          : formatDateForInput(new Date()),
        customerName: voucher.customerSnapshot?.name || "",
        phone: voucher.customerSnapshot?.phone || "",
        salesPersonId: String(voucher.salesMeta?.employeeId || ""),
        salesLedger: String(
          selectedSalesLedgerId ||
            voucher.posMeta?.salesLedgerId ||
            defaults.salesLedger?._id ||
            "",
        ),
        address: voucher.customerSnapshot?.address || "",
        birthDate: voucher.customerSnapshot?.birthDate || "",
        anniversary: voucher.customerSnapshot?.anniversary || "",
        note: voucher.narration || "",
        additionalRows:
          Array.isArray(voucher.posMeta?.additionalAdjustments) &&
          voucher.posMeta.additionalAdjustments.length > 0
            ? [
                ...voucher.posMeta.additionalAdjustments.map((row) => ({
                  ledgerId: String(row.ledgerId || ""),
                  mode: row.mode || "fixed",
                  value: String(row.value ?? row.amount ?? ""),
                })),
                { ...emptyAdjustmentRow },
              ]
            : [{ ...emptyAdjustmentRow }],
        redeemLedgerId: String(voucher.posMeta?.redeemLedgerId || ""),
        redeemAmount: String(voucher.posMeta?.redeemAmount || ""),
        bankPayments:
          Array.isArray(voucher.posMeta?.bankPayments) &&
          voucher.posMeta.bankPayments.length > 0
            ? voucher.posMeta.bankPayments.map((row) => ({
                ledgerId: String(row.ledgerId || ""),
                amount: String(row.amount || ""),
              }))
            : Number(voucher.posMeta?.cardAmount || 0) > 0
              ? [
                  {
                    ledgerId: String(
                      voucher.posMeta?.bankLedgerId ||
                        defaults.bankLedger?._id ||
                        defaults.bankLedgers?.[0]?._id ||
                        "",
                    ),
                    amount: String(voucher.posMeta?.cardAmount || ""),
                  },
                ]
              : [{ ...emptyBankPaymentRow }],
        cashPayment: String(voucher.posMeta?.cashAmount || ""),
        cashTendered: String(voucher.posMeta?.cashTendered || ""),
        rows: (voucher.inventoryLines || []).map((line) => ({
          itemId: String(line.itemId || ""),
          qty: String(line.qty || 1),
          rate: Number(line.rate || 0),
          mrpRate: Number(line.mrpRate || line.rate || 0),
          discountPercent: Number(line.discountValue || 0),
        })),
      });
    }
    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [
    effectiveCompanyId,
    editVoucherId,
    items.length,
    allLedgers,
    defaults.salesLedger?._id,
  ]);

  /* ── derived data ── */
  const selectedCompany = companies.find(
    (c) => String(c._id) === String(effectiveCompanyId),
  );
  const currency = getCompanyCurrency(selectedCompany);
  const mrpPriceLevelId =
    priceLevels.find((l) => String(l.code || "").toUpperCase() === "MRP")
      ?._id || "";

  const salesEmployees = useMemo(
    () => employees.filter(employeeBelongsToSalesRole),
    [employees],
  );

  const salesLedgerOptions = useMemo(
    () => salesLedgers.map((l) => ({ value: String(l._id), label: l.name })),
    [salesLedgers],
  );
  const salesEmployeeOptions = useMemo(
    () =>
      salesEmployees.map((e) => ({
        value: String(e._id),
        label: e.name || e.employeeNumber || "Unnamed",
      })),
    [salesEmployees],
  );
  const selectedSalesPerson = useMemo(
    () =>
      salesEmployees.find(
        (e) => String(e._id) === String(form.salesPersonId),
      ) || null,
    [salesEmployees, form.salesPersonId],
  );
  const ledgerMap = useMemo(
    () => new Map(allLedgers.map((l) => [String(l._id), l])),
    [allLedgers],
  );
  const selectedSalesLedger =
    ledgerMap.get(String(form.salesLedger || "")) ||
    salesLedgers.find(
      (l) => String(l._id) === String(form.salesLedger || ""),
    ) ||
    null;
  const bankLedgerOptions = useMemo(() => {
    const defaultBankLedgers = Array.isArray(defaults.bankLedgers)
      ? defaults.bankLedgers
      : defaults.bankLedger
        ? [defaults.bankLedger]
        : [];
    const bankLedgers =
      defaultBankLedgers.length > 0
        ? defaultBankLedgers
        : allLedgers.filter(
            (l) =>
              String(l.group?.name || "").trim().toLowerCase() ===
              "bank accounts",
          );
    return bankLedgers.map((l) => ({
      value: String(l._id),
      label: l.name,
    }));
  }, [allLedgers, defaults.bankLedger, defaults.bankLedgers]);

  const expenseLedgerOptions = useMemo(
    () =>
      allLedgers
        .filter(
          (l) => String(l.group?.nature || "").toUpperCase() === "EXPENSE",
        )
        .map((l) => ({ value: String(l._id), label: l.name })),
    [allLedgers],
  );
  const itemNameMap = useMemo(
    () =>
      new Map(items.map((item) => [normalizeExcelNameKey(item.name), item])),
    [items],
  );

  const selectedCustomer = customerSuggestions.find(
    (c) => c.phone === form.phone.replace(/\D/g, ""),
  );
  const activeCustomer = customerInsight.customer || selectedCustomer || null;
  const customerPhoneOptions = useMemo(
    () =>
      customerSuggestions.map((customer) => ({
        value: customer.phone || "",
        label: customer.phone
          ? `${customer.phone}`
          : customer.name || "Customer",
        // meta:
        //   [
        //     customer.companyName || "",
        //     customer.rewardPoints !== undefined
        //       ? `${Number(customer.rewardPoints || 0).toLocaleString("en-IN")} pts`
        //       : "",
        //   ]
        //     .filter(Boolean)
        //     .join(" • "),
      })),
    [customerSuggestions],
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items.slice(0, 8);
    return items
      .filter((item) =>
        [item.name, item.alias, item.barcode, ...(item.secondaryAliases || [])]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [items, searchTerm]);

  /* ── calculations ── */
  const lineAmount = (row) => {
    const gross = Number(row.qty || 0) * Number(row.rate || 0);
    const discount = gross * (Number(row.discountPercent || 0) / 100);
    return Number((gross - discount).toFixed(2));
  };

  const validRows = form.rows.filter((r) => r.itemId && Number(r.qty) > 0);
  const subtotal = validRows.reduce((s, r) => s + lineAmount(r), 0);
  const rowDiscountTotal = validRows.reduce((s, r) => {
    const gross = Number(r.qty || 0) * Number(r.rate || 0);
    return s + gross * (Number(r.discountPercent || 0) / 100);
  }, 0);

  const adjustmentRows = (form.additionalRows || [])
    .map((row) => {
      const ledger = ledgerMap.get(String(row.ledgerId || "")) || null;
      const mode = row.mode || "fixed";
      const rawValue = Number(row.value || 0);
      const calculatedAmount =
        mode === "percentage"
          ? Number(((subtotal * rawValue) / 100).toFixed(2))
          : Number(rawValue.toFixed(2));
      return { ...row, ledger, nature: "EXPENSE", calculatedAmount };
    })
    .filter((r) => r.ledgerId);

  const additionalExpenseAmount = adjustmentRows.reduce(
    (s, r) => s + r.calculatedAmount,
    0,
  );
  const redeemLedger =
    ledgerMap.get(String(form.redeemLedgerId || "")) || null;
  const rewardRedeemed = Number(
    (
      form.redeemLedgerId && Number(form.redeemAmount || 0) > 0
        ? Number(form.redeemAmount || 0)
        : 0
    ).toFixed(2),
  );
  const totalDiscountAmount = Number(
    (rowDiscountTotal + additionalExpenseAmount + rewardRedeemed).toFixed(2),
  );
  const totalAmount = Math.max(
    0,
    Number((subtotal - additionalExpenseAmount - rewardRedeemed).toFixed(2)),
  );
  const totalItems = validRows.reduce((s, r) => s + Number(r.qty || 0), 0);
  const rewardToEarn = validRows.reduce(
    (s, r) => s + Number(r.mrpRate || r.rate || 0) * Number(r.qty || 0),
    0,
  );
  const bankPayments = (form.bankPayments || [])
    .filter((row) => row.ledgerId && Number(row.amount || 0) > 0)
    .map((row) => ({
      ...row,
      ledger: ledgerMap.get(String(row.ledgerId || "")) || null,
      amount: Number(row.amount || 0),
    }));
  const bankPaymentTotal = bankPayments.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const cashPayment = Number(form.cashPayment || 0);
  const changeAmount = Math.max(
    0,
    Number(form.cashTendered || 0) - cashPayment,
  );
  const customerLine = [form.customerName, formatMaskedPhone(form.phone)]
    .filter(Boolean)
    .join(" ");
  const customerPurchases = customerInsight.purchases || [];

  /* ── print data ── */
  const printData = useMemo(() => {
    const voucherDate = form.date ? new Date(form.date) : new Date();
    const fmt = (v) =>
      Number(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    return {
      documentTitle: `POS Invoice - ${form.number || "Preview"}`,
      voucherTitle: "Invoice",
      companyName:
        selectedCompany?.mailingName || selectedCompany?.name || "Company",
      companyLines: [
        selectedCompany?.address || "",
        [
          selectedCompany?.city,
          selectedCompany?.state,
          selectedCompany?.country,
        ]
          .filter(Boolean)
          .join(", "),
        selectedCompany?.mobile
          ? `Mobile Number: ${selectedCompany.mobile}`
          : selectedCompany?.telephone
            ? `Mobile Number: ${selectedCompany.telephone}`
            : "",
        selectedCompany?.vatTinNumber
          ? `BIN NUMBER: ${selectedCompany.vatTinNumber}`
          : "",
        "MUSHAK 6.3",
      ].filter(Boolean),
      billNo: form.number || "-",
      timeText: formatInvoiceTime24(voucherDate),
      dateText: form.date
        ? new Date(form.date).toLocaleDateString("en-GB").replace(/\//g, "-")
        : "-",
      userName: "Admin",
      buyerLine: customerLine || "POS Sales",
      items: validRows.map((row) => {
        const item = items.find((e) => e._id === row.itemId);
        return {
          description: item?.name || "-",
          qty: String(Number(row.qty || 0)),
          rate: fmt(row.rate),
          amount: fmt(lineAmount(row)),
        };
      }),
      discountLine:
        rowDiscountTotal > 0
          ? { label: "Product Promotion (-)", value: fmt(rowDiscountTotal) }
          : null,
      adjustmentLines: adjustmentRows
        .filter((r) => Number(r.calculatedAmount || 0) !== 0)
        .map((r) => ({
          label: r.ledger?.name || "Additional Discount",
          value: fmt(r.calculatedAmount),
        }))
        .concat(
          rewardRedeemed > 0
            ? [
                {
                  label: redeemLedger?.name || "Redeem Points",
                  value: fmt(rewardRedeemed),
                },
              ]
            : [],
        ),
      totalText: fmt(totalAmount),
      totalQtyText: String(totalItems),
      payments: [
        ...bankPayments.map((row) => ({
          label: `${row.ledger?.name || "Bank"} :`,
          value: fmt(row.amount),
        })),
        { label: "Cash :", value: fmt(cashPayment) },
        { label: "Cash Tendered :", value: fmt(form.cashTendered || 0) },
        { label: "Balance :", value: fmt(changeAmount) },
        { label: "Total Paid", value: fmt(totalAmount) },
      ],
      footerLines: [
        "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
        `Thank you for shopping at ${selectedCompany?.name || "our store"}. Your business is greatly appreciated.`,
      ],
    };
  }, [
    selectedCompany,
    form,
    validRows,
    items,
    rowDiscountTotal,
    totalAmount,
    totalItems,
    adjustmentRows,
    redeemLedger,
    rewardRedeemed,
    bankPayments,
    cashPayment,
    changeAmount,
    customerLine,
  ]);

  /* ── auto payment split ── */
  useEffect(() => {
    const safeBankTotal = Math.min(
      Math.max(0, Number(bankPaymentTotal || 0)),
      totalAmount,
    );
    const autoCash = Math.max(0, Number((totalAmount - safeBankTotal).toFixed(2)));
    const nextCash = String(autoCash);
    if (String(form.cashPayment) !== nextCash) {
      setForm((c) => ({ ...c, cashPayment: nextCash }));
    }
  }, [totalAmount, bankPaymentTotal, form.cashPayment]);

  /* ── global scanner ── */
  useEffect(() => {
    const handleGlobalScannerInput = (event) => {
      if (showSaveConfirm) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const activeElement = document.activeElement;
      const activeTag = activeElement?.tagName?.toLowerCase();
      const isSearchFocused = activeElement === searchInputRef.current;
      const isTypingInEditable =
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        activeElement?.isContentEditable;

      if (event.key === "Enter") {
        const bufferedCode = scannerBufferRef.current.trim();
        scannerBufferRef.current = "";
        if (scannerTimerRef.current) {
          window.clearTimeout(scannerTimerRef.current);
          scannerTimerRef.current = null;
        }
        if (bufferedCode.length >= 4) {
          event.preventDefault();
          handleBarcodeSubmit(bufferedCode);
          return;
        }
        if (isSearchFocused && searchTerm.trim()) {
          event.preventDefault();
          handleBarcodeSubmit(searchTerm);
          return;
        }
        return;
      }
      if (event?.key?.length !== 1) return;
      const now = Date.now();
      const elapsed = now - scannerLastKeyTimeRef.current;
      scannerLastKeyTimeRef.current = now;
      if (elapsed > 80) scannerBufferRef.current = "";
      scannerBufferRef.current += event.key;
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = window.setTimeout(() => {
        scannerBufferRef.current = "";
        scannerTimerRef.current = null;
      }, 120);
      const looksLikeScanner =
        scannerBufferRef.current.length >= 4 && elapsed > 0 && elapsed <= 80;
      if (looksLikeScanner && !isSearchFocused) searchInputRef.current?.focus();
      if (looksLikeScanner && !isSearchFocused && !isTypingInEditable)
        setSearchTerm(scannerBufferRef.current);
    };
    window.addEventListener("keydown", handleGlobalScannerInput, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalScannerInput, true);
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
    };
  }, [filteredItems, items, searchTerm, showSaveConfirm]);

  /* ── helpers ── */
  const focusSearchInput = () => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    });
  };

  const findItemByScanValue = (value) => {
    const code = String(value || "")
      .trim()
      .toLowerCase();
    if (!code) return null;
    return (
      items.find(
        (item) =>
          String(item.barcode || "")
            .trim()
            .toLowerCase() === code ||
          String(item.alias || "")
            .trim()
            .toLowerCase() === code ||
          (item.secondaryAliases || []).some(
            (a) =>
              String(a || "")
                .trim()
                .toLowerCase() === code,
          ),
      ) ||
      items.find(
        (item) =>
          String(item.name || "")
            .trim()
            .toLowerCase() === code,
      ) ||
      null
    );
  };

  const addItemById = (itemId) => {
    const item = items.find((e) => e._id === itemId);
    if (!item) return;
    const mrpRate = resolveItemRateByDate(item, mrpPriceLevelId, form.date);
    setForm((current) => {
      const existingIndex = current.rows.findIndex(
        (r) => String(r.itemId) === String(item._id),
      );
      if (existingIndex >= 0) {
        const nextRows = [...current.rows];
        nextRows[existingIndex] = {
          ...nextRows[existingIndex],
          qty: String(Number(nextRows[existingIndex].qty || 0) + 1),
        };
        return { ...current, rows: nextRows };
      }
      return {
        ...current,
        rows: [
          ...current.rows,
          {
            itemId: item._id,
            qty: "1",
            rate: mrpRate,
            mrpRate,
            discountPercent: 0,
          },
        ],
      };
    });
    setSearchTerm("");
    focusSearchInput();
  };

  const handleBarcodeSubmit = (value) => {
    const scanValue = String(value || "").trim();
    if (!scanValue) return false;
    const exactItem = findItemByScanValue(scanValue);
    if (exactItem) {
      addItemById(exactItem._id);
      return true;
    }
    const single = filteredItems.length === 1 ? filteredItems[0] : null;
    if (single) {
      addItemById(single._id);
      return true;
    }
    setSearchTerm(scanValue);
    focusSearchInput();
    return false;
  };

  const addAdjustmentRow = () => {
    setForm((c) => ({
      ...c,
      additionalRows: [...(c.additionalRows || []), { ...emptyAdjustmentRow }],
    }));
  };

  const updateRow = (index, field, value) => {
    setForm((c) => {
      const nextRows = [...c.rows];
      nextRows[index] = { ...nextRows[index], [field]: value };
      return { ...c, rows: nextRows };
    });
  };

  const removeRow = (index) => {
    setForm((c) => ({ ...c, rows: c.rows.filter((_, i) => i !== index) }));
    focusSearchInput();
  };

  const updateAdjustmentRow = (index, field, value) => {
    setForm((c) => {
      const nextRows = [...(c.additionalRows || [])];
      nextRows[index] = {
        ...(nextRows[index] || emptyAdjustmentRow),
        [field]: value,
      };
      return { ...c, additionalRows: nextRows };
    });
  };

  const removeAdjustmentRow = (index) => {
    setForm((c) => {
      const nextRows = (c.additionalRows || []).filter((_, i) => i !== index);
      return {
        ...c,
        additionalRows:
          nextRows.length > 0 ? nextRows : [{ ...emptyAdjustmentRow }],
      };
    });
  };

  const addBankPaymentRow = () => {
    setForm((c) => ({
      ...c,
      bankPayments: [...(c.bankPayments || []), { ...emptyBankPaymentRow }],
    }));
  };

  const updateBankPaymentRow = (index, field, value) => {
    setForm((c) => {
      const nextRows = [...(c.bankPayments || [{ ...emptyBankPaymentRow }])];
      nextRows[index] = {
        ...(nextRows[index] || emptyBankPaymentRow),
        [field]: value,
      };
      return { ...c, bankPayments: nextRows };
    });
  };

  const removeBankPaymentRow = (index) => {
    setForm((c) => {
      const nextRows = (c.bankPayments || []).filter((_, i) => i !== index);
      return {
        ...c,
        bankPayments:
          nextRows.length > 0 ? nextRows : [{ ...emptyBankPaymentRow }],
      };
    });
  };

  const applyCustomer = (customer) => {
    setForm((c) => ({
      ...c,
      customerName: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      birthDate: customer.birthDate || "",
      anniversary: customer.anniversary || "",
    }));
    // setShowCustomerSuggestions(false);
    // setActiveCustomerIndex(0);
    // focusSearchInput();
  };

  /* ── excel helpers ── */
  const buildTemplateWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ["POS Voucher Import Template"],
      [""],
      ["Item Name", "Qty", "Rate", "Disc %"],
      ...padExcelRows([["", "", "", ""]], 8, () => ["", "", "", ""]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 34 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, POS_TEMPLATE_SHEET);
    const refs = [
      ["Item Name", "MRP / Current Rate", "Barcode / Alias"],
      ...items.map((item) => [
        item.name,
        resolveItemRateByDate(item, mrpPriceLevelId, form.date),
        item.barcode || item.alias || "",
      ]),
    ];
    const refSheet = XLSX.utils.aoa_to_sheet(refs);
    refSheet["!cols"] = [{ wch: 36 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, refSheet, "Reference Data");
    return workbook;
  };

  const handleExportTemplate = () => {
    const workbook = buildTemplateWorkbook();
    const slug =
      normalizeExcelNameKey(companyName).replace(/[^a-z0-9]+/g, "-") ||
      "company";
    exportWorkbookToFile(workbook, `${slug}-pos-voucher-import-template.xlsx`);
    setStatusMessage({
      tone: "success",
      title: "Template exported",
      description:
        "Fill the same structure and import it back to load items into the form.",
    });
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportBusy(true);
    setStatusMessage(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = parseWorksheetRows(workbook, POS_TEMPLATE_SHEET);
      const headerIndex = rows.findIndex(
        (r) =>
          normalizeExcelText(r[0]) === "Item Name" &&
          normalizeExcelText(r[1]) === "Qty",
      );
      if (headerIndex === -1) throw new Error("POS item table is missing.");
      const importedRows = rows
        .slice(headerIndex + 1)
        .map((r) => ({
          itemName: normalizeExcelText(r[0]),
          qty: normalizeExcelText(r[1]),
          rate: normalizeExcelText(r[2]),
          discountPercent: normalizeExcelText(r[3]),
        }))
        .filter((r) => r.itemName || r.qty || r.rate || r.discountPercent);
      if (!importedRows.length)
        throw new Error("At least one item row is required.");
      const resolvedRows = importedRows.map((row, index) => {
        const item = itemNameMap.get(normalizeExcelNameKey(row.itemName));
        if (!item)
          throw new Error(
            `Row ${index + 1}: Item "${row.itemName}" not found.`,
          );
        const qty = Number(row.qty || 0);
        const rate =
          Number(row.rate || 0) ||
          Number(resolveItemRateByDate(item, mrpPriceLevelId, form.date) || 0);
        const discountPercent = Number(row.discountPercent || 0);
        if (!(qty > 0)) throw new Error(`Row ${index + 1}: Qty must be > 0.`);
        if (!(rate > 0)) throw new Error(`Row ${index + 1}: Rate must be > 0.`);
        return {
          itemId: item._id,
          qty: String(qty),
          rate,
          mrpRate: Number(
            resolveItemRateByDate(item, mrpPriceLevelId, form.date) || rate,
          ),
          discountPercent: String(discountPercent || ""),
        };
      });
      setForm((c) => ({ ...c, rows: resolvedRows }));
      setStatusMessage({
        tone: "success",
        title: "Items loaded from Excel",
        description: `${resolvedRows.length} row(s) loaded. Review customer and payment details, then save.`,
      });
    } catch (err) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description: err?.message || "Unable to import.",
      });
    } finally {
      setImportBusy(false);
    }
  };

  const resetForm = (nextNumber = suggestedNumber) => {
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      customerName: "",
      phone: "",
      salesPersonId: "",
      salesLedger: defaults.salesLedger?._id || "",
      address: "",
      birthDate: "",
      anniversary: "",
      note: "",
      additionalRows: [{ ...emptyAdjustmentRow }],
      redeemLedgerId: "",
      redeemAmount: "",
      bankPayments: [{ ...emptyBankPaymentRow }],
      cashPayment: "0",
      cashTendered: "",
      rows: [],
    });
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    setSearchTerm("");
    focusSearchInput();
  };

  const navigateToCreateMaster = (path) => {
    if (isEditMode) return;
    try {
      window.sessionStorage.setItem(
        POS_VOUCHER_RETURN_STORAGE_KEY,
        JSON.stringify({ companyId: effectiveCompanyId, form, statusMessage }),
      );
    } catch (err) {
      console.error(err);
    }
    navigate(path, {
      state: {
        returnTo: `${location.pathname}${location.search || ""}`,
        restorePosVoucherDraft: true,
      },
    });
  };

  const submit = async (options = {}) => {
    if (!voucherTypeId) return alert("POS Voucher type is missing");
    if (!form.customerName.trim()) return alert("Customer name is required");
    if (form.phone.replace(/\D/g, "").length < 6)
      return alert("Valid phone number is required");
    if (!form.salesLedger && !defaults.salesLedger?._id)
      return alert("Please select a sales ledger");
    if (validRows.length === 0) return alert("Please add at least one item");
    const incompleteAdj = (form.additionalRows || []).find(
      (r) => !r.ledgerId && Number(r.value || 0) !== 0,
    );
    if (incompleteAdj)
      return alert("Please select a discount ledger before entering a value.");
    if (!form.redeemLedgerId && Number(form.redeemAmount || 0) !== 0)
      return alert(
        "Please select a redeem discount ledger before entering redeem points.",
      );
    if (Number(form.redeemAmount || 0) < 0)
      return alert("Redeem points cannot be negative.");
    if (
      rewardRedeemed > 0 &&
      rewardRedeemed > Number(activeCustomer?.rewardPoints || 0)
    )
      return alert("Customer does not have enough reward points.");
    const incompleteBankPayment = (form.bankPayments || []).find(
      (row) => !row.ledgerId && Number(row.amount || 0) !== 0,
    );
    if (incompleteBankPayment) {
      return alert("Please select a bank ledger before entering a bank payment amount.");
    }
    if (
      Number((bankPaymentTotal + cashPayment).toFixed(2)) !==
      Number(totalAmount.toFixed(2))
    )
      return alert("Cash + bank payment must match total payable");

    const lines = [
      ...(cashPayment > 0 && defaults.cashLedger?._id
        ? [{ ledgerId: defaults.cashLedger._id, debit: cashPayment, credit: 0 }]
        : []),
      ...bankPayments.map((row) => ({
        ledgerId: row.ledgerId,
        debit: row.amount,
        credit: 0,
      })),
      {
        ledgerId: form.salesLedger || defaults.salesLedger?._id || "",
        debit: 0,
        credit: subtotal,
      },
    ];
    adjustmentRows.forEach((row) => {
      const amount = Number(row.calculatedAmount || 0);
      if (!row.ledgerId || amount === 0) return;
      lines.push({
        ledgerId: row.ledgerId,
        debit: amount > 0 ? amount : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
      });
    });
    if (form.redeemLedgerId && rewardRedeemed > 0) {
      lines.push({
        ledgerId: form.redeemLedgerId,
        debit: rewardRedeemed,
        credit: 0,
      });
    }

    const payload = {
      voucherTypeId,
      voucherName: "POS Voucher",
      number: form.number,
      date: form.date,
      narration: form.note,
      customerSnapshot: {
        name: form.customerName,
        phone: form.phone,
        address: form.address,
        birthDate: form.birthDate,
        anniversary: form.anniversary,
      },
      salesMeta: selectedSalesPerson
        ? {
            employeeId: selectedSalesPerson._id,
            employeeName: selectedSalesPerson.name || "",
            employeeNumber: selectedSalesPerson.employeeNumber || "",
            department: selectedSalesPerson.otherDetails?.department || "",
            designation: selectedSalesPerson.personalDetails?.designation || "",
          }
        : {},
      lines,
      inventoryLines: validRows.map((row) => {
        const item = items.find((e) => e._id === row.itemId);
        const gross = Number(row.qty || 0) * Number(row.rate || 0);
        const dv = Number(row.discountPercent || 0);
        return {
          itemId: row.itemId,
          itemName: item?.name || "",
          qty: Number(row.qty || 0),
          billedQty: Number(row.qty || 0),
          rate: Number(row.rate || 0),
          mrpRate: Number(row.mrpRate || row.rate || 0),
          discount: gross * (dv / 100),
          discountType: "percent",
          discountValue: dv,
          amount: lineAmount(row),
          groupId: item?.groupId || null,
          groupName: item?.groupName || "",
          stockCategoryId: item?.stockCategoryId || null,
          stockCategoryName: item?.stockCategory || "",
          alias: item?.alias || "",
          barcode: item?.barcode || "",
        };
      }),
      posMeta: {
        salesLedgerId: form.salesLedger || defaults.salesLedger?._id || "",
        additionalAdjustments: adjustmentRows.map((r) => ({
          ledgerId: r.ledgerId,
          ledgerName: r.ledger?.name || "",
          nature: "EXPENSE",
          mode: r.mode || "fixed",
          value: Number(r.value || 0),
          amount: r.calculatedAmount,
        })),
        additionalExpenseLedgerId: adjustmentRows[0]?.ledgerId || null,
        additionalExpenseMode: adjustmentRows[0]?.mode || "fixed",
        additionalExpenseValue: Number(adjustmentRows[0]?.value || 0),
        additionalExpenseAmount,
        discountType: "fixed",
        discountValue: 0,
        invoiceDiscount: 0,
        redeemLedgerId: form.redeemLedgerId || null,
        redeemLedgerName: redeemLedger?.name || "",
        redeemAmount: rewardRedeemed,
        subtotal,
        totalAmount,
        rewardEarned: rewardToEarn,
        rewardRedeemed,
        cashAmount: cashPayment,
        cardAmount: bankPaymentTotal,
        bankPayments: bankPayments.map((row) => ({
          ledgerId: row.ledgerId,
          ledgerName: row.ledger?.name || "",
          amount: row.amount,
        })),
        cashTendered: Number(form.cashTendered || 0),
        changeAmount,
      },
    };

    if (isEditMode) {
      await api.put(
        `/companies/${effectiveCompanyId}/vouchers/${editVoucherId}`,
        payload,
      );
    } else {
      await api.post(`/companies/${effectiveCompanyId}/pos-vouchers`, {
        voucherTypeId,
        number: form.number,
        date: form.date,
        narration: form.note,
        customer: {
          name: form.customerName,
          phone: form.phone,
          address: form.address,
          birthDate: form.birthDate,
          anniversary: form.anniversary,
        },
        salesMeta: selectedSalesPerson
          ? {
              employeeId: selectedSalesPerson._id,
              employeeName: selectedSalesPerson.name || "",
              employeeNumber: selectedSalesPerson.employeeNumber || "",
              department: selectedSalesPerson.otherDetails?.department || "",
              designation:
                selectedSalesPerson.personalDetails?.designation || "",
            }
          : {},
        salesLedgerId: form.salesLedger || defaults.salesLedger?._id || "",
        additionalAdjustments: adjustmentRows.map((r) => ({
          ledgerId: r.ledgerId,
          ledgerName: r.ledger?.name || "",
          nature: "EXPENSE",
          mode: r.mode || "fixed",
          value: Number(r.value || 0),
          amount: r.calculatedAmount,
        })),
        redeemedPoints: rewardRedeemed,
        redeemLedgerId: form.redeemLedgerId || null,
        redeemLedgerName: redeemLedger?.name || "",
        payments: {
          bankPayments: bankPayments.map((row) => ({
            ledgerId: row.ledgerId,
            amount: row.amount,
          })),
          cash: cashPayment,
          cashTendered: Number(form.cashTendered || 0),
        },
        items: validRows.map((row) => {
          const item = items.find((e) => e._id === row.itemId);
          return {
            itemId: row.itemId,
            qty: Number(row.qty || 0),
            rate: Number(row.rate || 0),
            mrpRate: Number(row.mrpRate || row.rate || 0),
            discountType: "percent",
            discountValue: Number(row.discountPercent || 0),
            groupName: item?.groupName || "",
            stockCategoryName: item?.stockCategory || "",
          };
        }),
      });
    }

    if (options.printAfterSave) {
      await options.printVoucher?.();
    } else {
      alert(
        isEditMode
          ? "POS voucher updated successfully"
          : "POS voucher completed successfully",
      );
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
  };

  /* ── enter-key navigation ── */
  const handleEnterNavigation = (event) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    if (showSaveConfirm) return;
    const target = event.target;
    if (target.tagName?.toLowerCase() === "button") return;
    if (target === searchInputRef.current) {
      event.preventDefault();
      handleBarcodeSubmit(searchTerm);
      return;
    }
    event.preventDefault();
    const fields = Array.from(
      containerRef.current?.querySelectorAll(
        "[data-vnav='true'], [data-voucher-date='true']",
      ) || [],
    ).filter(
      (f) =>
        !f.disabled &&
        f.getAttribute("aria-disabled") !== "true" &&
        f.type !== "hidden" &&
        f.offsetParent !== null,
    );
    const currentIndex = fields.indexOf(target);
    const next = fields[currentIndex + 1] || fields[0];
    next?.focus();
    next?.select?.();
  };

  useVoucherShortcuts({
    shortcuts: voucherShortcuts,
    containerRef,
    onAddRow: () => focusSearchInput(),
    onSaveRequest: () => setShowSaveConfirm(true),
  });

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────── */
  return (
    <div
      ref={containerRef}
      onKeyDownCapture={handleEnterNavigation}
      className="min-h-screen bg-slate-100 p-4"
    >
      <div className="mx-auto max-w-[1480px] space-y-4">
        {/* ── Page header ── */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                POS Sales Voucher
              </h1>
              <p className="text-[12px] text-slate-500">
                Fast checkout · barcode scanner · reward points
              </p>
            </div>
          </div>
          {!isEditMode && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" /> Export template
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />{" "}
                {importBusy ? "Importing…" : "Import Excel"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          )}
        </div>

        {/* ── Status message ── */}
        {statusMessage && (
          <div
            className={`rounded-xl border px-4 py-3 text-[13px] ${statusMessage.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
          >
            <p className="font-semibold">{statusMessage.title}</p>
            <p className="mt-0.5">{statusMessage.description}</p>
          </div>
        )}

        {/* ── Voucher info strip ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Voucher no.">
              <VoucherNumberInput
                value={form.number}
                onChange={(v) => setForm((c) => ({ ...c, number: v }))}
                suggestedNumber={suggestedNumber}
              />
            </Field>
            <Field label="Voucher date">
              <TallyDateInput
                data-voucher-date="true"
                data-vnav="true"
                className={inputBase}
                value={form.date}
                onChange={(v) => setForm((c) => ({ ...c, date: v }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Select Sales ledger"
                action={
                  <AddLink
                    onClick={() =>
                      navigateToCreateMaster("/masters/create/ledger")
                    }
                  />
                }
              >
                <SearchableSelect
                  options={salesLedgerOptions}
                  value={form.salesLedger}
                  onChange={(v) => setForm((c) => ({ ...c, salesLedger: v }))}
                  placeholder="Search sales ledger…"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {selectedSalesLedger?.name || "No ledger selected"}
                </p>
              </Field>
            </div>
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Left column ── */}
          <div className="space-y-4">
            {/* Customer card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <UserSearch className="h-4 w-4 text-slate-400" /> Customer
                details
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
                {/* Phone */}
                <div className="relative lg:col-span-3">
                  <Field label="Mobile number">
                    <SearchableSelect
                      options={customerPhoneOptions}
                      value={form.phone}
                      allowCustomValue
                      onChange={(value) => {
                        const selected = customerSuggestions.find(
                          (customer) => String(customer.phone || "") === String(value),
                        );
                        if (selected) {
                          applyCustomer(selected);
                          return;
                        }
                        setForm((c) => ({ ...c, phone: value }));
                        setShowCustomerSuggestions(true);
                        setActiveCustomerIndex(0);
                      }}
                      placeholder="Search or enter mobile number"
                      inputClassName="rounded border-slate-200 bg-slate-50 text-[13px] focus:border-blue-500 focus:bg-white"
                    />
                  </Field>
                </div>

                {/* Name */}
                <div className="lg:col-span-3">
                  <Field label="Customer name">
                    <input
                      data-vnav="true"
                      className={inputBase}
                      value={form.customerName}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, customerName: e.target.value }))
                      }
                      placeholder="Full name"
                    />
                  </Field>
                </div>

                {/* Sales person */}
                <div className="lg:col-span-3">
                  <Field
                    label="Sales person"
                    action={
                      <AddLink
                        onClick={() =>
                          navigateToCreateMaster("/masters/create/employee")
                        }
                      />
                    }
                  >
                    <SearchableSelect
                      options={[
                        { label: "Select sales person", value: "" },
                        ...salesEmployeeOptions,
                      ]}
                      value={form.salesPersonId}
                      onChange={(v) =>
                        setForm((c) => ({ ...c, salesPersonId: v }))
                      }
                      placeholder="Search…"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      {selectedSalesPerson?.employeeNumber
                        ? `Emp. no. ${selectedSalesPerson.employeeNumber}`
                        : "Sales dept. employees only"}
                    </p>
                  </Field>
                </div>

                {/* Reward badge */}
                <div className="flex items-end lg:col-span-3">
                  <div className="w-full rounded-lg bg-emerald-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                      Reward points
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-700">
                      {Number(activeCustomer?.rewardPoints || 0).toLocaleString(
                        "en-IN",
                      )}
                    </p>
                  </div>
                </div>

                {/* Address */}
                <div className="sm:col-span-2 lg:col-span-8">
                  <Field label="Address (optional)">
                    <input
                      data-vnav="true"
                      className={inputBase}
                      value={form.address}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, address: e.target.value }))
                      }
                      placeholder="Street, area…"
                    />
                  </Field>
                </div>

                {/* Birth date */}
                <div className="lg:col-span-2">
                  <Field label="Birth date (dd/mm)">
                    <input
                      data-vnav="true"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="dd/mm"
                      className={inputBase}
                      value={form.birthDate}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          birthDate: normalizeMonthDayInput(e.target.value),
                        }))
                      }
                    />
                  </Field>
                </div>

                {/* Anniversary */}
                <div className="lg:col-span-2">
                  <Field label="Anniversary (dd/mm)">
                    <input
                      data-vnav="true"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="dd/mm"
                      className={inputBase}
                      value={form.anniversary}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          anniversary: normalizeMonthDayInput(e.target.value),
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Items card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    data-vnav="true"
                    data-barcode-search="true"
                    className={inputBase + " pl-8"}
                    placeholder="Scan barcode or search item by name / code…"
                    value={searchTerm}
                    onFocus={() => {
                      scannerBufferRef.current = "";
                    }}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      handleBarcodeSubmit(searchTerm);
                    }}
                  />
                  {searchTerm && filteredItems.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                      {filteredItems.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
                          onClick={() => addItemById(item._id)}
                        >
                          <div>
                            <p className="text-[13px] font-medium text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {item.barcode || item.alias || "—"}
                            </p>
                          </div>
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            Add
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[13px] font-medium text-blue-700 hover:bg-blue-100"
                  onClick={focusSearchInput}
                >
                  <Focus className="h-3.5 w-3.5" /> Focus scanner
                </button>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="w-8 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        #
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Item
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Code
                      </th>
                      <th className="w-24 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Qty
                      </th>
                      <th className="w-28 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Rate
                      </th>
                      <th className="w-24 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Disc %
                      </th>
                      <th className="w-28 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Amount
                      </th>
                      <th className="w-10 px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {form.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-[13px] text-slate-400"
                        >
                          Scan a barcode or search above to add items
                        </td>
                      </tr>
                    ) : (
                      form.rows.map((row, index) => {
                        const item = items.find((e) => e._id === row.itemId);
                        return (
                          <tr key={index} className="group hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {item?.name || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {item?.barcode || item?.alias || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                data-vnav="true"
                                className={numInput + " w-full"}
                                value={row.qty}
                                onChange={(e) =>
                                  updateRow(index, "qty", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                data-vnav="true"
                                className={numInput + " w-full"}
                                value={row.rate}
                                onChange={(e) =>
                                  updateRow(index, "rate", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                data-vnav="true"
                                className={numInput + " w-full"}
                                value={row.discountPercent}
                                onChange={(e) =>
                                  updateRow(
                                    index,
                                    "discountPercent",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">
                              {formatMoney(lineAmount(row), currency.symbol)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeRow(index)}
                                className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                                aria-label="Remove row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Below-table: adjustments + summary side by side */}
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                {/* Adjustments + note */}
                <div className="space-y-4">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-slate-700">
                        Additional discount
                      </span>
                      <button
                        type="button"
                        onClick={addAdjustmentRow}
                        className="inline-flex items-center gap-1 rounded border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <Plus className="h-3 w-3" /> Add row
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(form.additionalRows || []).map((row, index) => (
                        <div
                          key={`adj-${index}`}
                          className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.8fr)_120px_140px_32px]"
                        >
                          <Field
                            label="Discount ledger"
                            action={
                              <AddLink
                                onClick={() =>
                                  navigateToCreateMaster(
                                    "/masters/create/ledger",
                                  )
                                }
                              />
                            }
                          >
                            <SearchableSelect
                              options={expenseLedgerOptions}
                              value={row.ledgerId}
                              onChange={(v) =>
                                updateAdjustmentRow(index, "ledgerId", v)
                              }
                              placeholder="Search discount ledger..."
                            />
                          </Field>
                          <Field label="Type">
                            <select
                              data-vnav="true"
                              className={inputBase}
                              value={row.mode || "fixed"}
                              onChange={(e) =>
                                updateAdjustmentRow(
                                  index,
                                  "mode",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="fixed">Fixed</option>
                              <option value="percentage">Percentage</option>
                            </select>
                          </Field>
                          <Field label="Amount">
                            <input
                              type="number"
                              data-vnav="true"
                              className={numInput}
                              value={row.value}
                              disabled={!row.ledgerId}
                              placeholder={
                                row.ledgerId ? "0.00" : "Select ledger first"
                              }
                              onChange={(e) =>
                                updateAdjustmentRow(
                                  index,
                                  "value",
                                  e.target.value,
                                )
                              }
                            />
                          </Field>
                          <div className="flex items-end pb-0.5">
                            <button
                              type="button"
                              onClick={() => removeAdjustmentRow(index)}
                              className="rounded p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-slate-700">
                        Redeem points
                      </span>
                      {/* <span className="text-[12px] text-slate-500">
                        Available:{" "}
                        {Number(activeCustomer?.rewardPoints || 0).toLocaleString(
                          "en-IN",
                        )}{" "}
                        pts
                      </span> */}
                    </div>
                    <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.8fr)_140px]">
                      <Field
                        label="Redeem discount ledger"
                        action={
                          <AddLink
                            onClick={() =>
                              navigateToCreateMaster("/masters/create/ledger")
                            }
                          />
                        }
                      >
                        <SearchableSelect
                          options={expenseLedgerOptions}
                          value={form.redeemLedgerId}
                          onChange={(v) =>
                            setForm((c) => ({ ...c, redeemLedgerId: v }))
                          }
                          placeholder="Search redeem ledger..."
                        />
                      </Field>
                      <Field label="Redeem points">
                        <input
                          type="number"
                          data-vnav="true"
                          className={numInput}
                          value={form.redeemAmount}
                          disabled={!form.redeemLedgerId}
                          min="0"
                          max={Number(activeCustomer?.rewardPoints || 0)}
                          placeholder={
                            form.redeemLedgerId ? "0.00" : "Select ledger first"
                          }
                          onChange={(e) =>
                            setForm((c) => {
                              const availableRewardPoints = Number(
                                activeCustomer?.rewardPoints || 0,
                              );
                              const rawValue = e.target.value;
                              if (rawValue === "") {
                                return { ...c, redeemAmount: "" };
                              }
                              const numericValue = Math.max(
                                0,
                                Math.min(
                                  Number(rawValue || 0),
                                  availableRewardPoints,
                                ),
                              );
                              return {
                                ...c,
                                redeemAmount: String(numericValue),
                              };
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                  {/* <Field label="Note (optional)">
                    <textarea
                      rows={3}
                      data-vnav="true"
                      className={inputBase + " resize-y"}
                      value={form.note}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, note: e.target.value }))
                      }
                      placeholder="Remarks, delivery instructions…"
                    />
                  </Field> */}
                </div>

                {/* Amount summary */}
                <div>
                  <div className="rounded-lg border border-white bg-blue-900 font-bold p-4">
                    <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-white">
                      Order summary
                    </p>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-white">Items (qty)</span>
                        <span className="text-white">{totalItems}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">Subtotal</span>
                        <span className="text-white">{formatMoney(subtotal, currency.symbol)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">Item discount</span>
                        <span className="text-white">
                          - {formatMoney(Math.abs(rowDiscountTotal), currency.symbol)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">Additional discount</span>
                        <span className="text-white">
                          - {formatMoney(Math.abs(additionalExpenseAmount), currency.symbol)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">Redeem points</span>
                        <span className="text-white">
                          - {formatMoney(Math.abs(rewardRedeemed), currency.symbol)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-white pt-2.5 text-[14px] font-semibold text-slate-900">
                        <span className="text-white text-xl">Total payable</span>
                        <span className="text-white">{formatMoney(totalAmount, currency.symbol)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between border-t border-dashed border-white pt-3 text-[12px]">
                      <span className="text-slate-400">Reward to earn</span>
                      <span className="font-medium text-white">
                        {rewardToEarn.toLocaleString("en-IN")} pts
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => previewPosInvoiceDocument(printData)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" /> Print Now
              </button>
              <button
                type="button"
                onClick={() => setShowSaveConfirm(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-[13px] font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" /> Complete sale
                <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold">
                  F10
                </span>
              </button>
              <button
                type="button"
                onClick={() => resetForm()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white py-3 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
          {/* end left col */}

          {/* ── Right sidebar ── */}
          <aside className="space-y-4 2xl:sticky 2xl:top-4">
            {/* Payment */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <CreditCard className="h-4 w-4 text-slate-400" /> Payment
                details
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label>Bank payment</Label>
                    <button
                      type="button"
                      onClick={addBankPaymentRow}
                      className="inline-flex items-center gap-1 rounded border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <Plus className="h-3 w-3" /> Add bank
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(form.bankPayments || [{ ...emptyBankPaymentRow }]).map(
                      (row, index) => (
                        <div
                          key={`bank-${index}`}
                          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px_28px]"
                        >
                          <SearchableSelect
                            options={bankLedgerOptions}
                            value={row.ledgerId}
                            onChange={(value) =>
                              updateBankPaymentRow(index, "ledgerId", value)
                            }
                            placeholder="Select bank ledger"
                            inputClassName="rounded border-slate-200 bg-slate-50 text-[13px] focus:border-blue-500 focus:bg-white"
                          />
                          <input
                            type="number"
                            data-vnav="true"
                            className={numInput}
                            value={row.amount}
                            disabled={!row.ledgerId}
                            placeholder={row.ledgerId ? "0.00" : "Bank first"}
                            onChange={(e) =>
                              updateBankPaymentRow(index, "amount", e.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeBankPaymentRow(index)}
                            className="rounded p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                            aria-label="Remove bank payment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <Field
                  label={
                    <span>
                      Cash{" "}
                      <span className="text-[10px] text-slate-400">(auto)</span>
                    </span>
                  }
                >
                  <input
                    type="number"
                    data-vnav="true"
                    readOnly
                    className={readonlyInput + " text-right"}
                    value={form.cashPayment}
                  />
                </Field>
                <Field label="Cash tendered">
                  <input
                    type="number"
                    data-vnav="true"
                    className={numInput}
                    value={form.cashTendered}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, cashTendered: e.target.value }))
                    }
                  />
                </Field>
                <div className="rounded-lg bg-yellow-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-yellow-600">
                    Change to return
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-yellow-700">
                    {formatMoney(changeAmount, currency.symbol)}
                  </p>
                </div>
              </div>
            </div>

            {/* Purchase history */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                  <History className="h-4 w-4 text-slate-400" /> Purchase
                  history
                </h2>
                {activeCustomer?.name && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    {activeCustomer.name}
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto pr-0.5">
                {historyLoading ? (
                  <p className="text-[13px] text-slate-400">Loading…</p>
                ) : customerPurchases.length === 0 ? (
                  <p className="text-[13px] text-slate-400">
                    Enter a phone number to view past purchases.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customerPurchases.map((purchase, index) => (
                      <div
                        key={`${purchase.voucherId || "p"}-${index}`}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                      >
                        <p className="text-[13px] font-medium text-slate-900">
                          {purchase.itemName || "—"} ×{" "}
                          {Number(purchase.qty || 0).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {(purchase.companyName || "Unknown company").trim()} ({formatLongDisplayDate(purchase.purchaseDate)})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt summary (mobile / sidebar) */}
            {/* <div
              className="rounded-xl border border-slate-200 bg-white p-4"
              data-print-hide="true"
            >
              <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <Receipt className="h-4 w-4 text-slate-400" /> Amount summary
              </h2>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total items</span>
                  <span>{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{formatMoney(subtotal, currency.symbol)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Discount</span>
                  <span className="text-rose-600">
                    − {formatMoney(Math.abs(totalDiscountAmount), currency.symbol)}
                  </span>
                </div>
                <div className="hidden">
                  <span className="text-slate-500">Adj. expense</span>
                  <span>
                    {formatMoney(additionalExpenseAmount, currency.symbol)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-emerald-700">
                  <span>Total amount</span>
                  <span>{formatMoney(totalAmount, currency.symbol)}</span>
                </div>
                <div className="flex justify-between pt-1 text-[12px]">
                  <span className="text-slate-400">Reward to earn</span>
                  <span className="text-emerald-600">
                    {rewardToEarn.toLocaleString("en-IN")} pts
                  </span>
                </div>
              </div>
            </div> */}
          </aside>
        </div>
      </div>

      {/* ── Save confirm modal ── */}
      <SaveVoucherModal
        open={showSaveConfirm}
        onClose={() => {
          setShowSaveConfirm(false);
          focusSearchInput();
        }}
        onSave={async () => {
          setShowSaveConfirm(false);
          await submit();
        }}
        onSaveAndPrint={async () => {
          setShowSaveConfirm(false);
          await submit({
            printAfterSave: true,
            printVoucher: () => printPosInvoiceDocument(printData),
          });
        }}
        title="Complete POS sale?"
        description="Post this POS voucher. You can save now or save and print the bill immediately."
      />
    </div>
  );
}
