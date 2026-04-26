import { useEffect, useMemo, useState } from "react";
import { Boxes, PencilLine, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";

const defaultForm = {
  id: "",
  name: "",
  alias: "",
  groupId: "",
  openingQty: "",
  openingRate: "",
};

export default function Items() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [stockGroups, setStockGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || response.data[0]._id);
      }
    }

    loadCompanies();
  }, []);

  async function loadData(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    await api.get(`/companies/${selectedCompanyId}/masters/overview`);
    const [groupsResponse, itemResponse] = await Promise.all([
      api.get(`/companies/${selectedCompanyId}/chart-of-accounts/stock-groups`),
      api.get(`/companies/${selectedCompanyId}/items`),
    ]);
    setStockGroups(groupsResponse.data.filter((row) => row.type === "group"));
    setItems(itemResponse.data);
  }

  useEffect(() => {
    loadData();
  }, [companyId]);

  const sortedStockGroups = useMemo(
    () => [...stockGroups].sort((left, right) => left.name.localeCompare(right.name)),
    [stockGroups]
  );

  const openingValue =
    (Number(form.openingQty) || 0) * (Number(form.openingRate) || 0);

  async function saveItem() {
    if (!companyId) return;
    const payload = {
      name: form.name,
      alias: form.alias,
      groupId: form.groupId,
      openingQty: Number(form.openingQty || 0),
      openingRate: Number(form.openingRate || 0),
      openingValue,
    };

    try {
      if (form.id) {
        await api.put(`/companies/${companyId}/items/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/items`, payload);
      }

      setForm(defaultForm);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save item");
    }
  }

  async function deleteItem(itemId) {
    if (!window.confirm("Delete this stock item?")) return;
    try {
      await api.delete(`/companies/${companyId}/items/${itemId}`);
      if (form.id === itemId) setForm(defaultForm);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete item");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
                <Boxes className="h-3.5 w-3.5" />
                Stock master
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Stock Items</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Create and alter stock items with barcode aliases, opening quantities, and opening rates.
              </p>
            </div>

            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              label="Company"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {form.id ? "Alter Stock Item" : "Create Stock Item"}
              </h2>
              {form.id && (
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                  onClick={() => setForm(defaultForm)}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                placeholder="Item name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />

              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                placeholder="Alias / barcode"
                value={form.alias}
                onChange={(event) =>
                  setForm((current) => ({ ...current, alias: event.target.value }))
                }
              />

              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                value={form.groupId}
                onChange={(event) => setForm((current) => ({ ...current, groupId: event.target.value }))}
              >
                <option value="">Select stock group</option>
                {sortedStockGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>

              <div className="grid gap-4 md:grid-cols-3">
                <input
                  type="number"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="Opening qty"
                  value={form.openingQty}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, openingQty: event.target.value }))
                  }
                />
                <input
                  type="number"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="Opening rate"
                  value={form.openingRate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, openingRate: event.target.value }))
                  }
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Opening value
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {openingValue.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-amber-700"
                onClick={saveItem}
              >
                <Plus className="h-4 w-4" />
                {form.id ? "Update Stock Item" : "Create Stock Item"}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Existing Stock Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Alias</th>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-4 py-3 text-right font-medium">Opening Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Opening Value</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-slate-500">{item.alias || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{item.group?.name || "-"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {Number(item.openingQty || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {Number(item.openingValue || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() =>
                              setForm({
                                id: item._id,
                                name: item.name,
                                alias: item.alias || "",
                                groupId: item.groupId,
                                openingQty: item.openingQty,
                                openingRate: item.openingRate,
                              })
                            }
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => deleteItem(item._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {items.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No stock items found for this company yet.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
