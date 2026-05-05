import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, Landmark } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import { navigateBackFromReport } from "../utils/reportNavigation";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function LedgerDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const today = formatLocalDateInput(new Date());
  const monthStart = formatLocalDateInput(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(searchParams.get("companyId") || "");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || today);
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const ledgerId = searchParams.get("ledgerId") || "";
  const ledgerName = searchParams.get("ledgerName") || "Ledger Detail";
  const mode = searchParams.get("mode") || "full";

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      const list = response.data || [];
      setCompanies(list);
      if (list.length > 0) {
        setCompanyId((current) => current || list[0]._id);
      }
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!companyId || !ledgerId) return;
      setState({ loading: true, error: "", data: null });
      try {
        const response = await api.get(`/companies/${companyId}/reports/ledger-drilldown`, {
          params: {
            ledgerId,
            from: fromDate || undefined,
            to: toDate || undefined,
          },
        });
        if (active) {
          setState({ loading: false, error: "", data: response.data });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error?.response?.data?.message || "Could not load ledger details.",
            data: null,
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [companyId, ledgerId, fromDate, toDate]);

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company._id) === String(companyId)),
    [companies, companyId],
  );

  useReportFocusRestore(containerRef, [companyId, ledgerId, fromDate, toDate]);
  useReportKeyboardNav(containerRef, [state.data?.entries, companyId, ledgerId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
                onClick={() => navigateBackFromReport(navigate, location)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{ledgerName}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Voucher-wise ledger register. Press <span className="font-semibold">Esc</span> or <span className="font-semibold">Backspace</span> to go back.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
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

        {state.loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Loading ledger breakdown...
          </div>
        ) : state.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            {state.error}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Opening", state.data?.openingBalance, "text-slate-900"],
                ["Debit", state.data?.totals?.debit, "text-emerald-700"],
                ["Credit", state.data?.totals?.credit, "text-rose-700"],
                ["Closing", state.data?.closingBalance, "text-blue-700"],
              ].map(([label, value, tone]) => (
                <article
                  key={label}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className={`mt-2 text-2xl font-bold ${tone}`}>
                    {formatCurrencyAmount(value, selectedCompany)}
                  </p>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Landmark className="h-5 w-5 text-blue-600" />
                  Voucher Register
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Voucher</th>
                      {mode === "inventory" ? (
                        <th className="px-3 py-2 font-medium">Item Name</th>
                      ) : (
                        <>
                          <th className="px-3 py-2 font-medium">No.</th>
                          <th className="px-3 py-2 font-medium">Counterpart</th>
                        </>
                      )}
                      <th className="px-3 py-2 text-right font-medium">Debit</th>
                      <th className="px-3 py-2 text-right font-medium">Credit</th>
                      <th className="px-3 py-2 text-right font-medium">Running</th>
                      <th className="px-3 py-2 text-right font-medium">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.entries || []).map((entry, index) => (
                      <tr key={`${entry.voucherId}-${entry.lineIndex}-${index}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{entry.dateLabel}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{entry.voucherName}</td>
                        {mode === "inventory" ? (
                          <td className="px-3 py-2 text-slate-600">{entry.itemName || "-"}</td>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-slate-700">{entry.voucherNumber || "-"}</td>
                            <td className="px-3 py-2 text-slate-600">{entry.counterpart || "-"}</td>
                          </>
                        )}
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {formatCurrencyAmount(entry.debit, selectedCompany)}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-700">
                          {formatCurrencyAmount(entry.credit, selectedCompany)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {formatCurrencyAmount(entry.runningBalance, selectedCompany)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            data-report-nav="true"
                            data-focus-key={`entry-${entry.voucherId}-${entry.lineIndex}-${index}`}
                            className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            onClick={() => navigate(buildAlterVoucherPath(companyId, entry.voucherId))}
                          >
                            Alter
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(state.data?.entries || []).length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    No voucher entries found for this ledger in the selected range.
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
