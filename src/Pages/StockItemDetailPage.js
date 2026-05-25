import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, Download, PackageSearch } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import { exportInventoryReportExcel, exportInventoryReportPdf } from "../utils/inventoryReportExport";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import {
  buildReportReturnState,
  navigateBackFromReport,
} from "../utils/reportNavigation";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const NET_PURCHASE_QTY = "Net Purchase / Inward Qty";
const NET_PURCHASE_RATE = "Net Purchase / Inward Rate";
const NET_PURCHASE_VALUE = "Net Purchase / Inward Value";
const NET_SALES_QTY = "Net Sales / Outward Qty";
const NET_SALES_RATE = "Net Sales / Outward Rate";
const NET_SALES_VALUE = "Net Sales / Outward Value";

export default function StockItemDetailPage({ partyMovementMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || today);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [report, setReport] = useState({ rows: [], totals: {} });
  const requestedItemId = searchParams.get("itemId") || "";
  const requestedGroupId = searchParams.get("groupId") || "";
  const requestedCategory = searchParams.get("category") || "";
  const requestedSalesPersonId = searchParams.get("salesPersonId") || "";
  const requestedSalesPersonName = searchParams.get("salesPersonName") || "";
  const requestedPartyGroupId = searchParams.get("partyGroupId") || "";
  const requestedPartyGroupName = searchParams.get("partyGroupName") || "";
  const requestedPartyLedgerId = searchParams.get("partyLedgerId") || "";
  const requestedPartyLedgerName = searchParams.get("partyLedgerName") || "";
  const requestedCompanyId = searchParams.get("companyId") || "";

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || requestedCompanyId || response.data[0]._id);
      }
    }

    loadCompanies();
  }, [requestedCompanyId]);

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      const response = await api.get(
        `/companies/${companyId}/reports/stock-item-detailed`,
        {
          params: {
            from: fromDate,
            to: toDate,
            salesPersonId: requestedSalesPersonId,
            groupId: requestedGroupId,
            category: requestedCategory,
            itemId: requestedItemId,
            partyGroupId: requestedPartyGroupId,
            partyLedgerId: requestedPartyLedgerId,
          },
        }
      );
      setReport(response.data);
    }

    loadReport();
  }, [
    companyId,
    fromDate,
    toDate,
    requestedSalesPersonId,
    requestedGroupId,
    requestedCategory,
    requestedItemId,
    requestedPartyGroupId,
    requestedPartyLedgerId,
  ]);

  const selectedCompany = companies.find((company) => company._id === companyId);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const baseRows = report.rows || [];
    const scopedRows = baseRows.filter((row) => {
      if (requestedItemId && String(row.itemId) !== String(requestedItemId)) return false;
      if (requestedGroupId && String(row.groupId || "") !== String(requestedGroupId)) return false;
      if (
        requestedCategory &&
        String(row.stockCategoryName || "")
          .toLowerCase()
          .trim() !== String(requestedCategory).toLowerCase().trim()
      ) {
        return false;
      }
      return true;
    });
    const relevantRows = partyMovementMode
      ? scopedRows.filter((row) => {
          const inwardQty = Number(row.inwardQty || 0);
          const inwardValue = Number(row.inwardValue || 0);
          const outwardQty = Number(row.outwardQty || 0);
          const outwardValue = Number(row.outwardValue || 0);
          return inwardQty !== 0 || inwardValue !== 0 || outwardQty !== 0 || outwardValue !== 0;
        })
      : scopedRows;
    if (!query) return relevantRows;
    return relevantRows.filter(
      (row) =>
        row.itemName?.toLowerCase().includes(query) ||
        row.alias?.toLowerCase().includes(query) ||
        row.groupName?.toLowerCase().includes(query) ||
        row.stockCategoryName?.toLowerCase().includes(query)
    );
  }, [partyMovementMode, report.rows, requestedCategory, requestedGroupId, requestedItemId, search]);
  const selectedItemRow = useMemo(
    () => (requestedItemId ? filteredRows.find((row) => String(row.itemId) === String(requestedItemId)) : null),
    [filteredRows, requestedItemId],
  );
  const totals = useMemo(() => {
    if (requestedItemId && selectedItemRow) {
      const openingValue = Number(selectedItemRow.openingValue || 0);
      const inwardValue = Number(selectedItemRow.inwardValue || 0);
      const closingValue = Number(selectedItemRow.closingValue || 0);
      return {
        openingValue,
        inwardValue,
        outwardValue: openingValue + inwardValue - closingValue,
        closingValue,
      };
    }

    return filteredRows.reduce(
      (sum, row) => {
        sum.openingValue += Number(row.openingValue || 0);
        sum.inwardValue += Number(row.inwardValue || 0);
        sum.outwardValue += Number(row.outwardValue || 0);
        sum.closingValue += Number(row.closingValue || 0);
        return sum;
      },
      { openingValue: 0, inwardValue: 0, outwardValue: 0, closingValue: 0 },
    );
  }, [filteredRows, requestedItemId, selectedItemRow]);
  useReportFocusRestore(containerRef, [
    filteredRows,
    companyId,
    fromDate,
    toDate,
    requestedItemId,
    requestedSalesPersonId,
  ]);
  useReportKeyboardNav(containerRef, [
    filteredRows,
    companyId,
    fromDate,
    toDate,
    requestedItemId,
    requestedSalesPersonId,
  ], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function handleExportPdf() {
    const title = requestedItemId ? `${selectedItemRow?.itemName || "Stock Item"} Register` : "Stock Item Register";
    const scopeParts = [];
    if (requestedSalesPersonName) scopeParts.push(`Sales Person: ${requestedSalesPersonName}`);
    if (requestedGroupId) scopeParts.push(`Group filtered`);
    if (requestedCategory) scopeParts.push(`Category: ${requestedCategory}`);
    if (requestedPartyGroupName) scopeParts.push(`Party Group: ${requestedPartyGroupName}`);
    if (requestedPartyLedgerName) scopeParts.push(`Ledger: ${requestedPartyLedgerName}`);
    if (requestedItemId && selectedItemRow?.itemName) scopeParts.push(`Item: ${selectedItemRow.itemName}`);
    exportInventoryReportPdf({
      title,
      company: selectedCompany,
      fromDate,
      toDate,
      scope: scopeParts.join(" | "),
      summary: [
        { label: NET_PURCHASE_VALUE, value: formatCurrencyAmount(totals.inwardValue, selectedCompany) },
        { label: NET_SALES_VALUE, value: formatCurrencyAmount(totals.outwardValue, selectedCompany) },
        ...(partyMovementMode
          ? []
          : [{ label: "Opening Value", value: formatCurrencyAmount(totals.openingValue, selectedCompany) }]),
        ...(partyMovementMode
          ? []
          : [{ label: "Closing Value", value: formatCurrencyAmount(totals.closingValue, selectedCompany) }]),
      ],
      columns: requestedItemId
        ? [
            { key: "date", label: "Date", width: 18 },
            { key: "voucher", label: "Voucher", width: 20 },
            { key: "direction", label: "Direction", width: 14 },
            { key: "qty", label: "Qty", width: 12 },
            { key: "rate", label: "Rate", width: 14 },
            { key: "value", label: "Value", width: 16 },
            ...(partyMovementMode ? [] : [
              { key: "closingQty", label: "Closing Qty", width: 14 },
              { key: "closingValue", label: "Closing Value", width: 16 },
            ]),
          ]
        : [
            { key: "item", label: "Item", width: 34 },
            { key: "group", label: "Group", width: 24 },
            ...(partyMovementMode ? [] : [
              { key: "openingQty", label: "Opening Qty", width: 14 },
              { key: "openingRate", label: "Opening Rate", width: 16 },
              { key: "openingValue", label: "Opening Value", width: 16 },
            ]),
            { key: "inwardQty", label: NET_PURCHASE_QTY, width: 14 },
            { key: "inwardRate", label: NET_PURCHASE_RATE, width: 16 },
            { key: "inwardValue", label: NET_PURCHASE_VALUE, width: 16 },
            { key: "outwardQty", label: NET_SALES_QTY, width: 14 },
            { key: "outwardRate", label: NET_SALES_RATE, width: 16 },
            { key: "outwardValue", label: NET_SALES_VALUE, width: 16 },
            ...(partyMovementMode ? [] : [
              { key: "closingQty", label: "Closing Qty", width: 14 },
              { key: "closingRate", label: "Closing Rate", width: 16 },
              { key: "closingValue", label: "Closing Value", width: 16 },
            ]),
          ],
      rows: requestedItemId
        ? (selectedItemRow?.history || []).map((entry) => ({
            date: entry.dateLabel,
            voucher: entry.voucherName,
            direction: entry.direction,
            qty: formatNumber(entry.qty),
            rate: formatCurrencyAmount(entry.rate, selectedCompany),
            value: formatCurrencyAmount(entry.value, selectedCompany),
            ...(partyMovementMode
              ? {}
              : {
                  closingQty: formatNumber(entry.closingQty),
                  closingValue: formatCurrencyAmount(entry.closingValue, selectedCompany),
                }),
          }))
        : filteredRows.map((row) => ({
            item: row.itemName,
            group: row.groupName || "-",
            ...(partyMovementMode
              ? {}
              : {
                  openingQty: formatNumber(row.openingQty),
                  openingRate: formatCurrencyAmount(row.openingRate, selectedCompany),
                  openingValue: formatCurrencyAmount(row.openingValue, selectedCompany),
                }),
            inwardQty: formatNumber(row.inwardQty),
            inwardRate: formatCurrencyAmount(row.inwardRate, selectedCompany),
            inwardValue: formatCurrencyAmount(row.inwardValue, selectedCompany),
            outwardQty: formatNumber(row.outwardQty),
            outwardRate: formatCurrencyAmount(row.outwardRate, selectedCompany),
            outwardValue: formatCurrencyAmount(row.outwardValue, selectedCompany),
            ...(partyMovementMode
              ? {}
              : {
                  closingQty: formatNumber(row.closingQty),
                  closingRate: formatCurrencyAmount(row.closingRate, selectedCompany),
                  closingValue: formatCurrencyAmount(row.closingValue, selectedCompany),
                }),
          })),
    });
  }

  function handleExportExcel() {
    const title = requestedItemId ? `${selectedItemRow?.itemName || "Stock Item"} Register` : "Stock Item Register";
    const scopeParts = [];
    if (requestedSalesPersonName) scopeParts.push(`Sales Person: ${requestedSalesPersonName}`);
    if (requestedGroupId) scopeParts.push(`Group filtered`);
    if (requestedCategory) scopeParts.push(`Category: ${requestedCategory}`);
    if (requestedPartyGroupName) scopeParts.push(`Party Group: ${requestedPartyGroupName}`);
    if (requestedPartyLedgerName) scopeParts.push(`Ledger: ${requestedPartyLedgerName}`);
    if (requestedItemId && selectedItemRow?.itemName) scopeParts.push(`Item: ${selectedItemRow.itemName}`);
    exportInventoryReportExcel({
      title,
      company: selectedCompany,
      fromDate,
      toDate,
      scope: scopeParts.join(" | "),
      summary: [
        { label: NET_PURCHASE_VALUE, value: formatCurrencyAmount(totals.inwardValue, selectedCompany) },
        { label: NET_SALES_VALUE, value: formatCurrencyAmount(totals.outwardValue, selectedCompany) },
        ...(partyMovementMode
          ? []
          : [{ label: "Opening Value", value: formatCurrencyAmount(totals.openingValue, selectedCompany) }]),
        ...(partyMovementMode
          ? []
          : [{ label: "Closing Value", value: formatCurrencyAmount(totals.closingValue, selectedCompany) }]),
      ],
      columns: requestedItemId
        ? [
            { key: "date", label: "Date", width: 18 },
            { key: "voucher", label: "Voucher", width: 20 },
            { key: "direction", label: "Direction", width: 14 },
            { key: "qty", label: "Qty", width: 12 },
            { key: "rate", label: "Rate", width: 14 },
            { key: "value", label: "Value", width: 16 },
            ...(partyMovementMode ? [] : [
              { key: "closingQty", label: "Closing Qty", width: 14 },
              { key: "closingValue", label: "Closing Value", width: 16 },
            ]),
          ]
        : [
            { key: "item", label: "Item", width: 34 },
            { key: "group", label: "Group", width: 24 },
            ...(partyMovementMode ? [] : [
              { key: "openingQty", label: "Opening Qty", width: 14 },
              { key: "openingRate", label: "Opening Rate", width: 16 },
              { key: "openingValue", label: "Opening Value", width: 16 },
            ]),
            { key: "inwardQty", label: NET_PURCHASE_QTY, width: 14 },
            { key: "inwardRate", label: NET_PURCHASE_RATE, width: 16 },
            { key: "inwardValue", label: NET_PURCHASE_VALUE, width: 16 },
            { key: "outwardQty", label: NET_SALES_QTY, width: 14 },
            { key: "outwardRate", label: NET_SALES_RATE, width: 16 },
            { key: "outwardValue", label: NET_SALES_VALUE, width: 16 },
            ...(partyMovementMode ? [] : [
              { key: "closingQty", label: "Closing Qty", width: 14 },
              { key: "closingRate", label: "Closing Rate", width: 16 },
              { key: "closingValue", label: "Closing Value", width: 16 },
            ]),
          ],
      rows: requestedItemId
        ? (selectedItemRow?.history || []).map((entry) => ({
            date: entry.dateLabel,
            voucher: entry.voucherName,
            direction: entry.direction,
            qty: Number(entry.qty || 0),
            rate: Number(entry.rate || 0),
            value: Number(entry.value || 0),
            ...(partyMovementMode
              ? {}
              : {
                  closingQty: Number(entry.closingQty || 0),
                  closingValue: Number(entry.closingValue || 0),
                }),
          }))
        : filteredRows.map((row) => ({
            item: row.itemName,
            group: row.groupName || "-",
            ...(partyMovementMode
              ? {}
              : {
                  openingQty: Number(row.openingQty || 0),
                  openingRate: Number(row.openingRate || 0),
                  openingValue: Number(row.openingValue || 0),
                }),
            inwardQty: Number(row.inwardQty || 0),
            inwardRate: Number(row.inwardRate || 0),
            inwardValue: Number(row.inwardValue || 0),
            outwardQty: Number(row.outwardQty || 0),
            outwardRate: Number(row.outwardRate || 0),
            outwardValue: Number(row.outwardValue || 0),
            ...(partyMovementMode
              ? {}
              : {
                  closingQty: Number(row.closingQty || 0),
                  closingRate: Number(row.closingRate || 0),
                  closingValue: Number(row.closingValue || 0),
                }),
          })),
    });
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-8xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Stock Item Details</h1>
              <p className="mt-2 text-sm text-slate-500">
                {partyMovementMode
                  ? requestedItemId
                    ? `Voucher-wise movement for the selected item under ${requestedPartyLedgerName || requestedPartyGroupName || "the selected ledger"}. Press Esc to step back.`
                    : `Review only the items moved under ${requestedPartyLedgerName || requestedPartyGroupName || "the selected ledger or group"}.`
                  : requestedItemId
                  ? requestedSalesPersonId
                    ? `Voucher-wise sales register for ${requestedSalesPersonName || "the selected sales person"} and the selected item. Press Esc to step back.`
                    : requestedPartyLedgerName
                    ? `Voucher-wise item movement for ${requestedPartyLedgerName}. Press Esc to step back.`
                    : "Voucher-wise movement register for the selected stock item. Press Esc to step back."
                  : requestedSalesPersonId
                  ? `Review item-wise sales for ${requestedSalesPersonName || "the selected sales person"} without expanding rows inline.`
                  : requestedPartyLedgerName
                  ? `Review item-wise stock movement for ${requestedPartyLedgerName}.`
                  : requestedPartyGroupName
                  ? `Review item-wise stock movement for ${requestedPartyGroupName}.`
                  : "Review item-wise opening, inward, outward, and closing stock without expanding rows inline."}
              </p>
              {requestedItemId ? (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
                  onClick={() => navigateBackFromReport(navigate, location)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <PackageSearch className="h-4 w-4 text-blue-600" />
                  Find Item
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Search item, alias, or group..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  From
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
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
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
              <div className="xl:col-span-2 flex flex-wrap items-center gap-3">
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
              </div>
            </div>
          </div>
        </section>

        <section className={`grid gap-4 md:grid-cols-2 ${partyMovementMode ? "xl:grid-cols-2" : "xl:grid-cols-4"}`}>
          {!partyMovementMode ? (
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-500">Opening Value</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrencyAmount(totals.openingValue, selectedCompany)}
              </p>
            </article>
          ) : null}
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">{NET_PURCHASE_VALUE}</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatCurrencyAmount(totals.inwardValue, selectedCompany)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">{NET_SALES_VALUE}</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">
              {formatCurrencyAmount(totals.outwardValue, selectedCompany)}
            </p>
          </article>
          {!partyMovementMode ? (
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-500">Closing Value</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                {formatCurrencyAmount(totals.closingValue, selectedCompany)}
              </p>
            </article>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {requestedItemId ? "Detailed Stock Item Register" : "Stock Item Register"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {!requestedItemId ? (
              <>
                <table className={`text-sm ${partyMovementMode ? "min-w-[1220px]" : "min-w-[1700px]"}`}>
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium" rowSpan={2}>Item</th>
                      <th className="px-4 py-3 font-medium" rowSpan={2}>Group</th>
                      {!partyMovementMode ? (
                        <th className="px-4 py-3 text-center font-medium" colSpan={3}>Opening</th>
                      ) : null}
                      <th className="px-4 py-3 text-center font-medium" colSpan={3}>Inwards</th>
                      <th className="px-4 py-3 text-center font-medium" colSpan={3}>Outwards</th>
                      {!partyMovementMode ? (
                        <th className="px-4 py-3 text-center font-medium" colSpan={3}>Closing</th>
                      ) : null}
                    </tr>
                    <tr>
                      {!partyMovementMode ? (
                        <>
                          <th className="px-4 py-3 text-right font-medium">Qty</th>
                          <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                        </>
                      ) : null}
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      {!partyMovementMode ? (
                        <>
                          <th className="px-4 py-3 text-right font-medium">Qty</th>
                          <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.itemId} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <button
                            type="button"
                            data-report-nav="true"
                            data-focus-key={`sid-item-${row.itemId}`}
                            className="rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                              onClick={() =>
                                navigate(
                                    `${partyMovementMode ? "/reports/inventory-books/party-item-movement" : "/reports/inventory-books/stock-item"}?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}${requestedSalesPersonId ? `&salesPersonId=${encodeURIComponent(requestedSalesPersonId)}&salesPersonName=${encodeURIComponent(requestedSalesPersonName)}` : ""}${requestedGroupId ? `&groupId=${encodeURIComponent(requestedGroupId)}` : ""}${requestedCategory ? `&category=${encodeURIComponent(requestedCategory)}` : ""}${requestedPartyGroupId ? `&partyGroupId=${encodeURIComponent(requestedPartyGroupId)}&partyGroupName=${encodeURIComponent(requestedPartyGroupName)}` : ""}${requestedPartyLedgerId ? `&partyLedgerId=${encodeURIComponent(requestedPartyLedgerId)}&partyLedgerName=${encodeURIComponent(requestedPartyLedgerName)}` : ""}&itemId=${encodeURIComponent(row.itemId)}`,
                                    {
                                      state: buildReportReturnState(location, `sid-item-${row.itemId}`),
                                    },
                              )
                            }
                          >
                            {row.itemName}
                            {row.alias ? (
                              <span className="ml-2 text-xs font-normal text-slate-400">{row.alias}</span>
                            ) : null}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{row.groupName || "-"}</td>
                        {!partyMovementMode ? (
                          <>
                            <td className="px-4 py-3 text-right">{formatNumber(row.openingQty)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.openingRate, selectedCompany)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.openingValue, selectedCompany)}</td>
                          </>
                        ) : null}
                        <td className="px-4 py-3 text-right text-emerald-700">{formatNumber(row.inwardQty)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{formatCurrencyAmount(row.inwardRate, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{formatCurrencyAmount(row.inwardValue, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{formatNumber(row.outwardQty)}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{formatCurrencyAmount(row.outwardRate, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{formatCurrencyAmount(row.outwardValue, selectedCompany)}</td>
                        {!partyMovementMode ? (
                          <>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(row.closingQty)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.closingRate, selectedCompany)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrencyAmount(row.closingValue, selectedCompany)}</td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRows.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No stock items matched this view.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-4">
                {selectedItemRow ? (
                  <div className="rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{selectedItemRow.itemName}</p>
                        <p className="mt-1 text-sm text-slate-500">{selectedItemRow.groupName || "-"}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className={`text-sm ${partyMovementMode ? "min-w-[760px]" : "min-w-[980px]"}`}>
                        <thead className="bg-slate-50 text-left text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Voucher</th>
                            <th className="px-3 py-2 font-medium">Direction</th>
                            <th className="px-3 py-2 text-right font-medium">Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Rate</th>
                            <th className="px-3 py-2 text-right font-medium">Value</th>
                            {!partyMovementMode ? (
                              <>
                                <th className="px-3 py-2 text-right font-medium">Closing Qty</th>
                                <th className="px-3 py-2 text-right font-medium">Closing Value</th>
                              </>
                            ) : null}
                            <th className="px-3 py-2 text-right font-medium">Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedItemRow.history || []).map((entry, index) => (
                            <tr key={`${selectedItemRow.itemId}-${entry.voucherId}-${index}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{entry.dateLabel}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{entry.voucherName}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    entry.direction === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                  }`}
                                >
                                  {entry.direction}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">{formatNumber(entry.qty)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrencyAmount(entry.rate, selectedCompany)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrencyAmount(entry.value, selectedCompany)}</td>
                              {!partyMovementMode ? (
                                <>
                                  <td className="px-3 py-2 text-right">{formatNumber(entry.closingQty)}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrencyAmount(entry.closingValue, selectedCompany)}</td>
                                </>
                              ) : null}
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  data-report-nav="true"
                                  data-focus-key={`sid-history-${selectedItemRow.itemId}-${index}`}
                                  className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                  onClick={() =>
                                    navigate(buildAlterVoucherPath(companyId, entry.voucherId), {
                                      state: buildReportReturnState(location, `sid-history-${selectedItemRow.itemId}-${index}`),
                                    })
                                  }
                                >
                                  Alter
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(selectedItemRow.history || []).length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">
                          No stock movement found for this item in the selected period.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No stock item matched this selection.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
