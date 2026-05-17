import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarRange, Download, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import { exportInventoryReportExcel, exportInventoryReportPdf } from "../utils/inventoryReportExport";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";

const VARIANTS = {
  "stock-group": {
    title: "Stock Group Analysis",
    searchLabel: "Stock Group Name",
    searchPlaceholder: "Search stock group name...",
  },
  "stock-category": {
    title: "Stock Category Analysis",
    searchLabel: "Stock Category Name",
    searchPlaceholder: "Search stock category name...",
  },
  "stock-item": {
    title: "Stock Item Analysis",
    searchLabel: "Item Name",
    searchPlaceholder: "Search item name...",
  },
  group: {
    title: "Group Analysis",
    searchLabel: "Group Name",
    searchPlaceholder: "Search primary or child group...",
  },
  ledger: {
    title: "Ledger Analysis",
    searchLabel: "Ledger Name",
    searchPlaceholder: "Search ledger name...",
  },
  "sales-person": {
    title: "Sales Person Analysis",
    searchLabel: "Sales Person",
    searchPlaceholder: "Search sales employee name...",
  },
};

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatRate(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultMonthStart() {
  const now = new Date();
  return formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function todayValue() {
  return formatLocalDateInput(new Date());
}

function SummaryCard({ title, value, tone = "text-slate-900", icon }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">{icon}</div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
        </div>
      </div>
    </article>
  );
}

export default function InventoryMovementAnalysisPage({ variant = "stock-group" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const view = VARIANTS[variant] || VARIANTS["stock-group"];
  const hideClosing =
    variant === "group" || variant === "ledger";
  const isSalesPersonView = variant === "sales-person";
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || defaultMonthStart());
  const [toDate, setToDate] = useState(searchParams.get("to") || todayValue());
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [report, setReport] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(false);
  const requestedCompanyId = searchParams.get("companyId") || "";
  const requestedSalesPersonId = searchParams.get("salesPersonId") || "";
  const requestedSalesPersonName = searchParams.get("salesPersonName") || "";
  const requestedGroupId = searchParams.get("groupId") || "";
  const requestedGroupName = searchParams.get("groupName") || "";
  const requestedCategory = searchParams.get("category") || "";

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      const list = response.data || [];
      setCompanies(list);
      if (list.length > 0) {
        setCompanyId((current) => current || requestedCompanyId || list[0]._id);
      }
    }

    loadCompanies();
  }, [requestedCompanyId]);

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      setLoading(true);
      try {
        const response = await api.get(
          `/companies/${companyId}/reports/inventory-movement-analysis`,
          {
            params: {
              from: fromDate,
              to: toDate,
              dimension: variant,
              salesPersonId: requestedSalesPersonId,
              groupId: requestedGroupId,
              category: requestedCategory,
            },
          },
        );
        setReport(response.data || { rows: [], totals: {} });
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [
    companyId,
    fromDate,
    toDate,
    variant,
    requestedSalesPersonId,
    requestedGroupId,
    requestedCategory,
  ]);

  const selectedCompany = companies.find((company) => company._id === companyId);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return report.rows || [];
    return (report.rows || []).filter((row) =>
      [row.name, row.secondaryLabel, row.metrics?.employeeNumber, row.metrics?.department]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [report.rows, search]);
  const totals = useMemo(() => {
    const rows = filteredRows || [];
    if (isSalesPersonView) {
      return rows.reduce(
        (sum, row) => {
          const metrics = row.metrics || {};
          sum.salesQty += Number(metrics.salesQty || 0);
          sum.salesValue += Number(metrics.salesValue || 0);
          sum.invoiceCount += Number(metrics.invoiceCount || 0);
          sum.customerCount += Number(metrics.customerCount || 0);
          return sum;
        },
        { salesQty: 0, salesValue: 0, invoiceCount: 0, customerCount: 0 },
      );
    }

    return rows.reduce(
      (sum, row) => {
        const metrics = row.metrics || {};
        sum.openingQty += Number(metrics.openingQty || 0);
        sum.openingValue += Number(metrics.openingValue || 0);
        sum.inwardQty += Number(metrics.inwardQty || 0);
        sum.inwardValue += Number(metrics.inwardValue || 0);
        sum.outwardQty += Number(metrics.outwardQty || 0);
        sum.outwardValue += Number(metrics.outwardValue || 0);
        sum.closingQty += Number(metrics.closingQty || 0);
        sum.closingValue += Number(metrics.closingValue || 0);
        return sum;
      },
      {
        openingQty: 0,
        openingValue: 0,
        inwardQty: 0,
        inwardValue: 0,
        outwardQty: 0,
        outwardValue: 0,
        closingQty: 0,
        closingValue: 0,
      },
    );
  }, [filteredRows, isSalesPersonView]);
  useReportFocusRestore(containerRef, [
    filteredRows,
    companyId,
    fromDate,
    toDate,
    variant,
    requestedSalesPersonId,
    requestedGroupId,
    requestedCategory,
  ]);
  useReportKeyboardNav(
    containerRef,
    [
      filteredRows,
      companyId,
      fromDate,
      toDate,
      variant,
      requestedSalesPersonId,
      requestedGroupId,
      requestedCategory,
    ],
    {
    onExit: () => navigateBackFromReport(navigate, location),
    },
  );

  function buildDrillPath(row) {
    const shared = `companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
    const salesPersonScope = requestedSalesPersonId
      ? `&salesPersonId=${encodeURIComponent(requestedSalesPersonId)}&salesPersonName=${encodeURIComponent(requestedSalesPersonName)}`
      : "";

    if (variant === "stock-group") {
      if (requestedSalesPersonId) {
        return `/reports/inventory-books/movement-analysis/stock-category?${shared}${salesPersonScope}&groupId=${encodeURIComponent(row.id)}&groupName=${encodeURIComponent(row.name)}`;
      }
      return `/reports/inventory-books/stock-group-summary?${shared}&groupId=${encodeURIComponent(row.id)}`;
    }

    if (variant === "stock-category") {
      if (requestedSalesPersonId) {
        return `/reports/inventory-books/movement-analysis/stock-item?${shared}${salesPersonScope}&groupId=${encodeURIComponent(requestedGroupId)}&groupName=${encodeURIComponent(requestedGroupName)}&category=${encodeURIComponent(row.name)}`;
      }
      return `/reports/inventory-books/stock-item?${shared}&category=${encodeURIComponent(row.name)}`;
    }

    if (variant === "stock-item") {
      return `/reports/inventory-books/stock-item?${shared}${salesPersonScope}${requestedGroupId ? `&groupId=${encodeURIComponent(requestedGroupId)}` : ""}${requestedCategory ? `&category=${encodeURIComponent(requestedCategory)}` : ""}&itemId=${encodeURIComponent(row.id)}`;
    }

    if (variant === "group") {
      return `/reports/inventory-books/party-details/group?${shared}&groupId=${encodeURIComponent(row.id)}&groupName=${encodeURIComponent(row.name)}`;
    }

    if (variant === "ledger") {
      return `/reports/inventory-books/party-details/voucher?${shared}&ledgerId=${encodeURIComponent(row.id)}&ledgerName=${encodeURIComponent(row.name)}`;
    }

    if (variant === "sales-person") {
      return `/reports/inventory-books/sales-person-details/group?${shared}&salesPersonId=${encodeURIComponent(row.id)}&salesPersonName=${encodeURIComponent(row.name)}`;
    }

    return "";
  }

  // const links = [
  //   { key: "stock-group", label: "Stock Group Analysis" },
  //   { key: "stock-category", label: "Stock Category Analysis" },
  //   { key: "stock-item", label: "Stock Item Analysis" },
  //   { key: "group", label: "Group Analysis" },
  //   { key: "ledger", label: "Ledger Analysis" },
  //   { key: "sales-person", label: "Sales Person Analysis" },
  // ];

  function buildExportColumns() {
    if (isSalesPersonView) {
      return [
        { key: "name", label: "Sales Person", width: 28 },
        { key: "employeeNumber", label: "Employee No.", width: 18 },
        { key: "department", label: "Department", width: 18 },
        { key: "invoices", label: "Invoices", width: 12 },
        { key: "customers", label: "Customers", width: 12 },
        { key: "salesQty", label: "Sales Qty", width: 14 },
        { key: "salesValue", label: "Sales Value", width: 16 },
        { key: "avgInvoice", label: "Avg / Invoice", width: 16 },
        { key: "lastSale", label: "Last Sale", width: 16 },
      ];
    }
    const columns = [{ key: "name", label: "Particulars", width: 34 }];
    if (!hideClosing) {
      columns.push(
        { key: "openingQty", label: "Opening Qty", width: 14 },
        { key: "openingRate", label: "Opening Rate", width: 16 },
        { key: "openingValue", label: "Opening Value", width: 16 },
      );
    }
    columns.push(
      { key: "inwardQty", label: hideClosing ? "Purchase Qty" : "Inward Qty", width: 14 },
      { key: "inwardRate", label: hideClosing ? "Purchase Rate" : "Inward Rate", width: 16 },
      { key: "inwardValue", label: hideClosing ? "Purchase Value" : "Inward Value", width: 16 },
      { key: "outwardQty", label: hideClosing ? "Sales Qty" : "Outward Qty", width: 14 },
      { key: "outwardRate", label: hideClosing ? "Sales Rate" : "Outward Rate", width: 16 },
      { key: "outwardValue", label: hideClosing ? "Sales Value" : "Outward Value", width: 16 },
    );
    if (!hideClosing) {
      columns.push(
        { key: "closingQty", label: "Closing Qty", width: 14 },
        { key: "closingRate", label: "Closing Rate", width: 16 },
        { key: "closingValue", label: "Closing Value", width: 16 },
      );
    }
    return columns;
  }

  function buildExportRows(numeric = false) {
    if (isSalesPersonView) {
      return filteredRows.map((row) => ({
        name: row.name,
        employeeNumber: row.metrics?.employeeNumber || "-",
        department: row.metrics?.department || "-",
        invoices: numeric ? Number(row.metrics?.invoiceCount || 0) : formatQty(row.metrics?.invoiceCount),
        customers: numeric ? Number(row.metrics?.customerCount || 0) : formatQty(row.metrics?.customerCount),
        salesQty: numeric ? Number(row.metrics?.salesQty || 0) : formatQty(row.metrics?.salesQty),
        salesValue: numeric ? Number(row.metrics?.salesValue || 0) : formatCurrencyAmount(row.metrics?.salesValue, selectedCompany),
        avgInvoice: numeric ? Number(row.metrics?.averageValuePerInvoice || 0) : formatCurrencyAmount(row.metrics?.averageValuePerInvoice, selectedCompany),
        lastSale: row.metrics?.lastSaleOn ? new Date(row.metrics.lastSaleOn).toLocaleDateString("en-GB") : "-",
      }));
    }
    return filteredRows.map((row) => {
      const metrics = row.metrics || {};
      const base = { name: row.name };
      if (!hideClosing) {
        base.openingQty = numeric ? Number(metrics.openingQty || 0) : formatQty(metrics.openingQty);
        base.openingRate = numeric ? Number(metrics.openingRate || 0) : formatRate(metrics.openingRate);
        base.openingValue = numeric ? Number(metrics.openingValue || 0) : formatCurrencyAmount(metrics.openingValue, selectedCompany);
      }
      base.inwardQty = numeric ? Number(metrics.inwardQty || 0) : formatQty(metrics.inwardQty);
      base.inwardRate = numeric ? Number(metrics.inwardRate || 0) : formatRate(metrics.inwardRate);
      base.inwardValue = numeric ? Number(metrics.inwardValue || 0) : formatCurrencyAmount(metrics.inwardValue, selectedCompany);
      base.outwardQty = numeric ? Number(metrics.outwardQty || 0) : formatQty(metrics.outwardQty);
      base.outwardRate = numeric ? Number(metrics.outwardRate || 0) : formatRate(metrics.outwardRate);
      base.outwardValue = numeric ? Number(metrics.outwardValue || 0) : formatCurrencyAmount(metrics.outwardValue, selectedCompany);
      if (!hideClosing) {
        base.closingQty = numeric ? Number(metrics.closingQty || 0) : formatQty(metrics.closingQty);
        base.closingRate = numeric ? Number(metrics.closingRate || 0) : formatRate(metrics.closingRate);
        base.closingValue = numeric ? Number(metrics.closingValue || 0) : formatCurrencyAmount(metrics.closingValue, selectedCompany);
      }
      return base;
    });
  }

  function handleExportPdf() {
    const scope = [
      requestedSalesPersonName ? `Sales Person: ${requestedSalesPersonName}` : "",
      requestedGroupName ? `Group: ${requestedGroupName}` : "",
      requestedCategory ? `Category: ${requestedCategory}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    exportInventoryReportPdf({
      title: view.title,
      company: selectedCompany,
      fromDate,
      toDate,
      scope,
      summary: isSalesPersonView
        ? [
            { label: "Sales Qty", value: formatQty(totals.salesQty) },
            { label: "Sales Value", value: formatCurrencyAmount(totals.salesValue, selectedCompany) },
            { label: "Invoices", value: formatQty(totals.invoiceCount) },
            { label: "Customers", value: formatQty(totals.customerCount) },
          ]
        : hideClosing
        ? [
            { label: "Purchase Qty", value: formatQty(totals.inwardQty) },
            { label: "Purchase Value", value: formatCurrencyAmount(totals.inwardValue, selectedCompany) },
            { label: "Sales Qty", value: formatQty(totals.outwardQty) },
            { label: "Sales Value", value: formatCurrencyAmount(totals.outwardValue, selectedCompany) },
          ]
        : [
            { label: "Opening Value", value: formatCurrencyAmount(totals.openingValue, selectedCompany) },
            { label: "Inward Qty", value: formatQty(totals.inwardQty) },
            { label: "Outward Qty", value: formatQty(totals.outwardQty) },
            { label: "Closing Value", value: formatCurrencyAmount(totals.closingValue, selectedCompany) },
          ],
      columns: buildExportColumns(),
      rows: buildExportRows(false),
    });
  }

  function handleExportExcel() {
    const scope = [
      requestedSalesPersonName ? `Sales Person: ${requestedSalesPersonName}` : "",
      requestedGroupName ? `Group: ${requestedGroupName}` : "",
      requestedCategory ? `Category: ${requestedCategory}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    exportInventoryReportExcel({
      title: view.title,
      company: selectedCompany,
      fromDate,
      toDate,
      scope,
      summary: isSalesPersonView
        ? [
            { label: "Sales Qty", value: formatQty(totals.salesQty) },
            { label: "Sales Value", value: formatCurrencyAmount(totals.salesValue, selectedCompany) },
            { label: "Invoices", value: formatQty(totals.invoiceCount) },
            { label: "Customers", value: formatQty(totals.customerCount) },
          ]
        : hideClosing
        ? [
            { label: "Purchase Qty", value: formatQty(totals.inwardQty) },
            { label: "Purchase Value", value: formatCurrencyAmount(totals.inwardValue, selectedCompany) },
            { label: "Sales Qty", value: formatQty(totals.outwardQty) },
            { label: "Sales Value", value: formatCurrencyAmount(totals.outwardValue, selectedCompany) },
          ]
        : [
            { label: "Opening Value", value: formatCurrencyAmount(totals.openingValue, selectedCompany) },
            { label: "Inward Qty", value: formatQty(totals.inwardQty) },
            { label: "Outward Qty", value: formatQty(totals.outwardQty) },
            { label: "Closing Value", value: formatCurrencyAmount(totals.closingValue, selectedCompany) },
          ],
      columns: buildExportColumns(),
      rows: buildExportRows(true),
    });
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1550px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <BarChart3 className="h-3.5 w-3.5" />
                Reports
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Report Analysis</h1>
              <p className="mt-2 text-sm text-slate-500">
                {requestedSalesPersonId
                  ? `Tracking item movement sold by ${requestedSalesPersonName || "the selected sales person"} through group, category, item, and voucher drilldown.`
                  : "Switch between stock, category, party-group, and ledger movement views without leaving inventory books."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  From
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  To
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Search className="h-4 w-4 text-blue-600" />
                  {view.searchLabel}
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={view.searchPlaceholder}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1463ff] px-5 text-[14px] font-medium text-white shadow-sm"
                onClick={handleExportPdf}
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm"
                onClick={handleExportExcel}
              >
                <Download className="h-4 w-4" />
                Export Excel
              </button>
              {/* {links.map((link) => (
                <Link
                  key={link.key}
                  to={`/reports/inventory-books/movement-analysis/${link.key}${
                    requestedSalesPersonId
                      ? `?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&salesPersonId=${encodeURIComponent(requestedSalesPersonId)}&salesPersonName=${encodeURIComponent(requestedSalesPersonName)}`
                      : ""
                  }`}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    link.key === variant
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))} */}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isSalesPersonView ? (
            <>
              <SummaryCard
                title="Sales Qty"
                value={formatQty(totals.salesQty)}
                icon={<TrendingDown className="h-5 w-5" />}
                tone="text-rose-700"
              />
              <SummaryCard
                title="Sales Value"
                value={formatCurrencyAmount(totals.salesValue, selectedCompany)}
                icon={<BarChart3 className="h-5 w-5" />}
                tone="text-blue-700"
              />
              <SummaryCard
                title="Invoices"
                value={formatQty(totals.invoiceCount)}
                icon={<CalendarRange className="h-5 w-5" />}
                tone="text-slate-900"
              />
              <SummaryCard
                title="Customers Served"
                value={formatQty(totals.customerCount)}
                icon={<Search className="h-5 w-5" />}
                tone="text-emerald-700"
              />
            </>
          ) : hideClosing ? (
            <>
              <SummaryCard
                title="Purchase Qty"
                value={formatQty(totals.inwardQty)}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="text-emerald-700"
              />
              <SummaryCard
                title="Purchase Value"
                value={formatCurrencyAmount(totals.inwardValue, selectedCompany)}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="text-emerald-700"
              />
              <SummaryCard
                title="Sales Qty"
                value={formatQty(totals.outwardQty)}
                icon={<TrendingDown className="h-5 w-5" />}
                tone="text-rose-700"
              />
              <SummaryCard
                title="Sales Value"
                value={formatCurrencyAmount(totals.outwardValue, selectedCompany)}
                icon={<TrendingDown className="h-5 w-5" />}
                tone="text-rose-700"
              />
            </>
          ) : (
            <>
              <SummaryCard
                title="Opening Value"
                value={formatCurrencyAmount(totals.openingValue, selectedCompany)}
                icon={<BarChart3 className="h-5 w-5" />}
              />
              <SummaryCard
                title="Total Inward"
                value={formatQty(totals.inwardQty)}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="text-emerald-700"
              />
              <SummaryCard
                title="Total Outward"
                value={formatQty(totals.outwardQty)}
                icon={<TrendingDown className="h-5 w-5" />}
                tone="text-rose-700"
              />
              <SummaryCard
                title="Closing Value"
                value={formatCurrencyAmount(totals.closingValue, selectedCompany)}
                icon={<BarChart3 className="h-5 w-5" />}
                tone="text-blue-700"
              />
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{view.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isSalesPersonView
                ? "Track sales employee performance using saved salesperson selections from sales vouchers."
                : hideClosing
                ? "Purchase and sales movement for the selected analysis view."
                : "Opening, inwards, outwards, and closing balance for the selected analysis view."}
            </p>
          </div>

          <div className="overflow-x-auto">
            {isSalesPersonView ? (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Sales Person</th>
                    <th className="px-4 py-3 text-left font-medium">Employee No.</th>
                    <th className="px-4 py-3 text-left font-medium">Department</th>
                    <th className="px-4 py-3 text-right font-medium">Invoices</th>
                    <th className="px-4 py-3 text-right font-medium">Customers</th>
                    <th className="px-4 py-3 text-right font-medium">Sales Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Sales Value</th>
                    <th className="px-4 py-3 text-right font-medium">Avg / Invoice</th>
                    <th className="px-4 py-3 text-right font-medium">Last Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={`${row.id}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          data-report-nav="true"
                          data-focus-key={`ima-${variant}-${row.id || row.name}`}
                          className="rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          onClick={() => {
                            const nextPath = buildDrillPath(row);
                            if (nextPath) {
                              navigate(nextPath, {
                                state: buildReportReturnState(location, `ima-${variant}-${row.id || row.name}`),
                              });
                            }
                          }}
                        >
                          <p className="font-medium text-slate-900">{row.name}</p>
                          {row.secondaryLabel ? (
                            <p className="mt-0.5 text-xs text-slate-400">{row.secondaryLabel}</p>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.metrics?.employeeNumber || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.metrics?.department || "-"}</td>
                      <td className="px-4 py-3 text-right">{formatQty(row.metrics?.invoiceCount)}</td>
                      <td className="px-4 py-3 text-right">{formatQty(row.metrics?.customerCount)}</td>
                      <td className="px-4 py-3 text-right text-rose-700">{formatQty(row.metrics?.salesQty)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrencyAmount(row.metrics?.salesValue, selectedCompany)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrencyAmount(row.metrics?.averageValuePerInvoice, selectedCompany)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {row.metrics?.lastSaleOn
                          ? new Date(row.metrics.lastSaleOn).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
            <table className={`w-full text-sm ${hideClosing ? "min-w-[940px]" : "min-w-[1480px]"}`}>
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th rowSpan="2" className="px-4 py-3 text-left font-medium">
                    Particulars
                  </th>
                  {!hideClosing ? (
                    <th colSpan="3" className="px-4 py-3 text-center font-medium">
                      Opening
                    </th>
                  ) : null}
                  <th colSpan="3" className="px-4 py-3 text-center font-medium">
                    {hideClosing ? "Purchase" : "Inwards"}
                  </th>
                  <th colSpan="3" className="px-4 py-3 text-center font-medium">
                    {hideClosing ? "Sales" : "Outwards"}
                  </th>
                  {!hideClosing ? (
                    <th colSpan="3" className="px-4 py-3 text-center font-medium">
                      Closing Balance
                    </th>
                  ) : null}
                </tr>
                <tr>
                  {Array.from({ length: hideClosing ? 2 : 4 })
                    .flatMap(() => ["Quantity", "Rate", "Value"])
                    .map((label, index) => (
                    <th key={`${label}-${index}`} className="px-4 py-3 text-right font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const metrics = row.metrics || {};
                  return (
                    <tr key={`${row.id}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          data-report-nav="true"
                          data-focus-key={`ima-${variant}-${row.id || row.name}`}
                          className="rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          onClick={() => {
                            const nextPath = buildDrillPath(row);
                            if (nextPath) {
                              navigate(nextPath, {
                                state: buildReportReturnState(location, `ima-${variant}-${row.id || row.name}`),
                              });
                            }
                          }}
                        >
                          <p className="font-medium text-slate-900">{row.name}</p>
                          {row.secondaryLabel ? (
                            <p className="mt-0.5 text-xs text-slate-400">{row.secondaryLabel}</p>
                          ) : null}
                        </button>
                      </td>
                      {!hideClosing ? (
                        <>
                          <td className="px-4 py-3 text-right">{formatQty(metrics.openingQty)}</td>
                          <td className="px-4 py-3 text-right">{formatRate(metrics.openingRate)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrencyAmount(metrics.openingValue, selectedCompany)}</td>
                        </>
                      ) : null}
                      <td className="px-4 py-3 text-right text-emerald-700">{formatQty(metrics.inwardQty)}</td>
                      <td className="px-4 py-3 text-right">{formatRate(metrics.inwardRate)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(metrics.inwardValue, selectedCompany)}</td>
                      <td className="px-4 py-3 text-right text-rose-700">{formatQty(metrics.outwardQty)}</td>
                      <td className="px-4 py-3 text-right">{formatRate(metrics.outwardRate)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrencyAmount(metrics.outwardValue, selectedCompany)}</td>
                      {!hideClosing ? (
                        <>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQty(metrics.closingQty)}</td>
                          <td className="px-4 py-3 text-right">{formatRate(metrics.closingRate)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrencyAmount(metrics.closingValue, selectedCompany)}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">Loading movement analysis...</div>
          ) : filteredRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No rows matched this movement analysis search.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
