import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CalendarDays,
  Factory,
  FlaskConical,
  Package,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { formatCurrencyAmount } from "../utils/currency";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";

function formatLocalDate(value = new Date()) {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "long",
  });
}

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function MetricCard({ title, icon: Icon, value, subtitle, tone }) {
  return (
    <article className="rounded-[18px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-slate-700">{title}</p>
          <p className="mt-2 truncate text-[18px] font-bold leading-none text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-[13px] text-slate-400">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}

function PanelShell({ title, right, children, className = "" }) {
  return (
    <article
      className={`rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      {children}
    </article>
  );
}

function StatusBadge({ value }) {
  const ready = String(value || "").toLowerCase() === "ready";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        ready
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {ready ? "Ready" : "Blocked"}
    </span>
  );
}

export default function ManufacturingDashboardPage() {
  const navigate = useNavigate();
  const { companyId, selectedCompany } = useActiveCompany();
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    async function loadDashboard() {
      if (!companyId) return;
      const response = await api.get(
        `/companies/${companyId}/reports/manufacturing-dashboard`,
      );
      setDashboard(response.data);
    }
    loadDashboard();
  }, [companyId]);

  const topBomRows = useMemo(
    () => dashboard?.boms?.topRows || [],
    [dashboard?.boms?.topRows],
  );
  const topRawRows = useMemo(
    () => dashboard?.rawMaterials?.topRows || [],
    [dashboard?.rawMaterials?.topRows],
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] px-6 py-7">
      <div className="mx-auto max-w-[1520px] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
              <Factory className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-[24px] font-semibold text-slate-900">
                Manufacturing Dashboard
              </h1>
              <span className="rounded-xl bg-slate-100 px-3 py-1 text-[18px] font-medium text-slate-500">
                {selectedCompany?.name || "No company selected"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3 text-slate-700">
              <CalendarDays className="h-5 w-5 text-slate-500" />
              <span className="text-[15px] font-medium">{formatLocalDate()}</span>
            </div>
          </div>
        </div>

        {dashboard ? (
          <>
            <section className="rounded-[18px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                <div>
                  <p className="text-[14px] font-medium text-slate-700">
                    Current manufacturing capacity based on raw material closing stock.
                  </p>
                  <p className="mt-2 text-[13px] text-slate-500">
                    {dashboard.notes?.capacityBasis}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                  {dashboard.notes?.caution}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-4">
              <MetricCard
                title="Raw Material SKUs"
                icon={FlaskConical}
                value={formatQty(dashboard.rawMaterials?.itemsCount)}
                subtitle="Current closing stock items"
                tone="bg-blue-50 text-blue-600"
              />
              <MetricCard
                title="Raw Material Value"
                icon={Package}
                value={formatCurrencyAmount(
                  dashboard.rawMaterials?.closingValue,
                  selectedCompany,
                )}
                subtitle="Current closing value"
                tone="bg-emerald-50 text-emerald-600"
              />
              <MetricCard
                title="Active BoMs"
                icon={Boxes}
                value={formatQty(dashboard.boms?.active)}
                subtitle="Current production formulas"
                tone="bg-violet-50 text-violet-600"
              />
              <MetricCard
                title="Ready BoMs"
                icon={TrendingUp}
                value={formatQty(dashboard.boms?.ready)}
                subtitle="Can produce with current stock"
                tone="bg-amber-50 text-amber-600"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <PanelShell
                title="BoM Production Capacity"
                right={
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium text-blue-700"
                    onClick={() => navigate("/reports/inventory-books/bom-register")}
                  >
                    View BoM Register
                  </button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-medium">BoM</th>
                        <th className="px-3 py-3 font-medium">Finished Good</th>
                        <th className="px-3 py-3 text-right font-medium">Per Batch</th>
                        <th className="px-3 py-3 text-right font-medium">Can Make Now</th>
                        <th className="px-3 py-3 font-medium">Bottleneck</th>
                        <th className="px-3 py-3 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBomRows.map((row) => (
                        <tr key={row._id} className="border-t border-slate-100">
                          <td className="px-3 py-3 font-medium text-slate-900">{row.name}</td>
                          <td className="px-3 py-3 text-slate-700">{row.finishedItemName}</td>
                          <td className="px-3 py-3 text-right">
                            {formatQty(row.outputQty)} {row.unitName || ""}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-900">
                            {formatQty(row.maxProducible)}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {row.bottleneckName || "-"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <StatusBadge value={row.readiness} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelShell>

              <PanelShell
                title="Manufacturing Snapshot"
                right={
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium text-blue-700"
                    onClick={() => navigate("/transactions/inventory/manufacturing")}
                  >
                    Create Voucher
                  </button>
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-[14px] text-slate-600">Consumed Raw Material Value</span>
                    <span className="text-[15px] font-semibold text-slate-900">
                      {formatCurrencyAmount(
                        dashboard.rawMaterials?.consumedValue,
                        selectedCompany,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-[14px] text-slate-600">Current Raw Material Inward Value</span>
                    <span className="text-[15px] font-semibold text-slate-900">
                      {formatCurrencyAmount(
                        dashboard.rawMaterials?.inwardValue,
                        selectedCompany,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-[14px] text-slate-600">Blocked BoMs</span>
                    <span className="text-[15px] font-semibold text-rose-700">
                      {formatQty(dashboard.boms?.blocked)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-[14px] text-slate-600">Ready BoMs</span>
                    <span className="text-[15px] font-semibold text-emerald-700">
                      {formatQty(dashboard.boms?.ready)}
                    </span>
                  </div>
                </div>
              </PanelShell>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <PanelShell
                title="Current Raw Material Closing Stock"
                right={
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium text-blue-700"
                    onClick={() =>
                      navigate("/reports/inventory-books/stock-group-summary")
                    }
                  >
                    View Stock Groups
                  </button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-medium">Raw Material</th>
                        <th className="px-3 py-3 font-medium">Group</th>
                        <th className="px-3 py-3 text-right font-medium">Closing Qty</th>
                        <th className="px-3 py-3 text-right font-medium">Rate</th>
                        <th className="px-3 py-3 text-right font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRawRows.map((row) => (
                        <tr key={row.itemId} className="border-t border-slate-100">
                          <td className="px-3 py-3 font-medium text-slate-900">{row.itemName}</td>
                          <td className="px-3 py-3 text-slate-600">{row.groupName || "-"}</td>
                          <td className="px-3 py-3 text-right">{formatQty(row.closingQty)}</td>
                          <td className="px-3 py-3 text-right">
                            {formatCurrencyAmount(row.closingRate, selectedCompany)}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-900">
                            {formatCurrencyAmount(row.closingValue, selectedCompany)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelShell>

              <PanelShell title="BoM Constraints">
                <div className="space-y-3">
                  {topBomRows.map((row) => (
                    <div
                      key={`constraint-${row._id}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[14px] font-semibold text-slate-900">
                            {row.finishedItemName}
                          </p>
                          <p className="mt-1 text-[13px] text-slate-500">
                            {row.name}
                          </p>
                        </div>
                        <StatusBadge value={row.readiness} />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[12px] text-slate-400">Can Make Now</p>
                          <p className="mt-1 text-[14px] font-semibold text-slate-900">
                            {formatQty(row.maxProducible)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[12px] text-slate-400">Bottleneck</p>
                          <p className="mt-1 text-[14px] font-semibold text-slate-900">
                            {row.bottleneckName || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[12px] text-slate-400">Effective Rate</p>
                          <p className="mt-1 text-[14px] font-semibold text-slate-900">
                            {formatCurrencyAmount(row.effectiveRate, selectedCompany)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </PanelShell>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
