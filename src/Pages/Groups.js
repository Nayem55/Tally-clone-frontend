import { useEffect, useMemo, useState } from "react";
import { FolderTree, PencilLine, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";

const defaultForm = {
  id: "",
  name: "",
  parentId: "",
  nature: "ASSET",
  affectsGrossProfit: false,
};

export default function Groups() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

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

  async function loadGroups(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    await api.get(`/companies/${selectedCompanyId}/masters/overview`);
    const response = await api.get(`/companies/${selectedCompanyId}/groups`);
    setGroups(response.data);
  }

  useEffect(() => {
    loadGroups();
  }, [companyId]);

  const sortedGroups = useMemo(
    () => [...groups].sort((left, right) => left.name.localeCompare(right.name)),
    [groups]
  );

  async function saveGroup() {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        parentId: form.parentId || null,
        nature: form.nature,
        affectsGrossProfit: form.affectsGrossProfit,
      };

      if (form.id) {
        await api.put(`/companies/${companyId}/groups/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/groups`, payload);
      }

      setForm(defaultForm);
      await loadGroups();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save group");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(groupId) {
    if (!window.confirm("Delete this group?")) return;
    try {
      await api.delete(`/companies/${companyId}/groups/${groupId}`);
      if (form.id === groupId) setForm(defaultForm);
      await loadGroups();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete group");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
                <FolderTree className="h-3.5 w-3.5" />
                Master maintenance
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Groups</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Build your chart structure for assets, liabilities, income, expenses, and stock classification.
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
                {form.id ? "Alter Group" : "Create Group"}
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
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Group name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />

              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={form.parentId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, parentId: event.target.value }))
                }
              >
                <option value="">Primary group</option>
                {sortedGroups
                  .filter((group) => group._id !== form.id)
                  .map((group) => (
                    <option key={group._id} value={group._id}>
                      {group.name}
                    </option>
                  ))}
              </select>

              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={form.nature}
                onChange={(event) =>
                  setForm((current) => ({ ...current, nature: event.target.value }))
                }
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.affectsGrossProfit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      affectsGrossProfit: event.target.checked,
                    }))
                  }
                />
                Affects gross profit
              </label>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveGroup}
                disabled={saving}
              >
                <Plus className="h-4 w-4" />
                {form.id ? "Update Group" : "Create Group"}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Existing Groups</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Nature</th>
                    <th className="px-4 py-3 font-medium">Parent</th>
                    <th className="px-4 py-3 font-medium">Gross Profit</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGroups.map((group) => {
                    const parent = groups.find((candidate) => candidate._id === group.parentId);
                    return (
                      <tr key={group._id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">{group.name}</td>
                        <td className="px-4 py-3 text-slate-600">{group.nature}</td>
                        <td className="px-4 py-3 text-slate-500">{parent?.name || "Primary"}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {group.affectsGrossProfit ? "Yes" : "No"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              onClick={() =>
                                setForm({
                                  id: group._id,
                                  name: group.name,
                                  parentId: group.parentId || "",
                                  nature: group.nature,
                                  affectsGrossProfit: Boolean(group.affectsGrossProfit),
                                })
                              }
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => deleteGroup(group._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sortedGroups.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No groups found for this company yet.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
