import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, PackageSearch } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
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
