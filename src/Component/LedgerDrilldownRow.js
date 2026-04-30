import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { formatCurrencyAmount } from "../utils/currency";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";

export default function LedgerDrilldownRow({
  companyId,
  ledgerId,
  fromDate,
  toDate,
  company,
  colSpan,
  mode = "full",
}) {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!companyId || !ledgerId) return;
      setState({ loading: true, error: "", data: null });
      try {
        const response = await api.get(
          `/companies/${companyId}/reports/ledger-drilldown`,
          {
            params: {
              ledgerId,
              from: fromDate || undefined,
              to: toDate || undefined,
            },
          }
        );
        if (active) {
          setState({ loading: false, error: "", data: response.data });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error?.response?.data?.message || "Could not load details.",
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

  return (
    <tr className="bg-slate-50/80">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {state.loading ? (
            <p className="text-sm text-slate-500">Loading ledger breakdown...</p>
          ) : state.error ? (
            <p className="text-sm text-rose-600">{state.error}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Opening
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrencyAmount(state.data?.openingBalance, company)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Debit
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">
                    {formatCurrencyAmount(state.data?.totals?.debit, company)}
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                    Credit
                  </p>
                  <p className="mt-1 text-sm font-semibold text-rose-900">
                    {formatCurrencyAmount(state.data?.totals?.credit, company)}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Closing
                  </p>
                  <p className="mt-1 text-sm font-semibold text-blue-900">
                    {formatCurrencyAmount(state.data?.closingBalance, company)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-[520px] w-full text-sm">
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
                      {mode !== "inventory" && (
                        <th className="px-3 py-2 font-medium">Narration</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.entries || []).map((entry) => (
                      <tr
                        key={`${entry.voucherId}-${entry.lineIndex}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-2 text-slate-700">{entry.dateLabel}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {entry.voucherName}
                        </td>
                        {mode === "inventory" ? (
                          <td className="px-3 py-2 text-slate-600">
                            {entry.itemName || "-"}
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-slate-700">
                              {entry.voucherNumber || "-"}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {entry.counterpart || "-"}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {formatCurrencyAmount(entry.debit, company)}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-700">
                          {formatCurrencyAmount(entry.credit, company)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {formatCurrencyAmount(entry.runningBalance, company)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            data-report-nav="true"
                            className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            onClick={() =>
                              navigate(buildAlterVoucherPath(companyId, entry.voucherId))
                            }
                          >
                            Alter
                          </button>
                        </td>
                        {mode !== "inventory" && (
                          <td className="px-3 py-2 text-slate-600">
                            {entry.narration || "-"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(state.data?.entries || []).length === 0 && (
                  <div className="p-4 text-sm text-slate-500">
                    No voucher entries found for this ledger in the selected range.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
