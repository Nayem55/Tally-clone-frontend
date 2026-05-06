import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Factory, Save } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import TallyDateInput from "../Component/TallyDateInput";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import useEnterFieldNavigation from "../hooks/useEnterFieldNavigation";
import { formatDateForDisplay } from "../utils/voucherDates";
import { navigateBackFromReport } from "../utils/reportNavigation";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const blankForm = {
  bomId: "",
  bomName: "",
  number: "",
  date: formatLocalDateInput(new Date()),
  outputQty: 1,
  notes: "",
};

export default function ManufacturingVoucherPage({
  editVoucherId = "",
  companyIdOverride = "",
}) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId: activeCompanyId, selectedCompany } = useActiveCompany();
  const companyId = companyIdOverride || activeCompanyId;
  const [reference, setReference] = useState({ voucherTypeId: "", rawMaterials: [] });
  const [boms, setBoms] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEnterFieldNavigation(containerRef, [companyId, form.bomId, editVoucherId]);

  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: reference.voucherTypeId,
    companyName: selectedCompany?.name || "",
    voucherLabel: "Manufacturing",
    disabled: Boolean(editVoucherId),
  });

  useEffect(() => {
    async function loadData() {
      if (!companyId) return;
      const [referenceResponse, bomResponse] = await Promise.all([
        api.get(`/companies/${companyId}/manufacturing/reference`),
        api.get(`/companies/${companyId}/manufacturing/boms`),
      ]);
      setReference(referenceResponse.data || { voucherTypeId: "", rawMaterials: [] });
      setBoms((bomResponse.data || []).filter((row) => row.status !== "inactive"));
    }

    loadData().catch((error) => {
      console.error("Unable to load manufacturing entry data:", error);
      setStatus("Unable to load manufacturing data.");
    });
  }, [companyId]);

  useEffect(() => {
    if (!editVoucherId && suggestedNumber && !form.number) {
      setForm((current) => ({ ...current, number: suggestedNumber }));
    }
  }, [editVoucherId, form.number, suggestedNumber]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      containerRef.current
        ?.querySelector("[data-voucher-date='true']")
        ?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editVoucherId]);

  useEffect(() => {
    async function loadVoucher() {
      if (!editVoucherId || !companyId) return;
      const response = await api.get(`/companies/${companyId}/vouchers/${editVoucherId}`);
      const voucher = response.data || {};
      const meta = voucher.manufacturingMeta || {};
      setForm({
        bomId: meta.bomId || "",
        bomName: meta.bomName || "",
        number: voucher.number || "",
        date: voucher.date ? formatLocalDateInput(new Date(voucher.date)) : formatLocalDateInput(new Date()),
        outputQty: meta.outputQty || 1,
        notes: meta.notes || voucher.narration || "",
      });
    }

    loadVoucher().catch((error) => {
      console.error("Unable to load manufacturing voucher:", error);
      setStatus("Unable to load manufacturing voucher.");
    });
  }, [companyId, editVoucherId]);

  useEffect(() => {
    function handleBack(event) {
      if (event.key !== "Escape" && event.key !== "Backspace") return;
      const target = event.target;
      const tag = String(target?.tagName || "").toLowerCase();
      if (event.key === "Backspace" && (tag === "input" || tag === "textarea" || tag === "select")) {
        return;
      }
      event.preventDefault();
      navigateBackFromReport(navigate, location);
    }

    window.addEventListener("keydown", handleBack);
    return () => window.removeEventListener("keydown", handleBack);
  }, [location, navigate]);

  const activeBom = useMemo(
    () => boms.find((row) => row._id === form.bomId) || null,
    [boms, form.bomId],
  );

  const computed = useMemo(() => {
    if (!activeBom) {
      return {
        requiredComponents: [],
        additionalCost: 0,
        componentCost: 0,
        totalCost: 0,
        effectiveRate: 0,
        maxProducible: 0,
        canProduce: false,
      };
    }

    const requestedQty = Number(form.outputQty || 0);
    const ratio = Number(activeBom.outputQty || 0) > 0 ? requestedQty / Number(activeBom.outputQty || 1) : 0;
    const requiredComponents = (activeBom.components || []).map((component) => {
      const requiredQty = Number(component.qty || 0) * ratio;
      const availableQty = Number(component.availableQty || 0);
      const currentRate = Number(component.currentRate || 0);
      const value = requiredQty * currentRate;
      return {
        ...component,
        requiredQty,
        availableQty,
        shortageQty: Math.max(requiredQty - availableQty, 0),
        value,
      };
    });
    const componentCost = requiredComponents.reduce((sum, row) => sum + Number(row.value || 0), 0);
    const baseAdditionalCost = Number(activeBom.additionalCost || 0);
    const additionalCost =
      Number(activeBom.outputQty || 0) > 0 ? baseAdditionalCost * ratio : 0;
    const totalCost = componentCost + additionalCost;
    const effectiveRate = requestedQty > 0 ? totalCost / requestedQty : 0;
    const maxProducible = Number(activeBom.maxProducible || 0);
    const canProduce = requestedQty > 0 && requestedQty <= maxProducible && requiredComponents.every((row) => row.shortageQty <= 0);

    return {
      requiredComponents,
      additionalCost,
      componentCost,
      totalCost,
      effectiveRate,
      maxProducible,
      canProduce,
    };
  }, [activeBom, form.outputQty]);

  async function handleSave() {
    if (!companyId || !activeBom || !reference.voucherTypeId) return;
    setSaving(true);
    setStatus("");
    try {
      const inventoryLines = [
        ...computed.requiredComponents.map((row) => ({
          itemId: row.itemId,
          itemName: row.itemName,
          qty: row.requiredQty,
          rate: row.currentRate,
          amount: row.value,
          billedQty: row.requiredQty,
          direction: "OUT",
        })),
        {
          itemId: activeBom.finishedItemId,
          itemName: activeBom.finishedItemName,
          qty: Number(form.outputQty || 0),
          rate: computed.effectiveRate,
          amount: computed.totalCost,
          billedQty: Number(form.outputQty || 0),
          direction: "IN",
        },
      ];

      const payload = {
        voucherTypeId: reference.voucherTypeId,
        voucherName: "Manufacturing",
        number: form.number || suggestedNumber,
        date: form.date,
        narration: form.notes,
        inventoryLines,
        manufacturingMeta: {
          bomId: activeBom._id,
          bomName: activeBom.name,
          outputItemId: activeBom.finishedItemId,
          outputItemName: activeBom.finishedItemName,
          outputQty: Number(form.outputQty || 0),
          componentCost: computed.componentCost,
          additionalCost: computed.additionalCost,
          totalCost: computed.totalCost,
          effectiveRate: computed.effectiveRate,
          notes: form.notes,
        },
      };

      if (editVoucherId) {
        await api.put(`/companies/${companyId}/vouchers/${editVoucherId}`, payload);
        setStatus("Manufacturing voucher updated.");
      } else {
        await api.post(`/companies/${companyId}/vouchers`, payload);
        setStatus("Manufacturing voucher posted.");
        setForm((current) => ({
          ...blankForm,
          date: current.date,
          number: "",
        }));
        const nextNumber = await refreshSuggestedNumber();
        setForm((current) => ({
          ...current,
          number: nextNumber,
        }));
      }
    } catch (error) {
      setStatus(error.response?.data?.message || "Unable to save manufacturing voucher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-6">
            <div>
              <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500" onClick={() => navigateBackFromReport(navigate, location)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                <Factory className="h-3.5 w-3.5" />
                Manufacturing
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Production Entry</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Consume raw materials from the selected BoM and add finished goods back into stock at calculated manufacturing cost.
              </p>
              {status ? (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  {status}
                </div>
              ) : null}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                onClick={() => navigateBackFromReport(navigate, location)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!computed.canProduce || saving}
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : editVoucherId ? "Update Production" : "Post Production"}
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_360px]">
          <section className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Production No.</label>
                  <input
                    data-enter-nav="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.number}
                    onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Production Date</label>
                  <TallyDateInput
                    data-enter-nav="true"
                    data-voucher-date="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.date}
                    onChange={(nextValue) => setForm((current) => ({ ...current, date: nextValue }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">BoM</label>
                  <select
                    data-enter-nav="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.bomId}
                    onChange={(event) => {
                      const selected = boms.find((row) => row._id === event.target.value);
                      setForm((current) => ({
                        ...current,
                        bomId: event.target.value,
                        bomName: selected?.name || "",
                        outputQty: selected?.outputQty || 1,
                      }));
                    }}
                  >
                    <option value="">Select BoM</option>
                    {boms.map((row) => (
                      <option key={row._id} value={row._id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Output Quantity</label>
                  <input
                    data-enter-nav="true"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.outputQty}
                    onChange={(event) => setForm((current) => ({ ...current, outputQty: event.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Component Consumption</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Required raw materials are calculated from the BoM and checked against current raw material stock.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Max producible</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatQty(computed.maxProducible)}</p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Raw Material</th>
                      <th className="px-4 py-3 text-right font-medium">Available</th>
                      <th className="px-4 py-3 text-right font-medium">Required</th>
                      <th className="px-4 py-3 text-right font-medium">Shortage</th>
                      <th className="px-4 py-3 text-right font-medium">Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.requiredComponents.map((row) => (
                      <tr key={row.itemId} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.itemName}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{row.unitName || "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatQty(row.availableQty)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQty(row.requiredQty)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.shortageQty > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {formatQty(row.shortageQty)}
                        </td>
                        <td className="px-4 py-3 text-right">{formatMoney(row.currentRate)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Remarks</label>
                <textarea
                  data-enter-nav="true"
                  className="min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Production remarks, batch note, or job instruction..."
                />
              </div>
            </section>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Production Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Finished Good</span>
                  <span className="font-semibold text-slate-900">{activeBom?.finishedItemName || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Output Qty</span>
                  <span className="font-semibold text-slate-900">{formatQty(form.outputQty)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Component Cost</span>
                  <span className="font-semibold text-slate-900">{formatMoney(computed.componentCost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Additional Cost</span>
                  <span className="font-semibold text-slate-900">{formatMoney(computed.additionalCost)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-slate-500">Finished Rate</span>
                  <span className="text-xl font-bold text-blue-700">{formatMoney(computed.effectiveRate)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Production Checks</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Company: <span className="font-semibold text-slate-900">{selectedCompany?.name || "-"}</span></li>
                <li>Date: <span className="font-semibold text-slate-900">{formatDateForDisplay(form.date)}</span></li>
                <li>BoM Status: <span className="font-semibold text-slate-900">{activeBom?.status || "-"}</span></li>
                <li>
                  Stock Check:{" "}
                  <span className={`font-semibold ${computed.canProduce ? "text-emerald-600" : "text-rose-600"}`}>
                    {computed.canProduce ? "Ready to produce" : "Insufficient raw material"}
                  </span>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
