import { useEffect, useRef, useState } from "react";
import { Factory } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ProductionRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const { companyId } = useActiveCompany();
  const [rows, setRows] = useState([]);
  const [fromDate, setFromDate] = useState(formatLocalDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [toDate, setToDate] = useState(formatLocalDateInput(new Date()));

  useEffect(() => {
    async function loadRows() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/reports/manufacturing/production-register`, {
        params: { from: fromDate, to: toDate },
      });
      setRows(response.data?.rows || []);
    }

    loadRows();
  }, [companyId, fromDate, toDate, location.key]);

  useReportFocusRestore(containerRef, [rows, companyId, fromDate, toDate]);
  useReportKeyboardNav(containerRef, [rows, companyId, fromDate, toDate], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Factory className="h-3.5 w-3.5" />
            Manufacturing
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Production Register</h1>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="date" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <input type="date" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Production No.</th>
                  <th className="px-4 py-3 font-medium">BoM</th>
                  <th className="px-4 py-3 font-medium">Finished Good</th>
                  <th className="px-4 py-3 text-right font-medium">Output Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Total Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Alter</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.voucherId} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.dateLabel}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.number}</td>
                    <td className="px-4 py-3 text-slate-600">{row.bomName || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.outputItemName || "-"}</td>
                    <td className="px-4 py-3 text-right">{Number(row.outputQty || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right">{Number(row.effectiveRate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{Number(row.totalCost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        data-report-nav="true"
                        data-focus-key={`prod-${row.voucherId}`}
                        className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        onClick={() =>
                          navigate(buildAlterVoucherPath(companyId, row.voucherId), {
                            state: buildReportReturnState(location, `prod-${row.voucherId}`),
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
        </section>
      </div>
    </div>
  );
}
