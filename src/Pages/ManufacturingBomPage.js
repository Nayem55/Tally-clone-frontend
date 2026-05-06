import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Boxes, Plus, Save, Trash2 } from "lucide-react";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import useEnterFieldNavigation from "../hooks/useEnterFieldNavigation";

const blankComponent = {
  itemId: "",
  itemName: "",
  description: "",
  qty: 1,
  unitId: "",
  unitName: "",
};

const blankCost = {
  label: "",
  amount: "",
};

const blankForm = {
  id: "",
  name: "",
  finishedItemId: "",
  finishedItemName: "",
  outputQty: 1,
  unitId: "",
  unitName: "",
  description: "",
  status: "active",
  notes: "",
  components: [{ ...blankComponent }],
  additionalCosts: [],
};

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function ManufacturingBomPage({ mode = "create" }) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { companyId, selectedCompany } = useActiveCompany();
  const [reference, setReference] = useState({
    rawMaterials: [],
    finishedGoods: [],
    units: [],
  });
  const [boms, setBoms] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEnterFieldNavigation(containerRef, [form.id, companyId, form.components.length]);

  useEffect(() => {
    async function loadData() {
      if (!companyId) return;
      const [referenceResponse, bomResponse] = await Promise.all([
        api.get(`/companies/${companyId}/manufacturing/reference`),
        api.get(`/companies/${companyId}/manufacturing/boms`),
      ]);
      setReference(referenceResponse.data || { rawMaterials: [], finishedGoods: [], units: [] });
      setBoms(bomResponse.data || []);
    }

    loadData().catch((error) => {
      console.error("Unable to load manufacturing BOM data:", error);
      setStatus("Unable to load BoM data right now.");
    });
  }, [companyId]);

  const finishedGoods = reference.finishedGoods || [];
  const rawMaterials = reference.rawMaterials || [];
  const units = reference.units || [];

  const totalComponentCost = useMemo(
    () =>
      form.components.reduce((sum, row) => {
        const referenceRow = rawMaterials.find((item) => item._id === row.itemId);
        return sum + Number(row.qty || 0) * Number(referenceRow?.currentRate || 0);
      }, 0),
    [form.components, rawMaterials],
  );
  const totalAdditionalCost = useMemo(
    () => form.additionalCosts.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [form.additionalCosts],
  );
  const effectiveRate = Number(form.outputQty || 0)
    ? (totalComponentCost + totalAdditionalCost) / Number(form.outputQty || 1)
    : 0;

  function patchComponent(index, patch) {
    setForm((current) => ({
      ...current,
      components: current.components.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function patchCost(index, patch) {
    setForm((current) => ({
      ...current,
      additionalCosts: current.additionalCosts.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function hydrateForm(row) {
    setForm({
      id: row._id,
      name: row.name || "",
      finishedItemId: row.finishedItemId || "",
      finishedItemName: row.finishedItemName || "",
      outputQty: row.outputQty || 1,
      unitId: row.unitId || "",
      unitName: row.unitName || "",
      description: row.description || "",
      status: row.status || "active",
      notes: row.notes || "",
      components: (row.components || []).length > 0 ? row.components : [{ ...blankComponent }],
      additionalCosts: row.additionalCosts || [],
    });
  }

  async function refreshList(nextId = "") {
    if (!companyId) return;
    const response = await api.get(`/companies/${companyId}/manufacturing/boms`);
    const rows = response.data || [];
    setBoms(rows);
    if (nextId) {
      const nextRow = rows.find((row) => row._id === nextId);
      if (nextRow) hydrateForm(nextRow);
    }
  }

  async function saveBom() {
    if (!companyId) return;
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        ...form,
        components: form.components.filter((row) => row.itemId && Number(row.qty || 0) > 0),
        additionalCosts: form.additionalCosts.filter(
          (row) => row.label && Number(row.amount || 0) > 0,
        ),
      };

      if (form.id) {
        await api.put(`/companies/${companyId}/manufacturing/boms/${form.id}`, payload);
        await refreshList(form.id);
      } else {
        const response = await api.post(`/companies/${companyId}/manufacturing/boms`, payload);
        await refreshList(response.data?._id);
      }

      setStatus("BoM saved successfully.");
      if (mode === "create" && !form.id) {
        setForm(blankForm);
      }
    } catch (error) {
      setStatus(error.response?.data?.message || "Unable to save BoM.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBom(id) {
    if (!id) return;
    if (!window.confirm("Delete this BoM?")) return;
    try {
      await api.delete(`/companies/${companyId}/manufacturing/boms/${id}`);
      setForm(blankForm);
      await refreshList();
      setStatus("BoM deleted.");
    } catch (error) {
      setStatus(error.response?.data?.message || "Unable to delete BoM.");
    }
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1550px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-6">
            <div>
              <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                <Boxes className="h-3.5 w-3.5" />
                Manufacturing
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">BoM Configuration</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Define the recipe for finished goods by linking raw materials, output quantity, and additional manufacturing cost.
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
                onClick={() => setForm(blankForm)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                onClick={saveBom}
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save BoM"}
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_360px]">
          <section className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">BoM Name</label>
                  <input
                    data-enter-nav="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Finished Item</label>
                  <select
                    data-enter-nav="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.finishedItemId}
                    onChange={(event) => {
                      const selected = finishedGoods.find((row) => row._id === event.target.value);
                      setForm((current) => ({
                        ...current,
                        finishedItemId: event.target.value,
                        finishedItemName: selected?.name || "",
                        unitId: selected?.unitId || current.unitId,
                        unitName: selected?.unitOfMeasure || current.unitName,
                        name: current.name || `${selected?.name || "Finished Item"} BoM`,
                      }));
                    }}
                  >
                    <option value="">Select finished item</option>
                    {finishedGoods.map((row) => (
                      <option key={row._id} value={row._id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Quantity (Output)</label>
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
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select
                    data-enter-nav="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Unit of Manufacture</label>
                  <select
                    data-enter-nav="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.unitId}
                    onChange={(event) => {
                      const selected = units.find((row) => row._id === event.target.value);
                      setForm((current) => ({
                        ...current,
                        unitId: event.target.value,
                        unitName: selected?.name || "",
                      }));
                    }}
                  >
                    <option value="">Select unit</option>
                    {units.map((row) => (
                      <option key={row._id} value={row._id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
                  <input
                    data-enter-nav="true"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Components (Consumption)</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add every raw material required to manufacture the finished good.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      components: [...current.components, { ...blankComponent }],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Component
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Component Item</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 text-right font-medium">Quantity</th>
                      <th className="px-4 py-3 font-medium">Unit</th>
                      <th className="px-4 py-3 text-right font-medium">Available</th>
                      <th className="px-4 py-3 text-right font-medium">Current Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.components.map((row, index) => {
                      const raw = rawMaterials.find((item) => item._id === row.itemId);
                      const amount = Number(row.qty || 0) * Number(raw?.currentRate || 0);
                      return (
                        <tr key={`component-${index}`} className="border-t border-slate-100">
                          <td className="px-4 py-3">
                            <select
                              data-enter-nav="true"
                              className="w-full rounded-xl border border-slate-200 px-3 py-2"
                              value={row.itemId}
                              onChange={(event) => {
                                const selected = rawMaterials.find((item) => item._id === event.target.value);
                                patchComponent(index, {
                                  itemId: event.target.value,
                                  itemName: selected?.name || "",
                                  unitId: selected?.unitId || "",
                                  unitName: selected?.unitOfMeasure || "",
                                  description: selected?.description || "",
                                });
                              }}
                            >
                              <option value="">Select raw material</option>
                              {rawMaterials.map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.description || "-"}</td>
                          <td className="px-4 py-3">
                            <input
                              data-enter-nav="true"
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right"
                              value={row.qty}
                              onChange={(event) => patchComponent(index, { qty: event.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.unitName || "-"}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatQty(raw?.availableQty || 0)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {Number(raw?.currentRate || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {amount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  components:
                                    current.components.length === 1
                                      ? [{ ...blankComponent }]
                                      : current.components.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Additional Cost</h2>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        additionalCosts: [...current.additionalCosts, { ...blankCost }],
                      }))
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {form.additionalCosts.length === 0 ? (
                    <p className="text-sm text-slate-400">No additional cost added yet.</p>
                  ) : null}
                  {form.additionalCosts.map((row, index) => (
                    <div key={`cost-${index}`} className="grid gap-3 md:grid-cols-[1fr_140px_44px]">
                      <input
                        data-enter-nav="true"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Cost label"
                        value={row.label}
                        onChange={(event) => patchCost(index, { label: event.target.value })}
                      />
                      <input
                        data-enter-nav="true"
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-right text-sm"
                        placeholder="Amount"
                        value={row.amount}
                        onChange={(event) => patchCost(index, { amount: event.target.value })}
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-rose-200 text-rose-500"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            additionalCosts: current.additionalCosts.filter((_, rowIndex) => rowIndex !== index),
                          }))
                        }
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Remarks</h2>
                <textarea
                  data-enter-nav="true"
                  className="mt-4 min-h-[170px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="Type remarks here..."
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </div>
            </section>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">BoM Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Company</span>
                  <span className="font-semibold text-slate-900">{selectedCompany?.name || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cost of Components</span>
                  <span className="font-semibold text-slate-900">
                    {totalComponentCost.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Additional Cost</span>
                  <span className="font-semibold text-slate-900">
                    {totalAdditionalCost.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-slate-500">Effective Rate</span>
                  <span className="text-xl font-bold text-blue-700">
                    {effectiveRate.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Existing BoMs</h2>
              <div className="mt-4 space-y-3">
                {boms.length === 0 ? (
                  <p className="text-sm text-slate-400">No BoM created yet.</p>
                ) : null}
                {boms.map((row) => (
                  <button
                    key={row._id}
                    type="button"
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${
                      form.id === row._id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => hydrateForm(row)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.finishedItemName || "-"}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          Max producible: {formatQty(row.maxProducible || 0)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          row.status === "inactive"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {row.status || "active"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {form.id ? (
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600"
                  onClick={() => deleteBom(form.id)}
                >
                  Delete Selected BoM
                </button>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
