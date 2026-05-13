import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, PackageSearch } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
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

export default function StockItemDetailPage() {
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
    if (!query) return scopedRows;
    return scopedRows.filter(
      (row) =>
        row.itemName?.toLowerCase().includes(query) ||
        row.alias?.toLowerCase().includes(query) ||
        row.groupName?.toLowerCase().includes(query) ||
        row.stockCategoryName?.toLowerCase().includes(query)
    );
  }, [report.rows, requestedCategory, requestedGroupId, requestedItemId, search]);
  const selectedItemRow = useMemo(
    () => (requestedItemId ? filteredRows.find((row) => String(row.itemId) === String(requestedItemId)) : null),
    [filteredRows, requestedItemId],
  );
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

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Stock Item Details</h1>
              <p className="mt-2 text-sm text-slate-500">
                {requestedItemId
                  ? requestedSalesPersonId
                    ? `Voucher-wise sales register for ${requestedSalesPersonName || "the selected sales person"} and the selected item. Press Esc to step back.`
                    : "Voucher-wise movement register for the selected stock item. Press Esc to step back."
                  : requestedSalesPersonId
                  ? `Review item-wise sales for ${requestedSalesPersonName || "the selected sales person"} without expanding rows inline.`
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
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Opening Value</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrencyAmount(report.totals?.openingValue, selectedCompany)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Inward Value</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatCurrencyAmount(report.totals?.inwardValue, selectedCompany)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Outward Value</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">
              {formatCurrencyAmount(report.totals?.outwardValue, selectedCompany)}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">Closing Value</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">
              {formatCurrencyAmount(report.totals?.closingValue, selectedCompany)}
            </p>
          </article>
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
                <table className="min-w-[1700px] text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium" rowSpan={2}>Item</th>
                      <th className="px-4 py-3 font-medium" rowSpan={2}>Group</th>
                      <th className="px-4 py-3 text-center font-medium" colSpan={3}>Opening</th>
                      <th className="px-4 py-3 text-center font-medium" colSpan={3}>Inwards</th>
                      <th className="px-4 py-3 text-center font-medium" colSpan={3}>Outwards</th>
                      <th className="px-4 py-3 text-center font-medium" colSpan={3}>Closing</th>
                    </tr>
                    <tr>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
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
                                    `/reports/inventory-books/stock-item?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}${requestedSalesPersonId ? `&salesPersonId=${encodeURIComponent(requestedSalesPersonId)}&salesPersonName=${encodeURIComponent(requestedSalesPersonName)}` : ""}${requestedGroupId ? `&groupId=${encodeURIComponent(requestedGroupId)}` : ""}${requestedCategory ? `&category=${encodeURIComponent(requestedCategory)}` : ""}&itemId=${encodeURIComponent(row.itemId)}`,
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
                        <td className="px-4 py-3 text-right">{formatNumber(row.openingQty)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.openingRate, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.openingValue, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{formatNumber(row.inwardQty)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{formatCurrencyAmount(row.inwardRate, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{formatCurrencyAmount(row.inwardValue, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{formatNumber(row.outwardQty)}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{formatCurrencyAmount(row.outwardRate, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{formatCurrencyAmount(row.outwardValue, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(row.closingQty)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrencyAmount(row.closingRate, selectedCompany)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrencyAmount(row.closingValue, selectedCompany)}</td>
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
                      <table className="min-w-[980px] text-sm">
                        <thead className="bg-slate-50 text-left text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Voucher</th>
                            <th className="px-3 py-2 font-medium">Direction</th>
                            <th className="px-3 py-2 text-right font-medium">Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Rate</th>
                            <th className="px-3 py-2 text-right font-medium">Value</th>
                            <th className="px-3 py-2 text-right font-medium">Closing Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Closing Value</th>
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
                              <td className="px-3 py-2 text-right">{formatNumber(entry.closingQty)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrencyAmount(entry.closingValue, selectedCompany)}</td>
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
