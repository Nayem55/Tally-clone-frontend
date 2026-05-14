import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, Download, PackageSearch } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { exportInventoryReportExcel, exportInventoryReportPdf } from "../utils/inventoryReportExport";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RawMaterialSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const today = formatLocalDateInput(new Date());
  const monthStart = formatLocalDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const { companyId } = useActiveCompany();
  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || today);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [report, setReport] = useState({ rows: [], totals: {} });
  const requestedItemId = searchParams.get("itemId") || "";

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/reports/raw-material-summary`, {
        params: { from: fromDate, to: toDate },
      });
      setReport(response.data || { rows: [], totals: {} });
    }

    loadReport();
  }, [companyId, fromDate, toDate, location.key]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoped = (report.rows || []).filter((row) =>
      requestedItemId ? String(row.itemId) === String(requestedItemId) : true,
    );
    if (!query) return scoped;
    return scoped.filter((row) =>
      [row.itemName, row.alias, row.groupName].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(query),
      ),
    );
  }, [report.rows, requestedItemId, search]);

  const selectedItem = useMemo(
    () => (requestedItemId ? filteredRows.find((row) => String(row.itemId) === String(requestedItemId)) : null),
    [filteredRows, requestedItemId],
  );

  useReportFocusRestore(containerRef, [filteredRows, companyId, fromDate, toDate, requestedItemId]);
  useReportKeyboardNav(containerRef, [filteredRows, companyId, fromDate, toDate, requestedItemId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function handleExportPdf() {
    exportInventoryReportPdf({
      title: requestedItemId ? `${selectedItem?.itemName || "Raw Material"} Movement Register` : "Raw Material Summary",
      company: { name: companyId || "-" },
      fromDate,
      toDate,
      scope: requestedItemId && selectedItem ? `Raw Material: ${selectedItem.itemName}` : "",
      summary: [
        { label: "Opening Value", value: formatNumber(report.totals?.openingValue) },
        { label: "Inward Value", value: formatNumber(report.totals?.inwardValue) },
        { label: "Consumed Value", value: formatNumber(report.totals?.outwardValue) },
        { label: "Closing Value", value: formatNumber(report.totals?.closingValue) },
      ],
      columns: requestedItemId
        ? [
            { key: "date", label: "Date", width: 18 },
            { key: "voucher", label: "Voucher", width: 18 },
            { key: "direction", label: "Direction", width: 14 },
            { key: "qty", label: "Qty", width: 12 },
            { key: "rate", label: "Rate", width: 14 },
            { key: "value", label: "Value", width: 14 },
            { key: "closingQty", label: "Closing Qty", width: 14 },
            { key: "closingValue", label: "Closing Value", width: 16 },
          ]
        : [
            { key: "itemName", label: "Raw Material", width: 34 },
            { key: "groupName", label: "Group", width: 24 },
            { key: "openingQty", label: "Opening Qty", width: 14 },
            { key: "inwardQty", label: "Inward Qty", width: 14 },
            { key: "consumedQty", label: "Consumed Qty", width: 14 },
            { key: "closingQty", label: "Closing Qty", width: 14 },
            { key: "closingRate", label: "Closing Rate", width: 14 },
            { key: "closingValue", label: "Closing Value", width: 16 },
          ],
      rows: requestedItemId
        ? (selectedItem?.history || []).map((entry) => ({
            date: entry.dateLabel,
            voucher: entry.voucherName,
            direction: entry.direction,
            qty: formatNumber(entry.qty),
            rate: formatNumber(entry.rate),
            value: formatNumber(entry.value),
            closingQty: formatNumber(entry.closingQty),
            closingValue: formatNumber(entry.closingValue),
          }))
        : filteredRows.map((row) => ({
            itemName: row.itemName,
            groupName: row.groupName || "-",
            openingQty: formatNumber(row.openingQty),
            inwardQty: formatNumber(row.inwardQty),
            consumedQty: formatNumber(row.outwardQty),
            closingQty: formatNumber(row.closingQty),
            closingRate: formatNumber(row.closingRate),
            closingValue: formatNumber(row.closingValue),
          })),
    });
  }

  function handleExportExcel() {
    exportInventoryReportExcel({
      title: requestedItemId ? `${selectedItem?.itemName || "Raw Material"} Movement Register` : "Raw Material Summary",
      company: { name: companyId || "-" },
      fromDate,
      toDate,
      scope: requestedItemId && selectedItem ? `Raw Material: ${selectedItem.itemName}` : "",
      summary: [
        { label: "Opening Value", value: formatNumber(report.totals?.openingValue) },
        { label: "Inward Value", value: formatNumber(report.totals?.inwardValue) },
        { label: "Consumed Value", value: formatNumber(report.totals?.outwardValue) },
        { label: "Closing Value", value: formatNumber(report.totals?.closingValue) },
      ],
      columns: requestedItemId
        ? [
            { key: "date", label: "Date", width: 18 },
            { key: "voucher", label: "Voucher", width: 18 },
            { key: "direction", label: "Direction", width: 14 },
            { key: "qty", label: "Qty", width: 12 },
            { key: "rate", label: "Rate", width: 14 },
            { key: "value", label: "Value", width: 14 },
            { key: "closingQty", label: "Closing Qty", width: 14 },
            { key: "closingValue", label: "Closing Value", width: 16 },
          ]
        : [
            { key: "itemName", label: "Raw Material", width: 34 },
            { key: "groupName", label: "Group", width: 24 },
            { key: "openingQty", label: "Opening Qty", width: 14 },
            { key: "inwardQty", label: "Inward Qty", width: 14 },
            { key: "consumedQty", label: "Consumed Qty", width: 14 },
            { key: "closingQty", label: "Closing Qty", width: 14 },
            { key: "closingRate", label: "Closing Rate", width: 14 },
            { key: "closingValue", label: "Closing Value", width: 16 },
          ],
      rows: requestedItemId
        ? (selectedItem?.history || []).map((entry) => ({
            date: entry.dateLabel,
            voucher: entry.voucherName,
            direction: entry.direction,
            qty: Number(entry.qty || 0),
            rate: Number(entry.rate || 0),
            value: Number(entry.value || 0),
            closingQty: Number(entry.closingQty || 0),
            closingValue: Number(entry.closingValue || 0),
          }))
        : filteredRows.map((row) => ({
            itemName: row.itemName,
            groupName: row.groupName || "-",
            openingQty: Number(row.openingQty || 0),
            inwardQty: Number(row.inwardQty || 0),
            consumedQty: Number(row.outwardQty || 0),
            closingQty: Number(row.closingQty || 0),
            closingRate: Number(row.closingRate || 0),
            closingValue: Number(row.closingValue || 0),
          })),
    });
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Raw Material Summary</h1>
              <p className="mt-2 text-sm text-slate-500">
                Keep component stock separate from finished goods and drill to the exact source vouchers when you need to alter raw material movement.
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
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  From
                </label>
                <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  To
                </label>
                <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <PackageSearch className="h-4 w-4 text-blue-600" />
                  Search Raw Material
                </label>
                <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="md:col-span-3 flex flex-wrap items-center gap-3">
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

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Opening Value</p><p className="mt-2 text-2xl font-bold text-slate-900">{Number(report.totals?.openingValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Inward Value</p><p className="mt-2 text-2xl font-bold text-emerald-700">{Number(report.totals?.inwardValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Consumed Value</p><p className="mt-2 text-2xl font-bold text-rose-700">{Number(report.totals?.outwardValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">Closing Value</p><p className="mt-2 text-2xl font-bold text-blue-700">{Number(report.totals?.closingValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></article>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{requestedItemId ? "Raw Material Movement Register" : "Raw Material Register"}</h2>
          </div>
          <div className="overflow-x-auto">
            {!requestedItemId ? (
              <table className="min-w-[1180px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Raw Material</th>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-4 py-3 text-right font-medium">Opening Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Inward Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Consumed Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Closing Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Closing Rate</th>
                    <th className="px-4 py-3 text-right font-medium">Closing Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.itemId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <button
                          type="button"
                          data-report-nav="true"
                          data-focus-key={`rm-item-${row.itemId}`}
                          className="rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          onClick={() =>
                            navigate(
                              `/reports/inventory-books/raw-material-summary?itemId=${encodeURIComponent(row.itemId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`,
                              { state: buildReportReturnState(location, `rm-item-${row.itemId}`) },
                            )
                          }
                        >
                          {row.itemName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.groupName || "-"}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(row.openingQty)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatNumber(row.inwardQty)}</td>
                      <td className="px-4 py-3 text-right text-rose-700">{formatNumber(row.outwardQty)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(row.closingQty)}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(row.closingRate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(row.closingValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                {selectedItem ? (
                  <div className="rounded-2xl border border-slate-200 bg-white">
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
                          {(selectedItem.history || []).map((entry, index) => (
                            <tr key={`${selectedItem.itemId}-${index}`} className="border-t border-slate-100">
                              <td className="px-3 py-2">{entry.dateLabel}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{entry.voucherName}</td>
                              <td className="px-3 py-2">{entry.direction}</td>
                              <td className="px-3 py-2 text-right">{formatNumber(entry.qty)}</td>
                              <td className="px-3 py-2 text-right">{formatNumber(entry.rate)}</td>
                              <td className="px-3 py-2 text-right">{formatNumber(entry.value)}</td>
                              <td className="px-3 py-2 text-right">{formatNumber(entry.closingQty)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatNumber(entry.closingValue)}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  data-report-nav="true"
                                  data-focus-key={`rm-history-${index}`}
                                  className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                  onClick={() =>
                                    navigate(buildAlterVoucherPath(companyId, entry.voucherId), {
                                      state: buildReportReturnState(location, `rm-history-${index}`),
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
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
