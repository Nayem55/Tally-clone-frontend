import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";

const emptyRow = {
  itemId: "",
  actualQty: "1",
  billedQty: "1",
  rate: "",
  discountPercent: "",
  billedManuallyEdited: false,
  persistedFromVoucher: false,
};
const END_OF_LIST = "__END_OF_LIST__";
const emptyAdjustmentRow = {
  ledgerId: "",
  mode: "fixed",
  value: "",
};

const PURCHASE_TEMPLATE_SHEET = "Purchase Voucher";
const PURCHASE_INSTRUCTION_SHEET = "Instructions";
const PURCHASE_REFERENCE_SHEET = "Reference Data";
const PURCHASE_VOUCHER_RETURN_STORAGE_KEY = "purchase-voucher-return-draft";

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeNameKey(value = "") {
  return normalizeText(value).toLowerCase();
}

function normalizeImportedDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateForInput(value);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return formatDateForInput(
        new Date(parsed.y, (parsed.m || 1) - 1, parsed.d || 1),
      );
    }
  }
  const text = normalizeText(value);
  if (!text) return formatDateForInput(new Date());
  const normalized = text.replace(/[./]/g, "-");
  const ddmmyyyy = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const directDate = new Date(text);
  if (!Number.isNaN(directDate.getTime())) {
    return formatDateForInput(directDate);
  }
  return text;
}

function createEmptyRow() {
  return { ...emptyRow };
}

function resolvePurchaseItemRate(item) {
  if (!item) return 0;
  if (item.lastPurchaseRate !== undefined && item.lastPurchaseRate !== null) {
    return Number(item.lastPurchaseRate) || 0;
  }
  if (item.openingRate !== undefined && item.openingRate !== null) {
    return Number(item.openingRate) || 0;
  }
  return 0;
}

function calculatePurchaseLineAmount(row) {
  return Number(
    (
      Number(row.billedQty || row.actualQty || 0) *
      Number(row.rate || 0) *
      (1 - Number(row.discountPercent || 0) / 100)
    ).toFixed(2),
  );
}

function padRows(rows, minRows = 8) {
  const nextRows = [...rows];
  while (nextRows.length < minRows) {
    nextRows.push(["", "", "", "", ""]);
  }
  return nextRows;
}

function buildPurchasePayload({
  form,
  purchaseTypeId,
  defaultPurchaseLedgerId,
  itemMap,
  validRows,
  subtotal,
  totalAmount,
  adjustmentRows = [],
  additionalExpenseAmount = 0,
  additionalIncomeAmount = 0,
}) {
  const inventoryLines = validRows.map((row) => {
    const item = itemMap.get(row.itemId);
    return {
      itemId: item._id,
      itemName: item.name,
      qty: Number(row.billedQty || row.actualQty),
      billedQty: Number(row.billedQty || row.actualQty),
      rate: Number(row.rate),
      discount: Number(row.discountPercent || 0),
      amount: calculatePurchaseLineAmount(row),
      productSnapshot: { name: item.name, prices: item.prices },
    };
  });

  return {
    voucherTypeId: purchaseTypeId,
    voucherName: "Purchase",
    number: normalizeText(form.number),
    date: form.date,
    narration: normalizeText(form.narration) || "Purchase Voucher",
    referenceNo: normalizeText(form.supplierInvoiceNo),
    commercialMeta: {
      subtotal,
      lineDiscountTotal: 0,
      invoiceDiscount: 0,
      additionalCharges: 0,
      additionalAdjustments: adjustmentRows.map((row) => ({
        ledgerId: row.ledgerId,
        ledgerName: row.ledger?.name || "",
        nature: row.nature,
        mode: row.mode || "fixed",
        value: Number(row.value || 0),
        amount: row.calculatedAmount,
      })),
      additionalExpenseLedgerId:
        adjustmentRows.find((row) => row.nature === "EXPENSE")?.ledgerId || null,
      additionalExpenseMode:
        adjustmentRows.find((row) => row.nature === "EXPENSE")?.mode || "fixed",
      additionalExpenseValue:
        Number(adjustmentRows.find((row) => row.nature === "EXPENSE")?.value || 0),
      additionalExpenseAmount,
      additionalIncomeLedgerId:
        adjustmentRows.find((row) => row.nature === "INCOME")?.ledgerId || null,
      additionalIncomeMode:
        adjustmentRows.find((row) => row.nature === "INCOME")?.mode || "fixed",
      additionalIncomeValue:
        Number(adjustmentRows.find((row) => row.nature === "INCOME")?.value || 0),
      additionalIncomeAmount,
      totalAmount,
    },
    lines: [
      {
        ledgerId: form.purchaseLedger || defaultPurchaseLedgerId,
        debit: subtotal,
        credit: 0,
      },
      ...adjustmentRows
        .filter((row) => Number(row.calculatedAmount || 0) !== 0)
        .map((row) => {
          const signedAmount = Number(row.calculatedAmount || 0);
          return {
            ledgerId: row.ledgerId,
            debit: signedAmount > 0 ? signedAmount : 0,
            credit: signedAmount < 0 ? Math.abs(signedAmount) : 0,
          };
        }),
      {
        ledgerId: form.supplierLedger,
        debit: 0,
        credit: totalAmount,
      },
    ],
    inventoryLines,
  };
}

