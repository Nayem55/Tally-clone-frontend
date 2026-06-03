import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import api from "../api/api";
import { useLocation, useNavigate } from "react-router-dom";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";
import {
  buildSalesFamilyPrintData,
  previewVoucherDocument,
  printVoucherDocument,
} from "../utils/printVoucher";
import {
  exportWorkbookToFile,
  normalizeExcelNameKey,
  normalizeExcelText,
  normalizeImportedExcelDate,
  padExcelRows,
  parseFieldValueMap,
  parseWorksheetRows,
} from "../utils/voucherExcel";

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

const SALES_TEMPLATE_SHEET = "Sales Voucher";
const SALES_INSTRUCTION_SHEET = "Instructions";
const SALES_REFERENCE_SHEET = "Reference Data";
const SALES_VOUCHER_RETURN_STORAGE_KEY = "sales-voucher-return-draft";

export default function SalesVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const hasHydratedEditVoucherRef = useRef(false);
  const fileInputRef = useRef(null);
  const bottomSaveButtonRef = useRef(null);
  const adjustmentPanelRef = useRef(null);
  const narrationInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [salesTypeId, setSalesTypeId] = useState("");
  const [salesLedgerId, setSalesLedgerId] = useState("");
  const [partyLedgers, setPartyLedgers] = useState([]);
  const [salesLedgers, setSalesLedgers] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const companyName =
    companies.find((entry) => String(entry._id) === String(companyId))?.name || "";
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    partyLedger: "",
    salesLedger: "",
    priceLevelId: "",
    narration: "",
    additionalRows: [emptyAdjustmentRow],
    rows: [emptyRow],
  });
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: salesTypeId,
    companyName,
    voucherLabel: "Sales",
    disabled: isEditMode,
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      setLoading(true);
      try {
        const [
          voucherResponse,
          debtorResponse,
          itemResponse,
          defaultsResponse,
          companyResponse,
          balanceResponse,
          salesLedgerResponse,
          priceLevelResponse,
        ] = await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Debtors`),
          api.get(`/companies/${companyId}/items`),
          api.get(`/companies/${companyId}/ledgers/defaults`),
          api.get("/companies"),
          api.get(`/companies/${companyId}/ledgers/with-balances`, { params: { to: form.date } }),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sales Accounts`),
          api.get(`/companies/${companyId}/price-levels`),
        ]);

        const salesType = voucherResponse.data.find((row) => row.name.toLowerCase() === "sales");
        const defaultSalesId = defaultsResponse.data.salesLedger?._id || "";
        setSalesTypeId(salesType?._id || "");
        setPartyLedgers(debtorResponse.data);
        setItems(itemResponse.data);
        setCompanies(companyResponse.data);
        setAllLedgers(balanceResponse.data);
        setSalesLedgers(salesLedgerResponse.data);
        setPriceLevels(priceLevelResponse.data);
        setSalesLedgerId(defaultSalesId);
        setForm((prev) => ({
          ...prev,
          salesLedger: defaultSalesId,
        }));
      } catch (error) {
        alert("Failed to load sales master data");
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, [companyId, form.date]);

  useEffect(() => {
    let alive = true;

    async function loadVoucherForEdit() {
      if (!companyId || !editVoucherId || items.length === 0 || allLedgers.length === 0) return;
      const response = await api.get(`/companies/${companyId}/vouchers/${editVoucherId}`);
      const voucher = response.data;
      const editLedgerMap = new Map(allLedgers.map((ledger) => [String(ledger._id), ledger]));
      const debitLines = (voucher.lines || []).filter((line) => Number(line.debit || 0) > 0);
      const creditLines = (voucher.lines || []).filter((line) => Number(line.credit || 0) > 0);
      const ledgerNature = (line) =>
        String(editLedgerMap.get(String(line.ledgerId || ""))?.group?.nature || "").toUpperCase();
      const isExpenseLine = (line) => ledgerNature(line) === "EXPENSE";
      const isSalesLine = (line) =>
        normalizeExcelNameKey(
          editLedgerMap.get(String(line.ledgerId || ""))?.group?.name || "",
        ) === "sales accounts";
      const debitLine = debitLines.find((line) => !isExpenseLine(line)) || debitLines[0];
      const creditLine = creditLines.find(isSalesLine) || creditLines[0];
      const additionalExpenseLine =
        debitLines.find((line) => isExpenseLine(line)) || null;
      const additionalIncomeLine =
        creditLines.find(
          (line) =>
            ledgerNature(line) === "INCOME" &&
            String(line.ledgerId || "") !== String(creditLine?.ledgerId || ""),
        ) || null;
      const savedAdjustments = Array.isArray(voucher.commercialMeta?.additionalAdjustments)
        ? voucher.commercialMeta.additionalAdjustments
        : [];
      const additionalRows =
        savedAdjustments.length > 0
          ? savedAdjustments.map((row) => ({
              ledgerId: String(row.ledgerId || ""),
              mode: row.mode || "fixed",
              value: String(row.value ?? row.amount ?? ""),
            }))
          : [
              ...(voucher.commercialMeta?.additionalExpenseLedgerId || additionalExpenseLine
                ? [
                    {
                      ledgerId: String(
                        voucher.commercialMeta?.additionalExpenseLedgerId ||
                          additionalExpenseLine?.ledgerId ||
                          "",
                      ),
                      mode: voucher.commercialMeta?.additionalExpenseMode || "fixed",
                      value: String(
                        voucher.commercialMeta?.additionalExpenseValue ??
                          voucher.commercialMeta?.additionalExpenseAmount ??
                          additionalExpenseLine?.debit ??
                          voucher.commercialMeta?.invoiceDiscount ??
                          "",
                      ),
                    },
                  ]
                : []),
              ...(voucher.commercialMeta?.additionalIncomeLedgerId || additionalIncomeLine
                ? [
                    {
                      ledgerId: String(
                        voucher.commercialMeta?.additionalIncomeLedgerId ||
                          additionalIncomeLine?.ledgerId ||
                          "",
                      ),
                      mode: voucher.commercialMeta?.additionalIncomeMode || "fixed",
                      value: String(
                        voucher.commercialMeta?.additionalIncomeValue ??
                          voucher.commercialMeta?.additionalIncomeAmount ??
                          additionalIncomeLine?.credit ??
                          voucher.commercialMeta?.additionalCharges ??
                          "",
                      ),
                    },
                  ]
                : []),
            ];

      if (!alive) return;
      hasHydratedEditVoucherRef.current = true;
      setForm({
        number: voucher.number || "",
        date: voucher.date ? String(voucher.date).slice(0, 10) : formatDateForInput(new Date()),
        partyLedger: String(debitLine?.ledgerId || ""),
        salesLedger: String(creditLine?.ledgerId || salesLedgerId || ""),
        priceLevelId: "",
        narration: voucher.narration || "",
        additionalRows:
          additionalRows.length > 0
            ? [...additionalRows, emptyAdjustmentRow]
            : [emptyAdjustmentRow],
        rows:
          (voucher.inventoryLines || []).map((line) => ({
            itemId: String(line.itemId || ""),
            actualQty: String(line.qty || line.billedQty || 1),
            billedQty: String(line.billedQty || line.qty || 1),
            rate: Number(line.rate || 0),
            discountPercent: "",
            billedManuallyEdited:
              String(line.billedQty || line.qty || 1) !==
              String(line.qty || line.billedQty || 1),
            persistedFromVoucher: true,
          })) || [emptyRow],
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [companyId, editVoucherId, items.length, allLedgers, salesLedgerId]);

  useEffect(() => {
    if (isEditMode && hasHydratedEditVoucherRef.current) {
      hasHydratedEditVoucherRef.current = false;
      return;
    }
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => recalculateRow(row, prev.date, prev.priceLevelId)),
    }));
  }, [form.partyLedger, form.priceLevelId, items.length, isEditMode]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) => (prev.number ? prev : { ...prev, number: suggestedNumber }));
  }, [suggestedNumber, isEditMode]);

  useEffect(() => {
    if (isEditMode || !companyId || !location.state?.restoreSalesVoucherDraft) return;
    try {
      const raw = window.sessionStorage.getItem(SALES_VOUCHER_RETURN_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (String(draft?.companyId || "") !== String(companyId)) return;
      if (!draft?.form) return;
      setForm(draft.form);
      setStatusMessage(draft.statusMessage || null);
      window.sessionStorage.removeItem(SALES_VOUCHER_RETURN_STORAGE_KEY);
    } catch (error) {
      console.error("Unable to restore sales voucher draft:", error);
    }
  }, [companyId, isEditMode, location.state]);

  const company = companies.find((entry) => String(entry._id) === String(companyId));
  const currency = getCompanyCurrency(company);
  const ledgerMap = useMemo(
    () => new Map(allLedgers.map((ledger) => [ledger._id, ledger])),
    [allLedgers]
  );
  const itemMap = useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
  const itemNameMap = useMemo(
    () => new Map(items.map((item) => [normalizeExcelNameKey(item.name), item])),
    [items]
  );
  const partyLedger = ledgerMap.get(form.partyLedger) || partyLedgers.find((row) => row._id === form.partyLedger);
  const partyNameMap = useMemo(
    () => new Map(partyLedgers.map((ledger) => [normalizeExcelNameKey(ledger.name), ledger])),
    [partyLedgers]
  );
  const activePriceLevelId = form.priceLevelId || partyLedger?.priceLevelId || "";
  const salesLedger = ledgerMap.get(form.salesLedger || salesLedgerId);
  const partyOptions = useMemo(
    () => partyLedgers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [partyLedgers]
  );
  const priceLevelOptions = useMemo(
    () => priceLevels.map((level) => ({ value: level._id, label: level.name || level.code })),
    [priceLevels]
  );
  const itemOptions = useMemo(
    () => [
      { value: END_OF_LIST, label: "End of List", meta: "" },
      ...items.map((item) => ({ value: item._id, label: item.name })),
    ],
    [items]
  );
  const adjustmentLedgerOptions = useMemo(
    () =>
      [
        {
          value: END_OF_LIST,
          label: "End of List",
          meta: "",
        },
        ...allLedgers
        .filter(
          (ledger) =>
            ["EXPENSE", "INCOME"].includes(String(ledger.group?.nature || "").toUpperCase()) &&
            String(ledger._id) !== String(form.salesLedger || salesLedgerId),
        )
        .map((ledger) => ({
          value: ledger._id,
          label: ledger.name,
          meta: "",
        })),
      ],
    [allLedgers, form.salesLedger, salesLedgerId],
  );
  useEffect(() => {
    if (isEditMode) return;
    if (!partyLedger?.priceLevelId) return;
    setForm((prev) =>
      prev.priceLevelId === partyLedger.priceLevelId
        ? prev
        : { ...prev, priceLevelId: partyLedger.priceLevelId }
    );
  }, [partyLedger?.priceLevelId, isEditMode]);

  const lineAmount = (row) => {
    const qty = Number(row.billedQty || row.actualQty || 0);
    const rate = Number(row.rate || 0);
    const gross = qty * rate;
    const discount = (gross * Number(row.discountPercent || 0)) / 100;
    return Number((gross - discount).toFixed(2));
  };

  const recalculateRow = (row, voucherDate, priceLevelId) => {
    if (!row.itemId) return row;
    const item = itemMap.get(row.itemId);
    const rate = resolveItemRateByDate(item, priceLevelId || null, voucherDate);
    return { ...row, rate };
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
          rows[index] = recalculateRow(rows[index], prev.date, activePriceLevelId);
        }
        if (value && index === rows.length - 1) {
          rows.push(emptyRow);
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

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      rows: [...prev.rows, emptyRow],
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.length === 1 ? [emptyRow] : prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

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
      rows: prev.rows.map((row) => recalculateRow(row, value, activePriceLevelId)),
    }));
  };

  const updatePriceLevel = (value) => {
    if (isEditMode) {
      setForm((prev) => ({
        ...prev,
        priceLevelId: value,
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      priceLevelId: value,
      rows: prev.rows.map((row) => recalculateRow(row, prev.date, value || partyLedger?.priceLevelId)),
    }));
  };

  const validRows = form.rows.filter((row) => row.itemId && Number(row.billedQty || row.actualQty || 0) > 0);
  const subtotal = validRows.reduce((sum, row) => sum + lineAmount(row), 0);
  const totalDiscount = validRows.reduce((sum, row) => {
    const qty = Number(row.billedQty || row.actualQty || 0);
    const rate = Number(row.rate || 0);
    return sum + (qty * rate * Number(row.discountPercent || 0)) / 100;
  }, 0);
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
  const totalQty = validRows.reduce((sum, row) => sum + Number(row.billedQty || row.actualQty || 0), 0);

  const printData = useMemo(
    () =>
      buildSalesFamilyPrintData({
        company,
        voucherTypeLabel: "Sales",
        voucherSubtitle: "Sales Voucher Print Preview",
        voucherNumber: form.number,
        voucherDate: form.date,
        partyLabel: "Party Details",
        partyName: partyLedger?.name || "",
        partyMeta: [
          `Price Level: ${
            priceLevels.find((level) => level._id === activePriceLevelId)?.name ||
            priceLevels.find((level) => level._id === activePriceLevelId)?.code ||
            "Not Applicable"
          }`,
        ],
        accountLabel: "Sales Ledger",
        accountName: salesLedger?.name || "",
        rows: validRows.map((row) => {
          const item = itemMap.get(row.itemId);
          const billedQty = Number(row.billedQty || row.actualQty || 0);
          const actualQty = Number(row.actualQty || billedQty);
          return {
            name: item?.name || "-",
            subtext:
              actualQty !== billedQty
                ? `Actual Qty: ${actualQty} | Billed Qty: ${billedQty}`
                : "",
            qty: `${billedQty}`,
            rate: formatVoucherMoney(row.rate, currency.symbol),
            discount: Number(row.discountPercent || 0)
              ? `${Number(row.discountPercent || 0).toFixed(2)}%`
              : "",
            amount: formatVoucherMoney(lineAmount(row), currency.symbol),
          };
        }),
        totals: [
          { label: "Subtotal", value: formatVoucherMoney(subtotal, currency.symbol) },
          {
            label: "Line Discount",
            value: formatVoucherMoney(totalDiscount, currency.symbol),
          },
          {
            label: "Additional Expense",
            value: formatVoucherMoney(additionalExpenseAmount, currency.symbol),
          },
          {
            label: "Additional Income",
            value: formatVoucherMoney(additionalIncomeAmount, currency.symbol),
          },
          {
            label: "Net Payable",
            value: formatVoucherMoney(totalAmount, currency.symbol),
            emphasis: true,
          },
        ],
        narration: form.narration,
        currencySymbol: `${currency.code || ""} ${currency.symbol || ""}`.trim(),
      }),
    [
      company,
      form.number,
      form.date,
      form.narration,
      partyLedger,
      priceLevels,
      activePriceLevelId,
      salesLedger,
      validRows,
      itemMap,
      currency.symbol,
      currency.code,
      subtotal,
      totalDiscount,
      additionalExpenseAmount,
      additionalIncomeAmount,
      totalAmount,
    ]
  );

  const resetForm = (nextNumber = suggestedNumber) =>
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      partyLedger: "",
      salesLedger: salesLedgerId,
      priceLevelId: "",
      narration: "",
      additionalRows: [emptyAdjustmentRow],
      rows: [emptyRow],
    });

  function navigateToCreateMaster(path) {
    if (isEditMode) return;
    try {
      window.sessionStorage.setItem(
        SALES_VOUCHER_RETURN_STORAGE_KEY,
        JSON.stringify({
          companyId,
          form,
          statusMessage,
        }),
      );
    } catch (error) {
      console.error("Unable to store sales voucher draft:", error);
    }

    navigate(path, {
      state: {
        returnTo: `${location.pathname}${location.search || ""}`,
        restoreSalesVoucherDraft: true,
      },
    });
  }

  function buildTemplateWorkbook() {
    const workbook = XLSX.utils.book_new();

    const instructionRows = [
      ["Sales Voucher Excel Import"],
      [""],
      ["How to use"],
      ["1. Fill the Sales Voucher sheet only."],
      ["2. Item names must exactly match existing stock items."],
      ["3. If Billed Qty is blank it will follow Actual Qty."],
      ["4. Discount % is optional and works item-wise."],
      ["5. Import only loads item rows into the form. Review and save manually."],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows);
    instructionSheet["!cols"] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, SALES_INSTRUCTION_SHEET);

    const firstItem = items[0];
    const itemRows = padExcelRows(
      [[firstItem?.name || "", 1, 1, firstItem ? resolveItemRateByDate(firstItem, activePriceLevelId || null, form.date) : "", "", ""]],
      8,
      () => ["", "", "", "", "", ""]
    );

    const templateRows = [
      ["Sales Voucher Import Template"],
      [""],
      ["Item Name", "Actual Qty", "Billed Qty", "Rate", "Disc %", "Notes"],
      ...itemRows,
    ];
    const templateSheet = XLSX.utils.aoa_to_sheet(templateRows);
    templateSheet["!cols"] = [
      { wch: 34 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 26 },
    ];
    templateSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    XLSX.utils.book_append_sheet(workbook, templateSheet, SALES_TEMPLATE_SHEET);

    const referenceRows = [
      ["Customers", "", "", "Items", "", "", "Price Levels"],
      ["Customer Name", "Current Balance", "", "Item Name", "Stock Group", "Last Known Rate", "Price Level Name"],
      ...Array.from({ length: Math.max(partyLedgers.length, items.length, priceLevels.length) }).map((_, index) => {
        const party = partyLedgers[index];
        const item = items[index];
        const level = priceLevels[index];
        return [
          party?.name || "",
          party
            ? renderBalance(
                party.currentBalanceAbs,
                party.currentBalanceSide,
                currency.symbol
              )
            : "",
          "",
          item?.name || "",
          item?.groupName || "",
          item ? resolveItemRateByDate(item, activePriceLevelId || null, form.date) : "",
          level?.name || level?.code || "",
        ];
      }),
    ];
    const referenceSheet = XLSX.utils.aoa_to_sheet(referenceRows);
    referenceSheet["!cols"] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 4 },
      { wch: 34 },
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(workbook, referenceSheet, SALES_REFERENCE_SHEET);
    return workbook;
  }

  function handleExportTemplate() {
    const workbook = buildTemplateWorkbook();
    const companySlug = normalizeExcelNameKey(companyName).replace(/[^a-z0-9]+/g, "-") || "company";
    exportWorkbookToFile(workbook, `${companySlug}-sales-import-template.xlsx`);
    setStatusMessage({
      tone: "success",
      title: "Demo Excel exported",
      description:
        "Use the Sales Voucher sheet, keep the same structure, and import the filled file back here to load item rows.",
    });
  }

  function parseTemplate(workbook) {
    const rows = parseWorksheetRows(workbook, SALES_TEMPLATE_SHEET);
    const itemHeaderIndex = rows.findIndex(
      (row) => normalizeExcelText(row[0]) === "Item Name" && normalizeExcelText(row[1]) === "Actual Qty"
    );
    if (itemHeaderIndex === -1) {
      throw new Error("Item table header is missing from the Sales template.");
    }
    const importedRows = rows
      .slice(itemHeaderIndex + 1)
      .map((row) => ({
        itemName: normalizeExcelText(row[0]),
        actualQty: normalizeExcelText(row[1]),
        billedQty: normalizeExcelText(row[2]),
        rate: normalizeExcelText(row[3]),
        discountPercent: normalizeExcelText(row[4]),
      }))
      .filter((row) => row.itemName || row.actualQty || row.billedQty || row.rate || row.discountPercent);

    return { rows: importedRows };
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportBusy(true);
    setStatusMessage(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed = parseTemplate(workbook);
      const resolvedRows = parsed.rows.map((row, index) => {
        const item = itemNameMap.get(normalizeExcelNameKey(row.itemName));
        if (!item) {
          throw new Error(`Row ${index + 1}: Item "${row.itemName}" was not found.`);
        }
        const actualQty = Number(row.actualQty || 0);
        const billedQty = Number(row.billedQty || row.actualQty || 0);
        const rate =
          Number(row.rate || 0) ||
          resolveItemRateByDate(item, activePriceLevelId || null, form.date);
        if (!(actualQty > 0)) throw new Error(`Row ${index + 1}: Actual Qty must be greater than 0.`);
        if (!(billedQty > 0)) throw new Error(`Row ${index + 1}: Billed Qty must be greater than 0.`);
        if (!(rate > 0)) throw new Error(`Row ${index + 1}: Rate must be greater than 0.`);
        return {
          itemId: item._id,
          actualQty: String(actualQty),
          billedQty: String(billedQty),
          rate: Number(rate),
          discountPercent: String(Number(row.discountPercent || 0) || ""),
          billedManuallyEdited: normalizeExcelText(row.billedQty) !== "",
        };
      });
      setForm((prev) => ({
        ...prev,
        rows: resolvedRows,
      }));
      setStatusMessage({
        tone: "success",
        title: "Sales items loaded from Excel",
        description: `${resolvedRows.length} item row(s) were loaded into the form. Review the header details and save manually.`,
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

  const save = async (options = {}) => {
    if (!form.partyLedger) return alert("Please select a party account");
    if (!form.salesLedger && !salesLedgerId) return alert("Sales ledger is missing for this company");
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

    const inventoryLines = validRows.map((row) => {
      const item = itemMap.get(row.itemId);
      return {
        itemId: item._id,
        itemName: item.name,
        qty: Number(row.billedQty || row.actualQty),
        rate: Number(row.rate),
        discount: Number(row.discountPercent || 0),
        amount: lineAmount(row),
        productSnapshot: { name: item.name, prices: item.prices },
      };
    });

    const lines = [
      { ledgerId: form.partyLedger, debit: totalAmount, credit: 0 },
      { ledgerId: form.salesLedger || salesLedgerId, debit: 0, credit: subtotal },
    ];

    const pushSignedAdjustmentLine = (ledgerId, amount) => {
      const signedAmount = Number(amount || 0);
      if (!ledgerId || signedAmount === 0) return;
      lines.push({
        ledgerId,
        debit: signedAmount < 0 ? Math.abs(signedAmount) : 0,
        credit: signedAmount > 0 ? signedAmount : 0,
      });
    };

    adjustmentRows.forEach((row) => {
      pushSignedAdjustmentLine(row.ledgerId, row.calculatedAmount);
    });

    const payload = {
      voucherTypeId: salesTypeId,
      voucherName: "Sales",
      number: form.number,
      date: form.date,
      narration: form.narration || "Sales Voucher",
      commercialMeta: {
        subtotal,
        lineDiscountTotal: totalDiscount,
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
      salesMeta: {},
      lines,
      inventoryLines,
    };

    if (isEditMode) {
      await api.put(`/companies/${companyId}/vouchers/${editVoucherId}`, payload);
    } else {
      await api.post(`/companies/${companyId}/vouchers`, payload);
    }

    if (options.printAfterSave) {
      await options.printVoucher?.();
    } else {
      alert(isEditMode ? "Sales voucher updated" : "Sales voucher saved");
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
  };

  const handleNarrationKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    bottomSaveButtonRef.current?.focus();
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading sales voucher...</div>;
  }

  return (
    <VoucherWorkspace
      title="Sales Voucher"
      subtitle="Create item-wise sales invoices with party balances, price levels, and dated rates."
      icon={FileText}
      iconTone="bg-emerald-50 text-emerald-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Sales Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Party A/c", value: partyLedger?.name || "-" },
        { label: "Sales Ledger", value: salesLedger?.name || "Sales" },
      ]}
      amountSummaryItems={[
        { label: "Total Quantity", value: `${totalQty} pcs` },
        { label: "Subtotal", value: formatVoucherMoney(subtotal, currency.symbol) },
        { label: "Line Discount", value: formatVoucherMoney(totalDiscount, currency.symbol) },
        { label: "Additional Expense", value: formatVoucherMoney(additionalExpenseAmount, currency.symbol) },
        { label: "Additional Income", value: formatVoucherMoney(additionalIncomeAmount, currency.symbol) },
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
          tone: "text-emerald-600",
          emphasis: true,
        },
      ]}
      onPreviewPrint={() => previewVoucherDocument(printData)}
      onPrintAfterSave={() => printVoucherDocument(printData)}
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
              voucherTitle: "Sales Voucher",
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              options={partyOptions}
              value={form.partyLedger}
              onChange={(newValue) => setForm((prev) => ({ ...prev, partyLedger: newValue }))}
              placeholder="Search customer"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {partyLedger
                ? renderBalance(
                    partyLedger.currentBalanceAbs,
                    partyLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">Price Level</label>
              <button
                type="button"
                className="rounded-md border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                onClick={() => navigateToCreateMaster("/masters/create/price-list")}
              >
                Add+
              </button>
            </div>
            <SearchableSelect
              options={[{ value: "", label: "Party Default / Not Applicable" }, ...priceLevelOptions]}
              value={form.priceLevelId}
              onChange={updatePriceLevel}
              placeholder="Search price level"
            />
            <p className="mt-2 text-xs text-slate-500">
              Selected:{" "}
              {priceLevels.find((level) => String(level._id) === String(activePriceLevelId))?.name ||
                priceLevels.find((level) => String(level._id) === String(activePriceLevelId))?.code ||
                (partyLedger?.priceLevelId ? "Party Fixed Price Level" : "Party Default / Not Applicable")}
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
          <table className="min-w-[760px] text-sm table-head">
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
              {form.rows.map((row, index) => {
                const item = itemMap.get(row.itemId);
                return (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-4 align-top text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4 align-top">
                      <SearchableSelect
                        options={itemOptions}
                        value={row.itemId}
                        onChange={(newValue) => updateRow(index, "itemId", newValue)}
                        placeholder="Search item"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Stock: {Number(item?.openingQty || item?.currentQty || 0).toLocaleString("en-IN")} pcs
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.actualQty}
                        onChange={(event) => updateRow(index, "actualQty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.billedQty}
                        onChange={(event) => updateRow(index, "billedQty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.rate}
                        onChange={(event) => updateRow(index, "rate", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.discountPercent}
                        onChange={(event) => updateRow(index, "discountPercent", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top text-right font-semibold text-slate-900">
                      {formatVoucherMoney(lineAmount(row), currency.symbol)}
                    </td>
                    <td className="px-4 py-4 align-top text-right">
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
                );
              })}
            </tbody>
          </table>
        </div>

      </VoucherPanel>

      <VoucherPanel title="Additional Expense / Income">
        <div ref={adjustmentPanelRef} className="overflow-x-auto overflow-y-visible border border-[#bccfe3]">
          <table className="min-w-[860px] text-sm">
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
          placeholder="Sold to customer as per invoice."
        />
      </VoucherPanel>
    </VoucherWorkspace>
  );
}
