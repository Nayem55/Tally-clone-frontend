import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CreditCard,
  Download,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  Upload,
  UserRoundSearch,
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
  normalizeImportedExcelDate,
  padExcelRows,
  parseFieldValueMap,
  parseWorksheetRows,
} from "../utils/voucherExcel";

const POS_TEMPLATE_SHEET = "POS Voucher";
const POS_VOUCHER_RETURN_STORAGE_KEY = "pos-voucher-return-draft";

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
  return String(employee.under || "").trim().toLowerCase() === "sales";
}

function formatMoney(value, symbol = "Tk") {
  return `${symbol} ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toWords(value) {
  const amount = Math.round(Number(value || 0));
  if (!amount) return "Zero only";
  return `${amount.toLocaleString("en-IN")} only`;
}

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
    companies.find((entry) => String(entry._id) === String(effectiveCompanyId))
      ?.name || "";
  const isEditMode = Boolean(editVoucherId);
  const [voucherTypeId, setVoucherTypeId] = useState("");
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [employees, setEmployees] = useState([]);
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
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    customerName: "",
    phone: "",
    salesPersonId: "",
    address: "",
    note: "",
    discountType: "fixed",
    discountValue: "",
    redeemPoints: "",
    cardPayment: "",
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

  const inputClass =
    "w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]";
  const numberInputClass =
    "w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-right text-[14px] outline-none focus:border-[#3f83f8]";

  useEffect(() => {
    async function loadMasters() {
      if (!effectiveCompanyId) return;
      const [
        voucherTypeResponse,
        itemResponse,
        levelResponse,
        defaultResponse,
        employeeResponse,
      ] = await Promise.all([
        api.get(`/companies/${effectiveCompanyId}/voucher-types`),
        api.get(`/companies/${effectiveCompanyId}/items`),
        api.get(`/companies/${effectiveCompanyId}/price-levels`),
        api.get(`/companies/${effectiveCompanyId}/ledgers/defaults`),
        api.get(`/companies/${effectiveCompanyId}/employees`),
      ]);
      setItems(itemResponse.data);
      setPriceLevels(levelResponse.data);
      setEmployees(employeeResponse.data || []);
      setDefaults(defaultResponse.data || {});
      const voucherType = voucherTypeResponse.data.find(
        (row) => row.name.toLowerCase() === "pos voucher",
      );
      setVoucherTypeId(voucherType?._id || "");
    }
    loadMasters();
  }, [effectiveCompanyId]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) =>
      prev.number ? prev : { ...prev, number: suggestedNumber },
    );
  }, [suggestedNumber, isEditMode]);

  useEffect(() => {
    if (isEditMode || !effectiveCompanyId || !location.state?.restorePosVoucherDraft) return;
    try {
      const raw = window.sessionStorage.getItem(POS_VOUCHER_RETURN_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (String(draft?.companyId || "") !== String(effectiveCompanyId)) return;
      if (!draft?.form) return;
      setForm(draft.form);
      setStatusMessage(draft.statusMessage || null);
      window.sessionStorage.removeItem(POS_VOUCHER_RETURN_STORAGE_KEY);
    } catch (error) {
      console.error("Unable to restore POS voucher draft:", error);
    }
  }, [effectiveCompanyId, isEditMode, location.state]);

  useEffect(() => {
    const phone = form.phone.replace(/\D/g, "");
    if (!effectiveCompanyId || phone.length < 6) {
      setCustomerSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      const response = await api.get(
        `/companies/${effectiveCompanyId}/customers`,
        {
          params: { phone, limit: 8 },
        },
      );
      setCustomerSuggestions(response.data);
      setShowCustomerSuggestions(true);
    }, 250);

    return () => clearTimeout(handle);
  }, [effectiveCompanyId, form.phone]);

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
        const response = await api.get(
          `/companies/${effectiveCompanyId}/customers/purchase-history`,
          {
            params: { phone },
          },
        );
        if (!alive) return;
        setCustomerInsight({
          customer: response.data?.customer || null,
          purchases: response.data?.purchases || [],
        });
      } catch (error) {
        if (!alive) return;
        setCustomerInsight({ customer: null, purchases: [] });
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [effectiveCompanyId, form.phone]);

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

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!effectiveCompanyId || !editVoucherId || items.length === 0) return;
      const response = await api.get(
        `/companies/${effectiveCompanyId}/vouchers/${editVoucherId}`,
      );
      const voucher = response.data;
      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date
          ? String(voucher.date).slice(0, 10)
          : formatDateForInput(new Date()),
        customerName: voucher.customerSnapshot?.name || "",
        phone: voucher.customerSnapshot?.phone || "",
        salesPersonId: String(voucher.salesMeta?.employeeId || ""),
        address: voucher.customerSnapshot?.address || "",
        note: voucher.narration || "",
        discountType: voucher.posMeta?.discountType || "fixed",
        discountValue: String(voucher.posMeta?.discountValue || ""),
        redeemPoints: String(voucher.posMeta?.rewardRedeemed || ""),
        cardPayment: String(voucher.posMeta?.cardAmount || ""),
        cashPayment: String(voucher.posMeta?.cashAmount || ""),
        cashTendered: String(voucher.posMeta?.cashTendered || ""),
        rows:
          (voucher.inventoryLines || []).map((line) => ({
            itemId: String(line.itemId || ""),
            qty: String(line.qty || 1),
            rate: Number(line.rate || 0),
            mrpRate: Number(line.mrpRate || line.rate || 0),
            discountPercent: Number(line.discountValue || 0),
          })) || [],
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [effectiveCompanyId, editVoucherId, items.length]);

  const selectedCompany = companies.find(
    (company) => String(company._id) === String(effectiveCompanyId),
  );
  const currency = getCompanyCurrency(selectedCompany);
  const mrpPriceLevelId =
    priceLevels.find(
      (level) => String(level.code || "").toUpperCase() === "MRP",
    )?._id || "";
  const salesEmployees = useMemo(
    () => employees.filter(employeeBelongsToSalesRole),
    [employees],
  );
  const salesEmployeeOptions = useMemo(
    () =>
      salesEmployees.map((employee) => ({
        value: String(employee._id),
        label: employee.name || employee.employeeNumber || "Unnamed Employee",
      })),
    [salesEmployees],
  );
  const selectedSalesPerson = useMemo(
    () =>
      salesEmployees.find(
        (employee) => String(employee._id) === String(form.salesPersonId),
      ) || null,
    [salesEmployees, form.salesPersonId],
  );
  const itemNameMap = useMemo(
    () => new Map(items.map((item) => [normalizeExcelNameKey(item.name), item])),
    [items],
  );
  const selectedCustomer = customerSuggestions.find(
      (customer) => customer.phone === form.phone.replace(/\D/g, ""),
    );
  const activeCustomer =
    customerInsight.customer ||
    selectedCustomer ||
    null;

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items.slice(0, 8);
    return items
      .filter((item) =>
        [item.name, item.alias, item.barcode, ...(item.secondaryAliases || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [items, searchTerm]);

  const lineAmount = (row) => {
    const gross = Number(row.qty || 0) * Number(row.rate || 0);
    const discount = gross * (Number(row.discountPercent || 0) / 100);
    return Number((gross - discount).toFixed(2));
  };

  const focusSearchInput = () => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    });
  };

  const findItemByScanValue = (value) => {
    const code = String(value || "").trim().toLowerCase();
    if (!code) return null;

    return (
      items.find(
        (item) =>
          String(item.barcode || "").trim().toLowerCase() === code ||
          String(item.alias || "").trim().toLowerCase() === code ||
          (item.secondaryAliases || []).some(
            (alias) => String(alias || "").trim().toLowerCase() === code,
          ),
      ) ||
      items.find(
        (item) => String(item.name || "").trim().toLowerCase() === code,
      ) ||
      null
    );
  };

  const addItemById = (itemId) => {
    const item = items.find((entry) => entry._id === itemId);
    if (!item) return;
    const mrpRate = resolveItemRateByDate(item, mrpPriceLevelId, form.date);

    setForm((current) => {
      const existingIndex = current.rows.findIndex(
        (row) => String(row.itemId) === String(item._id),
      );

      if (existingIndex >= 0) {
        const nextRows = [...current.rows];
        const existingRow = nextRows[existingIndex];
        nextRows[existingIndex] = {
          ...existingRow,
          qty: String(Number(existingRow.qty || 0) + 1),
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

    const singleFilteredItem =
      filteredItems.length === 1 ? filteredItems[0] : null;

    if (singleFilteredItem) {
      addItemById(singleFilteredItem._id);
      return true;
    }

    setSearchTerm(scanValue);
    focusSearchInput();
    return false;
  };

  const addRow = () => {
    focusSearchInput();
  };

  const updateRow = (index, field, value) => {
    setForm((current) => {
      const nextRows = [...current.rows];
      const row = { ...nextRows[index], [field]: value };
      nextRows[index] = row;
      return { ...current, rows: nextRows };
    });
  };

  const removeRow = (index) => {
    setForm((current) => ({
      ...current,
      rows: current.rows.filter((_, idx) => idx !== index),
    }));
    focusSearchInput();
  };

  const validRows = form.rows.filter(
    (row) => row.itemId && Number(row.qty) > 0,
  );
  const subtotal = validRows.reduce((sum, row) => sum + lineAmount(row), 0);
  const rowDiscountTotal = validRows.reduce((sum, row) => {
    const gross = Number(row.qty || 0) * Number(row.rate || 0);
    return sum + gross * (Number(row.discountPercent || 0) / 100);
  }, 0);
  const invoiceDiscount =
    form.discountType === "percentage"
      ? subtotal * (Number(form.discountValue || 0) / 100)
      : Number(form.discountValue || 0);
  const redeemPoints = Math.min(
    Number(form.redeemPoints || 0),
    Number(activeCustomer?.rewardPoints || 0),
  );
  const totalAmount = Math.max(
    0,
    Number((subtotal - invoiceDiscount - redeemPoints).toFixed(2)),
  );
  const totalItems = validRows.reduce(
    (sum, row) => sum + Number(row.qty || 0),
    0,
  );
  const rewardToEarn = validRows.reduce(
    (sum, row) =>
      sum + Number(row.mrpRate || row.rate || 0) * Number(row.qty || 0),
    0,
  );
  const cardPayment = Number(form.cardPayment || 0);
  const cashPayment = Number(form.cashPayment || 0);
  const changeAmount = Math.max(
    0,
    Number(form.cashTendered || 0) - cashPayment,
  );
  const customerLine = [
    form.customerName,
    formatMaskedPhone(form.phone),
  ]
    .filter(Boolean)
    .join(" ");
  const customerPurchases = customerInsight.purchases || [];
  const printData = useMemo(() => {
    const voucherDate = form.date ? new Date(form.date) : new Date();
    const formatCompactMoney = (value) =>
      Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const uniformRowDiscount =
      validRows.length > 0 &&
      validRows.every(
        (row) =>
          Number(row.discountPercent || 0) ===
          Number(validRows[0]?.discountPercent || 0),
      )
        ? Number(validRows[0]?.discountPercent || 0)
        : 0;
    const promotionAmount = rowDiscountTotal + invoiceDiscount;

    return {
      documentTitle: `POS Invoice - ${form.number || "Preview"}`,
      voucherTitle: "Invoice",
      companyName:
        selectedCompany?.mailingName || selectedCompany?.name || "Company",
      companyLines: [
        selectedCompany?.address || "",
        [selectedCompany?.city, selectedCompany?.state, selectedCompany?.country]
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
        const item = items.find((entry) => entry._id === row.itemId);
        return {
          description: item?.name || "-",
          qty: String(Number(row.qty || 0)),
          rate: formatCompactMoney(row.rate),
          amount: formatCompactMoney(lineAmount(row)),
        };
      }),
      discountLine:
        promotionAmount > 0
          ? {
              label:
                uniformRowDiscount > 0
                  ? `Product Promotion ${uniformRowDiscount}% (-)`
                  : "Product Promotion (-)",
              value:
                uniformRowDiscount > 0
                  ? `${formatCompactMoney(promotionAmount)} (-)${uniformRowDiscount} %`
                  : formatCompactMoney(promotionAmount),
            }
          : null,
      redeemLine:
        redeemPoints > 0
          ? {
              label: "Reward Redeem (-)",
              value: formatCompactMoney(redeemPoints),
            }
          : null,
      totalText: formatCompactMoney(totalAmount),
      totalQtyText: String(totalItems),
      payments: [
        ...(cardPayment > 0
          ? [{ label: "Card :", value: formatCompactMoney(cardPayment) }]
          : []),
        { label: "Cash :", value: formatCompactMoney(cashPayment) },
        {
          label: "Cash Tendered :",
          value: formatCompactMoney(form.cashTendered || 0),
        },
        { label: "Balance :", value: formatCompactMoney(changeAmount) },
        { label: "Total Paid", value: formatCompactMoney(totalAmount) },
      ],
      // customerLine,
      footerLines: [
        "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
        `Thank you for shopping at ${selectedCompany?.name || "our store"}. Your business is greatly appreciated.`,
      ],
    };
  }, [
    selectedCompany,
    form.number,
    form.date,
    form.customerName,
    form.phone,
    form.cashTendered,
    validRows,
    items,
    rowDiscountTotal,
    invoiceDiscount,
    redeemPoints,
    totalAmount,
    totalItems,
    cardPayment,
    cashPayment,
    changeAmount,
    customerLine,
  ]);

  useEffect(() => {
    const safeCardPayment = Math.min(
      Math.max(0, Number(form.cardPayment || 0)),
      totalAmount,
    );
    const autoCashPayment = Math.max(
      0,
      Number((totalAmount - safeCardPayment).toFixed(2)),
    );
    const nextCardPayment = safeCardPayment > 0 ? String(safeCardPayment) : "";
    const nextCashPayment = String(autoCashPayment);

    if (
      Number(form.cardPayment || 0) !== safeCardPayment ||
      String(form.cashPayment) !== nextCashPayment
    ) {
      setForm((current) => ({
        ...current,
        cardPayment: nextCardPayment,
        cashPayment: nextCashPayment,
      }));
    }
  }, [totalAmount, form.cardPayment, form.cashPayment]);

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

      if (elapsed > 80) {
        scannerBufferRef.current = "";
      }

      scannerBufferRef.current += event.key;

      if (scannerTimerRef.current) {
        window.clearTimeout(scannerTimerRef.current);
      }

      scannerTimerRef.current = window.setTimeout(() => {
        scannerBufferRef.current = "";
        scannerTimerRef.current = null;
      }, 120);

      const looksLikeScannerInput =
        scannerBufferRef.current.length >= 4 && elapsed > 0 && elapsed <= 80;

      if (looksLikeScannerInput && !isSearchFocused) {
        searchInputRef.current?.focus();
      }

      if (looksLikeScannerInput && !isSearchFocused && !isTypingInEditable) {
        setSearchTerm(scannerBufferRef.current);
      }
    };

    window.addEventListener("keydown", handleGlobalScannerInput, true);

    return () => {
      window.removeEventListener("keydown", handleGlobalScannerInput, true);
      if (scannerTimerRef.current) {
        window.clearTimeout(scannerTimerRef.current);
      }
    };
  }, [filteredItems, items, searchTerm, showSaveConfirm]);

  const applyCustomer = (customer) => {
    setForm((current) => ({
      ...current,
      customerName: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
    }));
    setShowCustomerSuggestions(false);
    focusSearchInput();
  };

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
    const companySlug =
      normalizeExcelNameKey(companyName).replace(/[^a-z0-9]+/g, "-") || "company";
    exportWorkbookToFile(workbook, `${companySlug}-pos-voucher-import-template.xlsx`);
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description: "Fill the same structure and import it back to load item rows into the form.",
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
        (row) =>
          normalizeExcelText(row[0]) === "Item Name" &&
          normalizeExcelText(row[1]) === "Qty",
      );
      if (headerIndex === -1) throw new Error("POS item table is missing.");

      const importedRows = rows
        .slice(headerIndex + 1)
        .map((row) => ({
          itemName: normalizeExcelText(row[0]),
          qty: normalizeExcelText(row[1]),
          rate: normalizeExcelText(row[2]),
          discountPercent: normalizeExcelText(row[3]),
        }))
        .filter((row) => row.itemName || row.qty || row.rate || row.discountPercent);
      if (!importedRows.length) throw new Error("At least one POS item row is required.");

      const resolvedRows = importedRows.map((row, index) => {
        const item = itemNameMap.get(normalizeExcelNameKey(row.itemName));
        if (!item) throw new Error(`Row ${index + 1}: Item "${row.itemName}" was not found.`);
        const qty = Number(row.qty || 0);
        const rate =
          Number(row.rate || 0) ||
          Number(resolveItemRateByDate(item, mrpPriceLevelId, form.date) || 0);
        const discountPercent = Number(row.discountPercent || 0);
        if (!(qty > 0)) throw new Error(`Row ${index + 1}: Qty must be greater than 0.`);
        if (!(rate > 0)) throw new Error(`Row ${index + 1}: Rate must be greater than 0.`);
        return {
          itemId: item._id,
          qty: String(qty),
          rate,
          mrpRate: Number(resolveItemRateByDate(item, mrpPriceLevelId, form.date) || rate),
          discountPercent: String(discountPercent || ""),
        };
      });
      setForm((current) => ({
        ...current,
        rows: resolvedRows,
      }));
      setStatusMessage({
        tone: "success",
        title: "POS items loaded from Excel",
        description: `${resolvedRows.length} item row(s) were loaded into the form. Review customer and payment details, then save manually.`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description: error?.message || "Unable to import POS voucher from Excel.",
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
      address: "",
      note: "",
      discountType: "fixed",
      discountValue: "",
      redeemPoints: "",
      cardPayment: "",
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
        JSON.stringify({
          companyId: effectiveCompanyId,
          form,
          statusMessage,
        }),
      );
    } catch (error) {
      console.error("Unable to store POS voucher draft:", error);
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
    if (validRows.length === 0) return alert("Please add at least one item");
    if (
      Number((cardPayment + cashPayment).toFixed(2)) !==
      Number(totalAmount.toFixed(2))
    ) {
      return alert("Cash payment + card payment must match total payable");
    }

    const primaryBankLedgerId =
      defaults.bankLedger?._id || defaults.bankLedgers?.[0]?._id || "";
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
      lines: [
        ...(cashPayment > 0 && defaults.cashLedger?._id
          ? [
              {
                ledgerId: defaults.cashLedger._id,
                debit: cashPayment,
                credit: 0,
              },
            ]
          : []),
        ...(cardPayment > 0 && primaryBankLedgerId
          ? [{ ledgerId: primaryBankLedgerId, debit: cardPayment, credit: 0 }]
          : []),
        {
          ledgerId: defaults.salesLedger?._id || "",
          debit: 0,
          credit: totalAmount,
        },
      ],
      inventoryLines: validRows.map((row) => {
        const item = items.find((entry) => entry._id === row.itemId);
        const gross = Number(row.qty || 0) * Number(row.rate || 0);
        const discountValue = Number(row.discountPercent || 0);
        const discountAmount = gross * (discountValue / 100);
        return {
          itemId: row.itemId,
          itemName: item?.name || "",
          qty: Number(row.qty || 0),
          billedQty: Number(row.qty || 0),
          rate: Number(row.rate || 0),
          mrpRate: Number(row.mrpRate || row.rate || 0),
          discount: discountAmount,
          discountType: "percent",
          discountValue,
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
        discountType: form.discountType,
        discountValue: Number(form.discountValue || 0),
        invoiceDiscount,
        subtotal,
        totalAmount,
        rewardEarned: rewardToEarn,
        rewardRedeemed: redeemPoints,
        cashAmount: cashPayment,
        cardAmount: cardPayment,
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
        salesLedgerId: defaults.salesLedger?._id || "",
        discountType: form.discountType,
        discountValue: Number(form.discountValue || 0),
        redeemedPoints: redeemPoints,
        payments: {
          card: cardPayment,
          cash: cashPayment,
          cashTendered: Number(form.cashTendered || 0),
        },
        items: validRows.map((row) => {
          const item = items.find((entry) => entry._id === row.itemId);
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
    const tagName = target.tagName?.toLowerCase();

    if (tagName === "button") return;

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
    ).filter((field) => {
      const isDisabled =
        field.disabled || field.getAttribute("aria-disabled") === "true";
      const isHidden = field.type === "hidden" || field.offsetParent === null;
      return !isDisabled && !isHidden;
    });

    const currentIndex = fields.indexOf(target);
    const nextField = fields[currentIndex + 1] || fields[0];

    nextField?.focus();
    nextField?.select?.();
  };

  useVoucherShortcuts({
    shortcuts: voucherShortcuts,
    containerRef,
    onAddRow: addRow,
    onSaveRequest: () => setShowSaveConfirm(true),
  });

  return (
    <div
      ref={containerRef}
      onKeyDownCapture={handleEnterNavigation}
      className="min-h-screen bg-slate-100 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 sm:h-14 sm:w-14">
                <ShoppingCart className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-[24px] font-bold text-slate-900 sm:text-3xl">
                  POS Sales Voucher
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Fast checkout with customer lookup, rewards, redemption, and
                  barcode scanner billing.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {!isEditMode ? (
                <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                    onClick={handleExportTemplate}
                  >
                    <Download className="h-4 w-4" />
                    Export Demo Excel
                  </button>
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importBusy}
                  >
                    <Upload className="h-4 w-4" />
                    {importBusy ? "Importing..." : "Import Excel"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </div>
              ) : null}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Voucher No.
                </label>
                <input
                  data-vnav="true"
                  className={inputClass}
                  value={form.number}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      number: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Voucher Date
                </label>
                <TallyDateInput
                  data-voucher-date="true"
                  data-vnav="true"
                  className={inputClass}
                  value={form.date}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, date: value }))
                  }
                />
              </div>
            </div>
          </div>
        </section>

        {statusMessage ? (
          <section
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              statusMessage.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <p className="font-semibold">{statusMessage.title}</p>
            <p className="mt-1">{statusMessage.description}</p>
          </section>
        ) : null}

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <h2 className="text-xl font-bold text-slate-900">
                Customer Details
              </h2>

              <div className="mt-5 grid gap-4 lg:grid-cols-5">
                <div className="relative">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <input
                      data-vnav="true"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 pr-11 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={form.phone}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                    <UserRoundSearch className="absolute right-3 top-2.5 h-4 w-4 text-blue-600" />
                  </div>
                  {showCustomerSuggestions && customerSuggestions.length > 0 ? (
                    <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                      {customerSuggestions.map((customer) => (
                        <button
                          key={customer._id}
                          type="button"
                          className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => applyCustomer(customer)}
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {customer.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {customer.phone}
                            </p>
                          </div>
                          <p className="text-xs text-emerald-600">
                            {Number(customer.rewardPoints || 0).toLocaleString(
                              "en-IN",
                            )}{" "}
                            pts
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Customer Name
                  </label>
                  <input
                    data-vnav="true"
                    className={inputClass}
                    value={form.customerName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      Sales Person
                    </label>
                    <button
                      type="button"
                      className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={() => navigateToCreateMaster("/masters/create/employee")}
                    >
                      Add+
                    </button>
                  </div>
                  <SearchableSelect
                    options={[
                      { label: "Select sales person" },
                      ...salesEmployeeOptions,
                    ]}
                    value={form.salesPersonId}
                    onChange={(newValue) =>
                      setForm((current) => ({
                        ...current,
                        salesPersonId: newValue,
                      }))
                    }
                    placeholder="Search sales person"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedSalesPerson?.employeeNumber
                      ? `Employee No.: ${selectedSalesPerson.employeeNumber}`
                      : "Only employees under Sales are shown here."}
                  </p>
                </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                    <p className="text-sm font-medium text-emerald-700">
                      Available Reward Points
                    </p>
                    <p className="mt-2 text-2xl font-bold text-emerald-700">
                      {Number(activeCustomer?.rewardPoints || 0).toLocaleString(
                        "en-IN",
                      )}
                    </p>
                  </div>
                <div className="lg:col-span-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Address (Optional)
                  </label>
                  <input
                    data-vnav="true"
                    className={inputClass}
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    data-vnav="true"
                    data-barcode-search="true"
                    className="w-full border border-[#c8d2de] bg-[#EEF5FF] py-1.5 pl-10 pr-4 text-[14px] outline-none focus:border-[#3f83f8]"
                    placeholder="Scan barcode or search item by name / code"
                    value={searchTerm}
                    onFocus={() => {
                      scannerBufferRef.current = "";
                    }}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      handleBarcodeSubmit(searchTerm);
                    }}
                  />
                  {searchTerm && filteredItems.length > 0 ? (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                      {filteredItems.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => addItemById(item._id)}
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.barcode || item.alias || "-"}
                            </p>
                          </div>
                          <span className="text-xs text-emerald-600">Add</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={focusSearchInput}
                >
                  Focus Scanner
                </button>
              </div>

              <div className="mt-5 overflow-visible rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm table-head">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Item Name</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Disc %</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form?.rows?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-sm text-slate-500"
                        >
                          Scan barcode or search item above to add products.
                        </td>
                      </tr>
                    ) : (
                      form.rows.map((row, index) => {
                        const item = items.find(
                          (entry) => entry._id === row.itemId,
                        );
                        return (
                          <tr key={index} className="border-t border-slate-100">
                            <td className="px-4 py-4 align-top text-slate-500">
                              {index + 1}
                            </td>
                            <td className="px-4 py-4 align-top font-medium text-slate-900">
                              {item?.name || "-"}
                            </td>
                            <td className="px-4 py-4 align-top text-slate-600">
                              {item?.barcode || item?.alias || "-"}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <input
                                type="number"
                                data-vnav="true"
                                className={numberInputClass}
                                value={row.qty}
                                onChange={(event) =>
                                  updateRow(index, "qty", event.target.value)
                                }
                              />
                            </td>
                            <td className="px-4 py-4 align-top">
                              <input
                                type="number"
                                data-vnav="true"
                                className={numberInputClass}
                                value={row.rate}
                                onChange={(event) =>
                                  updateRow(index, "rate", event.target.value)
                                }
                              />
                            </td>
                            <td className="px-4 py-4 align-top">
                              <input
                                type="number"
                                data-vnav="true"
                                className={numberInputClass}
                                value={row.discountPercent}
                                onChange={(event) =>
                                  updateRow(
                                    index,
                                    "discountPercent",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>
                            <td className="px-4 py-4 align-top text-right font-semibold text-slate-900">
                              {formatMoney(lineAmount(row), currency.symbol)}
                            </td>
                            <td className="px-4 py-4 align-top text-right">
                              <button
                                type="button"
                                className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                                onClick={() => removeRow(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Discount Type
                      </label>
                      <select
                        data-vnav="true"
                        className={inputClass}
                        value={form.discountType}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            discountType: event.target.value,
                          }))
                        }
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Discount Value
                      </label>
                      <input
                        type="number"
                        data-vnav="true"
                        className={numberInputClass}
                        value={form.discountValue}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            discountValue: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Redeem Points
                      </label>
                      <input
                        type="number"
                        data-vnav="true"
                        className={numberInputClass}
                        value={form.redeemPoints}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            redeemPoints: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Note (Optional)
                    </label>
                    <textarea
                      rows={4}
                      data-vnav="true"
                      className="min-h-28 w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={form.note}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-100 bg-blue-50 px-6 py-6 text-center">
                  <p className="text-sm font-medium text-blue-700">
                    Total Payable
                  </p>
                  <p className="mt-3 text-5xl font-bold text-blue-700">
                    {formatMoney(totalAmount, currency.symbol)}
                  </p>
                  <p className="mt-3 text-sm text-blue-700">
                    {toWords(totalAmount)}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => previewPosInvoiceDocument(printData)}
              >
                <Printer className="h-4 w-4" />
                Print Preview
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => setShowSaveConfirm(true)}
              >
                <Check className="h-4 w-4" />
                Complete Sale (F10)
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-4 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={resetForm}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>

          <aside className="space-y-6 2xl:sticky 2xl:top-24">
            <section
              data-print-hide="true"
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                Amount Summary
              </h3>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>Total Items</span>
                  <span>{totalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal, currency.symbol)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Discount</span>
                  <span>
                    {formatMoney(
                      rowDiscountTotal + invoiceDiscount,
                      currency.symbol,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Redeemed Points</span>
                  <span>{formatMoney(redeemPoints, currency.symbol)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 font-semibold text-emerald-600">
                  <span>Total Amount</span>
                  <span>{formatMoney(totalAmount, currency.symbol)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reward to Earn</span>
                  <span>{rewardToEarn.toLocaleString("en-IN")} pts</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  Purchase History
                </h3>
                {activeCustomer?.name ? (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {activeCustomer.name}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 h-[360px] overflow-y-auto pr-1">
                {historyLoading ? (
                  <p className="text-sm text-slate-500">Loading purchase history...</p>
                ) : customerPurchases.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Select or type a customer number to see past POS purchases here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {customerPurchases.map((purchase, index) => (
                      <div
                        key={`${purchase.voucherId || "purchase"}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {purchase.itemName || "-"} x {Number(purchase.qty || 0).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Purchase Date:{" "}
                          {purchase.purchaseDate
                            ? new Date(purchase.purchaseDate)
                                .toLocaleDateString("en-GB")
                                .replace(/\//g, "-")
                            : "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Payment Details
              </h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Card Payment (F5)
                  </label>
                  <div className="relative">
                    <CreditCard className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="number"
                      data-vnav="true"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] py-1.5 pl-10 pr-4 text-right text-[14px] outline-none focus:border-[#3f83f8]"
                      value={form.cardPayment}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          cardPayment: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Cash (Auto)
                  </label>
                  <input
                    type="number"
                    data-vnav="true"
                    readOnly
                    className={`${numberInputClass} cursor-not-allowed text-slate-700`}
                    value={form.cashPayment}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cashPayment: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Cash Tendered
                  </label>
                  <input
                    type="number"
                    data-vnav="true"
                    className={numberInputClass}
                    value={form.cashTendered}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cashTendered: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-medium text-emerald-700">Change</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">
                    {formatMoney(changeAmount, currency.symbol)}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

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
        description="We are ready to post this POS voucher. You can save it now or save and open a clean printable bill immediately."
      />
    </div>
  );
}
