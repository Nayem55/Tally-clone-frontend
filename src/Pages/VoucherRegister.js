import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  FilePenLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { useNavigate } from "react-router-dom";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

function emptyVoucherForm() {
  return {
    _id: "",
    voucherTypeId: "",
    voucherName: "",
    number: "",
    date: "",
    narration: "",
    lines: [{ ledgerId: "", debit: "", credit: "" }],
    inventoryLines: [],
  };
}

export default function VoucherRegister() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const { companyId } = useActiveCompany();

  const [voucherTypes, setVoucherTypes] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [form, setForm] = useState(emptyVoucherForm());

  useEffect(() => {
    async function loadMasters() {
      if (!companyId) return;
      const [voucherTypeResponse, ledgerResponse, itemResponse] = await Promise.all([
        api.get(`/companies/${companyId}/voucher-types`),
        api.get(`/companies/${companyId}/ledgers`),
        api.get(`/companies/${companyId}/items`),
      ]);
      setVoucherTypes(voucherTypeResponse.data);
      setLedgers(ledgerResponse.data);
      setItems(itemResponse.data);
    }

    loadMasters();
  }, [companyId]);

  async function loadVouchers(
    currentCompanyId = companyId,
    currentType = voucherTypeFilter,
    currentFrom = fromDate,
    currentTo = toDate
  ) {
    if (!currentCompanyId) return;
    setLoading(true);
    try {
      const params = {};
      if (currentType) params.type = currentType;
      if (currentFrom) params.from = currentFrom;
      if (currentTo) params.to = currentTo;

      const response = await api.get(`/companies/${currentCompanyId}/vouchers`, {
        params,
      });
      setVouchers(response.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVouchers();
  }, [companyId, voucherTypeFilter, fromDate, toDate]);

  async function selectVoucher(voucherId) {
    setSelectedVoucherId(voucherId);
    const response = await api.get(`/companies/${companyId}/vouchers/${voucherId}`);
    const voucher = response.data;
    setForm({
      _id: voucher._id,
      voucherTypeId: voucher.voucherTypeId || "",
      voucherName: voucher.voucherName || "",
      number: voucher.number || "",
      date: voucher.date ? String(voucher.date).slice(0, 10) : "",
      narration: voucher.narration || "",
      lines:
        voucher.lines?.length > 0
          ? voucher.lines.map((line) => ({
              ledgerId: line.ledgerId || "",
              debit: line.debit || "",
              credit: line.credit || "",
            }))
          : [{ ledgerId: "", debit: "", credit: "" }],
      inventoryLines:
        voucher.inventoryLines?.map((line) => ({
          itemId: line.itemId || "",
          itemName: line.itemName || "",
          qty: line.qty || "",
          rate: line.rate || "",
          discount: line.discount || "",
          amount: line.amount || "",
        })) || [],
    });
  }

  const filteredVouchers = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return vouchers;
    return vouchers.filter((voucher) =>
      [voucher.voucherName, voucher.number, voucher.narration]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [searchTerm, vouchers]);

  const lineTotals = useMemo(() => {
    return form.lines.reduce(
      (accumulator, line) => ({
        debit: accumulator.debit + Number(line.debit || 0),
        credit: accumulator.credit + Number(line.credit || 0),
      }),
      { debit: 0, credit: 0 }
    );
  }, [form.lines]);

  const inventoryTotal = useMemo(() => {
    return form.inventoryLines.reduce(
      (sum, row) => sum + Number(row.amount || Number(row.qty || 0) * Number(row.rate || 0)),
      0
    );
  }, [form.inventoryLines]);

  function updateFormField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateLine(index, field, value) {
    setForm((current) => {
      const next = current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      );
      return { ...current, lines: next };
    });
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { ledgerId: "", debit: "", credit: "" }],
    }));
  }

  function removeLine(index) {
    setForm((current) => ({
      ...current,
      lines:
        current.lines.length === 1
          ? [{ ledgerId: "", debit: "", credit: "" }]
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  function updateInventoryLine(index, field, value) {
    setForm((current) => {
      const next = current.inventoryLines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const updated = { ...line, [field]: value };
        if (field === "itemId") {
          const item = items.find((entry) => entry._id === value);
          updated.itemName = item?.name || "";
        }
        const qty = Number(updated.qty || 0);
        const rate = Number(updated.rate || 0);
        const discount = Number(updated.discount || 0);
        updated.amount = (qty * rate - discount).toFixed(2);
        return updated;
      });
      return { ...current, inventoryLines: next };
    });
  }

  function addInventoryLine() {
    setForm((current) => ({
      ...current,
      inventoryLines: [
        ...current.inventoryLines,
        { itemId: "", itemName: "", qty: "", rate: "", discount: "", amount: "" },
      ],
    }));
  }

  function removeInventoryLine(index) {
    setForm((current) => ({
      ...current,
      inventoryLines: current.inventoryLines.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  async function saveVoucher() {
    if (!form._id) return;
    setSaving(true);
    try {
      await api.put(`/companies/${companyId}/vouchers/${form._id}`, {
        voucherTypeId: form.voucherTypeId,
        voucherName: form.voucherName,
        number: form.number,
        date: form.date,
        narration: form.narration,
        lines: form.lines,
        inventoryLines: form.inventoryLines,
      });
      await loadVouchers();
      await selectVoucher(form._id);
      alert("Voucher updated successfully.");
    } catch (error) {
      alert(error.response?.data?.message || "Unable to update voucher");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVoucher() {
    if (!form._id) return;
    const confirmed = window.confirm("Delete this voucher?");
    if (!confirmed) return;

    await api.delete(`/companies/${companyId}/vouchers/${form._id}`);
    setSelectedVoucherId("");
    setForm(emptyVoucherForm());
    await loadVouchers();
  }

  function clearFilters() {
    setVoucherTypeFilter("");
    setSearchTerm("");
    setFromDate(monthStart);
    setToDate(today);
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <FilePenLine className="h-3.5 w-3.5" />
                Alter vouchers
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Voucher Register</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Filter vouchers by type and date range, then open the correct entry for alteration.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Voucher Type
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={voucherTypeFilter}
                  onChange={(event) => setVoucherTypeFilter(event.target.value)}
                >
                  <option value="">All Voucher Types</option>
                  {voucherTypes.map((voucherType) => (
                    <option key={voucherType._id} value={voucherType._id}>
                      {voucherType.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                Filter Vouchers
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="relative md:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Search voucher no, name, or narration..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CalendarRange className="h-4 w-4 text-blue-600" />
                    From Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CalendarRange className="h-4 w-4 text-blue-600" />
                    To Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  onClick={() => loadVouchers()}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
                <span className="ml-auto text-sm text-slate-500">
                  {filteredVouchers.length} voucher{filteredVouchers.length === 1 ? "" : "s"} found
                </span>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Voucher</th>
                    <th className="px-4 py-3 font-medium">No.</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.map((voucher) => (
                    <tr
                      key={voucher._id}
                      className={`border-t border-slate-100 transition ${
                        selectedVoucherId === voucher._id ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{voucher.voucherName}</div>
                        <div className="text-xs text-slate-400">{voucher.narration || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{voucher.number || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(voucher.date)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                          onClick={() => navigate(buildAlterVoucherPath(companyId, voucher._id))}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {loading && (
                <div className="p-8 text-center text-sm text-slate-500">Loading vouchers...</div>
              )}

              {!loading && filteredVouchers.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  No vouchers found for the selected filters.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {!form._id ? (
              <div className="flex min-h-[480px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
                Select a voucher from the register to alter it.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Voucher Name
                      </label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={form.voucherName}
                        onChange={(event) => updateFormField("voucherName", event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Voucher Type
                      </label>
                      <select
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={form.voucherTypeId}
                        onChange={(event) => updateFormField("voucherTypeId", event.target.value)}
                      >
                        <option value="">Select type</option>
                        {voucherTypes.map((voucherType) => (
                          <option key={voucherType._id} value={voucherType._id}>
                            {voucherType.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Number
                      </label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={form.number}
                        onChange={(event) => updateFormField("number", event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={form.date}
                        onChange={(event) => updateFormField("date", event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Narration
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={form.narration}
                    onChange={(event) => updateFormField("narration", event.target.value)}
                  />
                </div>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Accounting Lines</h2>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      onClick={addLine}
                    >
                      <Plus className="h-4 w-4" />
                      Add Line
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Ledger</th>
                          <th className="px-4 py-3 text-right font-medium">Debit</th>
                          <th className="px-4 py-3 text-right font-medium">Credit</th>
                          <th className="px-4 py-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.lines.map((line, index) => (
                          <tr key={`line-${index}`} className="border-t border-slate-100">
                            <td className="px-4 py-3">
                              <select
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={line.ledgerId}
                                onChange={(event) => updateLine(index, "ledgerId", event.target.value)}
                              >
                                <option value="">Select ledger</option>
                                {ledgers.map((ledger) => (
                                  <option key={ledger._id} value={ledger._id}>
                                    {ledger.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={line.debit}
                                onChange={(event) => updateLine(index, "debit", event.target.value)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={line.credit}
                                onChange={(event) => updateLine(index, "credit", event.target.value)}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                className="rounded-lg border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                                onClick={() => removeLine(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    <span>Total Debit: {formatAmount(lineTotals.debit)}</span>
                    <span>Total Credit: {formatAmount(lineTotals.credit)}</span>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Inventory Lines</h2>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      onClick={addInventoryLine}
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Item</th>
                          <th className="px-4 py-3 text-right font-medium">Qty</th>
                          <th className="px-4 py-3 text-right font-medium">Rate</th>
                          <th className="px-4 py-3 text-right font-medium">Discount</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                          <th className="px-4 py-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.inventoryLines.map((line, index) => (
                          <tr key={`inventory-${index}`} className="border-t border-slate-100">
                            <td className="px-4 py-3">
                              <select
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={line.itemId}
                                onChange={(event) =>
                                  updateInventoryLine(index, "itemId", event.target.value)
                                }
                              >
                                <option value="">Select item</option>
                                {items.map((item) => (
                                  <option key={item._id} value={item._id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={line.qty}
                                onChange={(event) => updateInventoryLine(index, "qty", event.target.value)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={line.rate}
                                onChange={(event) => updateInventoryLine(index, "rate", event.target.value)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={line.discount}
                                onChange={(event) =>
                                  updateInventoryLine(index, "discount", event.target.value)
                                }
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {formatAmount(line.amount)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                className="rounded-lg border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                                onClick={() => removeInventoryLine(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    Inventory Total: {formatAmount(inventoryTotal)}
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    onClick={deleteVoucher}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    onClick={() => {
                      setSelectedVoucherId("");
                      setForm(emptyVoucherForm());
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    onClick={saveVoucher}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Voucher"}
                  </button>
                </div>
              </div>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}