export default function PurchaseVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const fileInputRef = useRef(null);
  const bottomSaveButtonRef = useRef(null);
  const adjustmentPanelRef = useRef(null);
  const narrationInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [purchaseTypeId, setPurchaseTypeId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const companyName =
    companies.find((entry) => String(entry._id) === String(companyId))?.name || "";
  const [defaultPurchaseLedgerId, setDefaultPurchaseLedgerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    supplierInvoiceNo: "",
    supplierLedger: "",
    purchaseLedger: "",
    additionalRows: [emptyAdjustmentRow],
    narration: "",
    rows: [createEmptyRow()],
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: purchaseTypeId,
    companyName,
    voucherLabel: "Purchase",
    disabled: isEditMode,
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      setLoading(true);
      try {
        const [
          voucherResponse,
          supplierResponse,
          itemResponse,
          defaultsResponse,
          companyResponse,
          balanceResponse,
        ] = await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Creditors`),
          api.get(`/companies/${companyId}/items`),
          api.get(`/companies/${companyId}/ledgers/defaults`),
          api.get("/companies"),
          api.get(`/companies/${companyId}/ledgers/with-balances`, {
            params: { to: form.date },
          }),
        ]);

        const purchaseType = voucherResponse.data.find(
          (row) => row.name.toLowerCase() === "purchase",
        );
        const defaultPurchaseId = defaultsResponse.data.purchaseLedger?._id || "";
        setPurchaseTypeId(purchaseType?._id || "");
        setSuppliers(supplierResponse.data);
        setItems(itemResponse.data);
        setCompanies(companyResponse.data);
        setAllLedgers(balanceResponse.data);
        setDefaultPurchaseLedgerId(defaultPurchaseId);
        setForm((prev) => ({
          ...prev,
          purchaseLedger: prev.purchaseLedger || defaultPurchaseId,
        }));
      } catch (error) {
        alert("Failed to load purchase master data");
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, [companyId, form.date]);

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!companyId || !editVoucherId || items.length === 0) return;
      const response = await api.get(`/companies/${companyId}/vouchers/${editVoucherId}`);
      const voucher = response.data;
      const debitLine = (voucher.lines || []).find((line) => Number(line.debit || 0) > 0);
      const creditLine = (voucher.lines || []).find((line) => Number(line.credit || 0) > 0);
      const savedAdjustments = Array.isArray(voucher.commercialMeta?.additionalAdjustments)
        ? voucher.commercialMeta.additionalAdjustments
        : [];
      const additionalRows = savedAdjustments.map((row) => ({
        ledgerId: String(row.ledgerId || ""),
        mode: row.mode || "fixed",
        value: String(row.value ?? row.amount ?? ""),
      }));

      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date
          ? String(voucher.date).slice(0, 10)
          : formatDateForInput(new Date()),
        supplierInvoiceNo: voucher.referenceNo || "",
        supplierLedger: String(creditLine?.ledgerId || ""),
        purchaseLedger: String(debitLine?.ledgerId || defaultPurchaseLedgerId || ""),
        additionalRows:
          additionalRows.length > 0
            ? [...additionalRows, emptyAdjustmentRow]
            : [emptyAdjustmentRow],
        narration: voucher.narration || "",
        rows:
          (voucher.inventoryLines || []).map((line) => ({
            itemId: String(line.itemId || ""),
            actualQty: String(line.qty || line.billedQty || 1),
            billedQty: String(line.billedQty || line.qty || 1),
            rate: Number(line.rate || 0),
            discountPercent: String(line.discount || line.discountPercent || ""),
            billedManuallyEdited:
              String(line.billedQty || line.qty || 1) !==
              String(line.qty || line.billedQty || 1),
            persistedFromVoucher: true,
          })) || [createEmptyRow()],
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [companyId, editVoucherId, items.length, defaultPurchaseLedgerId]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) => (prev.number ? prev : { ...prev, number: suggestedNumber }));
  }, [suggestedNumber, isEditMode]);

  useEffect(() => {
    if (!isEditMode && companyId && location.state?.restorePurchaseVoucherDraft) {
      try {
        const raw = window.sessionStorage.getItem(PURCHASE_VOUCHER_RETURN_STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (String(draft?.companyId || "") !== String(companyId)) return;
        if (!draft?.form) return;
        setForm(draft.form);
        setStatusMessage(draft.statusMessage || null);
        window.sessionStorage.removeItem(PURCHASE_VOUCHER_RETURN_STORAGE_KEY);
      } catch (error) {
        console.error("Unable to restore purchase voucher draft:", error);
      }
    }
  }, [companyId, isEditMode, location.state]);

  const company = companies.find((entry) => String(entry._id) === String(companyId));
  const currency = getCompanyCurrency(company);
  const itemMap = useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
  const itemNameMap = useMemo(
    () => new Map(items.map((item) => [normalizeNameKey(item.name), item])),
    [items],
  );
  const ledgerMap = useMemo(
    () => new Map(allLedgers.map((ledger) => [ledger._id, ledger])),
    [allLedgers],
  );
  const supplierNameMap = useMemo(
    () => new Map(suppliers.map((ledger) => [normalizeNameKey(ledger.name), ledger])),
    [suppliers],
  );
  const supplierLedger = ledgerMap.get(form.supplierLedger);
  const purchaseLedger = ledgerMap.get(form.purchaseLedger || defaultPurchaseLedgerId);
  const supplierOptions = useMemo(
    () => suppliers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [suppliers],
  );
  const itemOptions = useMemo(
    () => [
      { value: END_OF_LIST, label: "End of List", meta: "" },
      ...items.map((item) => ({ value: item._id, label: item.name })),
    ],
    [items],
  );
  const adjustmentLedgerOptions = useMemo(
    () => [
      { value: END_OF_LIST, label: "End of List", meta: "" },
      ...allLedgers
        .filter((ledger) =>
          ["EXPENSE", "INCOME"].includes(String(ledger.group?.nature || "").toUpperCase()),
        )
        .map((ledger) => ({
          value: ledger._id,
          label: ledger.name,
          meta: "",
        })),
    ],
    [allLedgers],
  );

  const lineAmount = calculatePurchaseLineAmount;

  const recalculateRow = (row, voucherDate) => {
    if (!row.itemId) return row;
    const item = itemMap.get(row.itemId);
    return {
      ...row,
      rate: resolvePurchaseItemRate(item),
    };
  };

  const focusAdjustmentList = () => {
    window.setTimeout(() => {
      adjustmentPanelRef.current?.querySelector("input")?.focus();
    }, 0);
  };

  const focusNarration = () => {
    window.setTimeout(() => {
      narrationInputRef.current?.focus();
    }, 0);
  };

  const updateRow = (index, key, value) => {
    if (key === "itemId" && value === END_OF_LIST) {
      focusAdjustmentList();
      return;
    }
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      if (key === "itemId") {
        if (!isEditMode || !rows[index].persistedFromVoucher) {
          rows[index] = recalculateRow(rows[index], prev.date);
        }
        if (value && index === rows.length - 1) {
          rows.push(createEmptyRow());
        }
      }
      if (key === "billedQty") {
        rows[index].billedManuallyEdited = true;
      }
      if (key === "actualQty" && !rows[index].billedManuallyEdited) {
        rows[index].billedQty = value;
      }
      return { ...prev, rows };
    });
  };

  const addRow = () =>
    setForm((prev) => ({ ...prev, rows: [...prev.rows, createEmptyRow()] }));
  const removeRow = (index) =>
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.length === 1 ? [createEmptyRow()] : prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));

  const updateAdjustmentRow = (index, key, value) => {
    if (key === "ledgerId" && value === END_OF_LIST) {
      focusNarration();
      return;
    }
    setForm((prev) => {
      const additionalRows = [...(prev.additionalRows || [emptyAdjustmentRow])];
      additionalRows[index] = { ...additionalRows[index], [key]: value };
      if (key === "ledgerId") {
        if (!value) {
          additionalRows[index] = { ...additionalRows[index], ledgerId: "", value: "" };
        } else if (index === additionalRows.length - 1) {
          additionalRows.push(emptyAdjustmentRow);
        }
      }
      return { ...prev, additionalRows };
    });
  };

  const removeAdjustmentRow = (index) => {
    setForm((prev) => {
      const additionalRows =
        (prev.additionalRows || []).length === 1
          ? [emptyAdjustmentRow]
          : (prev.additionalRows || []).filter((_, rowIndex) => rowIndex !== index);
      return { ...prev, additionalRows };
    });
  };

  const updateDate = (value) => {
    if (isEditMode) {
      setForm((prev) => ({
        ...prev,
        date: value,
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) => recalculateRow(row, value)),
    }));
  };

  const handleNarrationKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    bottomSaveButtonRef.current?.focus();
  };

  const validRows = form.rows.filter(
    (row) => row.itemId && Number(row.billedQty || row.actualQty || 0) > 0,
  );
  const subtotal = validRows.reduce((sum, row) => sum + lineAmount(row), 0);
  const calculateAdjustmentAmount = (value, mode) => {
    const numericValue = Number(value || 0);
    if (mode === "percentage") {
      return Number(((subtotal * numericValue) / 100).toFixed(2));
    }
    return Number(numericValue.toFixed(2));
  };
  const adjustmentRows = (form.additionalRows || [])
    .filter((row) => row.ledgerId && row.ledgerId !== END_OF_LIST)
    .map((row) => {
      const ledger = ledgerMap.get(row.ledgerId);
      const nature = String(ledger?.group?.nature || "").toUpperCase();
      return {
        ...row,
        ledger,
        nature,
        calculatedAmount: calculateAdjustmentAmount(row.value, row.mode),
      };
    })
    .filter((row) => row.ledger && ["EXPENSE", "INCOME"].includes(row.nature));
  const additionalExpenseAmount = adjustmentRows
    .filter((row) => row.nature === "EXPENSE")
    .reduce((sum, row) => sum + row.calculatedAmount, 0);
  const additionalIncomeAmount = adjustmentRows
    .filter((row) => row.nature === "INCOME")
    .reduce((sum, row) => sum + row.calculatedAmount, 0);
  const totalAmount = Number((subtotal + additionalExpenseAmount + additionalIncomeAmount).toFixed(2));
  const totalQty = validRows.reduce(
    (sum, row) => sum + Number(row.billedQty || row.actualQty || 0),
    0,
  );

  const resetForm = (nextNumber = suggestedNumber) =>
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      supplierInvoiceNo: "",
      supplierLedger: "",
      purchaseLedger: defaultPurchaseLedgerId,
      additionalRows: [emptyAdjustmentRow],
      narration: "",
      rows: [createEmptyRow()],
    });

  function navigateToCreateMaster(path) {
    if (isEditMode) return;
    try {
      window.sessionStorage.setItem(
        PURCHASE_VOUCHER_RETURN_STORAGE_KEY,
        JSON.stringify({
          companyId,
          form,
          statusMessage,
        }),
      );
    } catch (error) {
      console.error("Unable to store purchase voucher draft:", error);
    }

    navigate(path, {
      state: {
        returnTo: `${location.pathname}${location.search || ""}`,
        restorePurchaseVoucherDraft: true,
      },
    });
  }

  async function submitPayload(payload, options = {}) {
    if (isEditMode) {
      await api.put(`/companies/${companyId}/vouchers/${editVoucherId}`, payload);
    } else {
      await api.post(`/companies/${companyId}/vouchers`, payload);
    }
    if (options.printAfterSave) {
      await options.printVoucher?.();
    } else if (!options.silentSuccess) {
      alert(isEditMode ? "Purchase voucher updated" : "Purchase voucher saved");
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
  }

  const save = async (options = {}) => {
    if (!form.supplierLedger) return alert("Please select a supplier");
    if (!form.purchaseLedger && !defaultPurchaseLedgerId) {
      return alert("Purchase ledger is missing");
    }
    if (validRows.length === 0) return alert("Please add at least one item");
    const incompleteAdjustment = (form.additionalRows || []).find(
      (row) => !row.ledgerId && Number(row.value || 0) !== 0,
    );
    if (incompleteAdjustment) {
      return alert("Please select an additional expense/income ledger before entering a value.");
    }
    if (totalAmount < 0) {
      return alert("Total amount cannot be negative. Check additional expense / income.");
    }

    const payload = buildPurchasePayload({
      form,
      purchaseTypeId,
      defaultPurchaseLedgerId,
      itemMap,
      validRows,
      subtotal,
      totalAmount,
      adjustmentRows,
      additionalExpenseAmount,
      additionalIncomeAmount,
    });

    await submitPayload(payload, options);
  };

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();

    const instructionRows = [
      ["Purchase Voucher Excel Import"],
      [""],
      ["How to use"],
      ["1. Fill only the item rows in the Purchase Voucher sheet."],
      ["2. Item names must exactly match existing stock item names."],
      ["3. Billed Qty can be blank; it will follow Actual Qty automatically."],
      ["4. Rate is required for every item row."],
      ["5. Import loads item rows into the voucher form only. It does not auto-save the voucher."],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows);
    instructionSheet["!cols"] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, PURCHASE_INSTRUCTION_SHEET);

    const firstItem = items[0];
    const itemRows = padRows(
      [
        [
          firstItem?.name || "",
          1,
          1,
          firstItem ? resolvePurchaseItemRate(firstItem) : "",
          "",
        ],
      ],
      8,
    );

    const templateRows = [
      ["Purchase Product Import Template"],
      [""],
      ["Item Name", "Actual Qty", "Billed Qty", "Rate", "Notes"],
      ...itemRows,
    ];
    const templateSheet = XLSX.utils.aoa_to_sheet(templateRows);
    templateSheet["!cols"] = [
      { wch: 36 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 28 },
    ];
    templateSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    XLSX.utils.book_append_sheet(workbook, templateSheet, PURCHASE_TEMPLATE_SHEET);

    const referenceRows = [
      ["Suppliers", "", "", "Items", "", ""],
      ["Supplier Name", "Current Balance", "", "Item Name", "Stock Group", "Last Known Rate"],
      ...Array.from({
        length: Math.max(suppliers.length, items.length),
      }).map((_, index) => {
        const supplier = suppliers[index];
        const item = items[index];
        return [
          supplier?.name || "",
          supplier
            ? renderBalance(
                supplier.currentBalanceAbs,
                supplier.currentBalanceSide,
                currency.symbol,
              )
            : "",
          "",
          item?.name || "",
          item?.groupName || "",
          item ? resolvePurchaseItemRate(item) : "",
        ];
      }),
    ];
    const referenceSheet = XLSX.utils.aoa_to_sheet(referenceRows);
    referenceSheet["!cols"] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 4 },
      { wch: 34 },
      { wch: 22 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(workbook, referenceSheet, PURCHASE_REFERENCE_SHEET);

    return workbook;
  }

  function handleExportTemplate() {
    const workbook = buildTemplateWorkbook();
    const companySlug = normalizeNameKey(companyName).replace(/[^a-z0-9]+/g, "-") || "company";
    XLSX.writeFile(workbook, `${companySlug}-purchase-import-template.xlsx`);
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description:
        "Use the Purchase Voucher sheet, keep the same structure, and then import the filled file back here.",
    });
  }

  function parseTemplateSheet(workbook) {
    const sheet =
      workbook.Sheets[PURCHASE_TEMPLATE_SHEET] ||
      workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      throw new Error("Purchase Voucher sheet not found in the workbook.");
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: true,
    });

    const itemHeaderIndex = rows.findIndex(
      (row) =>
        normalizeText(row[0]) === "Item Name" &&
        normalizeText(row[1]) === "Actual Qty" &&
        normalizeText(row[2]) === "Billed Qty",
    );
    if (itemHeaderIndex === -1) {
      throw new Error("Item table header is missing from the template.");
    }

    const importedRows = rows
      .slice(itemHeaderIndex + 1)
      .map((row) => ({
        itemName: normalizeText(row[0]),
        actualQty: normalizeText(row[1]),
        billedQty: normalizeText(row[2]),
        rate: normalizeText(row[3]),
      }))
      .filter(
        (row) => row.itemName || row.actualQty || row.billedQty || row.rate,
      );

    return {
      rows: importedRows,
    };
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportBusy(true);
    setStatusMessage(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const parsed = parseTemplateSheet(workbook);

      if (!parsed.rows.length) {
        throw new Error("At least one item row is required in the Excel file.");
      }

      const resolvedRows = parsed.rows.map((row, index) => {
        const item = itemNameMap.get(normalizeNameKey(row.itemName));
        if (!item) {
          throw new Error(
            `Row ${index + 1}: Item "${row.itemName}" was not found. Use an existing item name exactly as listed in Reference Data.`,
          );
        }
        const actualQty = Number(row.actualQty || 0);
        const billedQty = Number(row.billedQty || row.actualQty || 0);
        const rate = Number(row.rate || 0);
        if (!(actualQty > 0)) {
          throw new Error(`Row ${index + 1}: Actual Qty must be greater than 0.`);
        }
        if (!(billedQty > 0)) {
          throw new Error(`Row ${index + 1}: Billed Qty must be greater than 0.`);
        }
        if (!(rate > 0)) {
          throw new Error(`Row ${index + 1}: Rate must be greater than 0.`);
        }
        return {
          itemId: item._id,
          actualQty: String(actualQty),
          billedQty: String(billedQty),
          rate: String(rate),
          discountPercent: "",
          billedManuallyEdited: normalizeText(row.billedQty) !== "",
        };
      });

      setForm((prev) => ({
        number: prev.number || suggestedNumber || "",
        date: prev.date,
        supplierInvoiceNo: prev.supplierInvoiceNo,
        supplierLedger: prev.supplierLedger || "",
        purchaseLedger: prev.purchaseLedger || defaultPurchaseLedgerId,
        additionalRows: prev.additionalRows || [emptyAdjustmentRow],
        narration: prev.narration || "Imported from Excel",
        rows: resolvedRows,
      }));

      setStatusMessage({
        tone: "success",
        title: "Purchase items loaded from Excel",
        description: `${resolvedRows.length} item row(s) loaded into the voucher form. Review the remaining fields and save manually when ready.`,
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        title: "Import failed",
        description: error?.message || "The Excel file could not be imported.",
      });
    } finally {
      setImportBusy(false);
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading purchase voucher...</div>;
  }

  return (
    <VoucherWorkspace
      title="Purchase Voucher"
      subtitle="Capture supplier purchases with item-level quantities, rates, and voucher-wise balances."
      icon={FileSpreadsheet}
      iconTone="bg-blue-50 text-blue-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Purchase Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Supplier", value: supplierLedger?.name || "-" },
        { label: "Purchase Ledger", value: purchaseLedger?.name || "Purchase" },
      ]}
      amountSummaryItems={[
        { label: "Total Quantity", value: `${totalQty} pcs` },
        { label: "Subtotal", value: formatVoucherMoney(subtotal, currency.symbol) },
        {
          label: "Additional Expense",
          value: formatVoucherMoney(additionalExpenseAmount, currency.symbol),
        },
        {
          label: "Additional Income",
          value: formatVoucherMoney(additionalIncomeAmount, currency.symbol),
        },
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
          tone: "text-emerald-600",
          emphasis: true,
        },
      ]}
      showTopSaveButton={false}
      bottomSaveAction={{
        ref: bottomSaveButtonRef,
        label: "Save Voucher",
        className:
          "inline-flex min-h-11 items-center justify-center gap-2 bg-[#1463ff] px-6 py-3 text-[14px] font-semibold text-white",
      }}
      auditLogProps={
        isEditMode
          ? {
              companyId,
              voucherId: editVoucherId,
              voucherTitle: "Purchase Voucher",
            }
          : null
      }
      extraActions={
        !isEditMode ? (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700"
              onClick={handleExportTemplate}
            >
              <Download className="h-4 w-4" />
              Export Demo Excel
            </button>
            <button
              type="button"
              disabled={importBusy}
              className="inline-flex items-center gap-2 border border-[#c8d2de] bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
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
          </>
        ) : null
      }
    >
      {statusMessage ? (
        <section
          className={`border px-4 py-3 text-sm shadow-sm ${
            statusMessage.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <p className="font-semibold">{statusMessage.title}</p>
          <p className="mt-1">{statusMessage.description}</p>
        </section>
      ) : null}

      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
            <TallyDateInput
              data-voucher-date="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.date}
              onChange={updateDate}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Supplier Invoice No.
            </label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.supplierInvoiceNo}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, supplierInvoiceNo: event.target.value }))
              }
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">Party A/c Name</label>
              <button
                type="button"
                className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                onClick={() => navigateToCreateMaster("/masters/create/ledger")}
              >
                Add+
              </button>
            </div>
            <SearchableSelect
              options={supplierOptions}
              value={form.supplierLedger}
              onChange={(newValue) =>
                setForm((prev) => ({ ...prev, supplierLedger: newValue }))
              }
              placeholder="Search supplier"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {supplierLedger
                ? renderBalance(
                    supplierLedger.currentBalanceAbs,
                    supplierLedger.currentBalanceSide,
                    currency.symbol,
                  )
                : "-"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Item Details">
        <div className="space-y-3 md:hidden">
          {form.rows.map((row, index) => {
            const item = itemMap.get(row.itemId);
            return (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Item {index + 1}</p>
                  {form.rows.length > 1 ? (
                    <button
                      type="button"
                      className="rounded-lg p-2 text-rose-500 hover:bg-rose-100"
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-slate-700">Item Name</label>
                      <button
                        type="button"
                        className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        onClick={() => navigateToCreateMaster("/masters/create/stock-item")}
                      >
                        Add+
                      </button>
                    </div>
                    <SearchableSelect
                      options={itemOptions}
                      value={row.itemId}
                      onChange={(newValue) => updateRow(index, "itemId", newValue)}
                      placeholder="Search item"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Stock: {Number(item?.openingQty || item?.currentQty || 0).toLocaleString("en-IN")} pcs
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Actual</label>
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.actualQty}
                        onChange={(event) => updateRow(index, "actualQty", event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Billed</label>
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.billedQty}
                        onChange={(event) => updateRow(index, "billedQty", event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Rate</label>
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.rate}
                        onChange={(event) => updateRow(index, "rate", event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Disc %</label>
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.discountPercent}
                        onChange={(event) => updateRow(index, "discountPercent", event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Amount</label>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-900">
                      {formatVoucherMoney(lineAmount(row), currency.symbol)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto overflow-y-visible rounded-2xl border border-slate-200 md:block">
          <table className="min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">
                  <div className="flex items-center justify-between gap-3">
                    <span>Item Name</span>
                    <button
                      type="button"
                      className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={() => navigateToCreateMaster("/masters/create/stock-item")}
                    >
                      Add+
                    </button>
                  </div>
                </th>
                <th className="px-4 py-3 font-medium">Actual</th>
                <th className="px-4 py-3 font-medium">Billed</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Disc %</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-4">
                    <SearchableSelect
                      options={itemOptions}
                      value={row.itemId}
                      onChange={(newValue) => updateRow(index, "itemId", newValue)}
                      placeholder="Search item"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      data-vnav="true"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.actualQty}
                      onChange={(event) => updateRow(index, "actualQty", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      data-vnav="true"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.billedQty}
                      onChange={(event) => updateRow(index, "billedQty", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      data-vnav="true"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.rate}
                      onChange={(event) => updateRow(index, "rate", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      data-vnav="true"
                      className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                      value={row.discountPercent}
                      onChange={(event) => updateRow(index, "discountPercent", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {formatVoucherMoney(lineAmount(row), currency.symbol)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {form.rows.length > 1 ? (
                      <button
                        type="button"
                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </VoucherPanel>

      <VoucherPanel title="Additional Expense / Income">
        <div ref={adjustmentPanelRef} className="overflow-x-auto overflow-y-visible border border-[#bccfe3]">
          <table className="min-w-[760px] text-sm">
            <thead className="bg-[#edf4ff] text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">
                  <div className="flex items-center justify-between gap-3">
                    <span>Additional Expense / Income</span>
                    <button
                      type="button"
                      className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={() => navigateToCreateMaster("/masters/create/ledger")}
                    >
                      Add+
                    </button>
                  </div>
                </th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 text-right font-medium">Calculated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(form.additionalRows || [emptyAdjustmentRow]).map((row, index) => {
                const ledger = ledgerMap.get(row.ledgerId);
                const calculated = calculateAdjustmentAmount(row.value, row.mode);
                return (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-4 align-top text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4 align-top">
                      <SearchableSelect
                        options={adjustmentLedgerOptions}
                        value={row.ledgerId}
                        onChange={(newValue) => updateAdjustmentRow(index, "ledgerId", newValue)}
                        placeholder="Search additional expense / income"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {ledger
                          ? `${ledger.group?.nature || ""} - ${ledger.group?.name || ledger.groupName || ""}`
                          : "Select End of List to continue"}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <select
                        data-vnav="true"
                        disabled={!row.ledgerId}
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        value={row.mode}
                        onChange={(event) => updateAdjustmentRow(index, "mode", event.target.value)}
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        disabled={!row.ledgerId}
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        value={row.value}
                        onChange={(event) => updateAdjustmentRow(index, "value", event.target.value)}
                        placeholder={
                          row.ledgerId
                            ? row.mode === "percentage"
                              ? "Use + or - percentage"
                              : "Use + or - amount"
                            : "Select ledger first"
                        }
                      />
                    </td>
                    <td className="px-4 py-4 align-top text-right font-semibold text-slate-900">
                      {formatVoucherMoney(row.ledgerId ? calculated : 0, currency.symbol)}
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      {(form.additionalRows || []).length > 1 ? (
                        <button
                          type="button"
                          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                          onClick={() => removeAdjustmentRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Narration">
        <input
          ref={narrationInputRef}
          data-vnav="true"
          className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          onKeyDown={handleNarrationKeyDown}
          placeholder="Purchased from supplier as per bill."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
