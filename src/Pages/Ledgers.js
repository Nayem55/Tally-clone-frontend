import { useEffect, useMemo, useState } from "react";
import { BookOpen, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";

const defaultForm = {
  id: "",
  name: "",
  groupId: "",
  openingBalance: "",
  openingDrCr: "DR",
  priceLevelId: "",
};

export default function Ledgers() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [groups, setGroups] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");

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

  async function loadMasters(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    const [overview, ledgerResponse, priceLevelResponse] = await Promise.all([
      api.get(`/companies/${selectedCompanyId}/masters/overview`),
      api.get(`/companies/${selectedCompanyId}/ledgers`),
      api.get(`/companies/${selectedCompanyId}/price-levels`),
    ]);
    setGroups(overview.data.groups);
    setLedgers(ledgerResponse.data);
    setPriceLevels(priceLevelResponse.data);
  }

  useEffect(() => {
    loadMasters();
  }, [companyId]);

  const sortedGroups = useMemo(
    () => [...groups].sort((left, right) => left.name.localeCompare(right.name)),
    [groups]
  );

  const priceLevelById = useMemo(
    () => new Map(priceLevels.map((level) => [String(level._id), level])),
    [priceLevels]
  );

  async function saveLedger() {
    if (!companyId) return;
    try {
      const payload = {
        name: form.name,
        groupId: form.groupId,
        openingBalance: Number(form.openingBalance || 0),
        openingDrCr: form.openingDrCr,
        priceLevelId: form.priceLevelId || null,
      };

      if (form.id) {
        await api.put(`/companies/${companyId}/ledgers/${form.id}`, payload);
      } else {
        await api.post(`/companies/${companyId}/ledgers`, payload);
      }

      setForm(defaultForm);
      await loadMasters();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to save ledger");
    }
  }

  const filteredLedgers = useMemo(
    () =>
      ledgers.filter((ledger) =>
        `${ledger.name} ${ledger.group?.name || ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [ledgers, search]
  );

  async function deleteLedger(ledgerId) {
    if (!window.confirm("Delete this ledger?")) return;
    try {
      await api.delete(`/companies/${companyId}/ledgers/${ledgerId}`);
      if (form.id === ledgerId) setForm(defaultForm);
      await loadMasters();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete ledger");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                <BookOpen className="h-3.5 w-3.5" />
                Ledger control
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Ledgers</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Maintain customer, supplier, cash, bank, sales, and purchase ledgers with proper opening balances and price-level linkage.
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
                {form.id ? "Alter Ledger" : "Create Ledger"}
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

            <div className="mt-5 grid gap-4">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Ledger name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />

              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.groupId}
                onChange={(event) => setForm((current) => ({ ...current, groupId: event.target.value }))}
              >
                <option value="">Select group</option>
                {sortedGroups.map((group) => (
                  <option key={group._id} value={group._id}>
                    {group.name}
                  </option>
                ))}
              </select>

              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.priceLevelId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, priceLevelId: event.target.value }))
                }
              >
                <option value="">No price level mapping</option>
                {priceLevels.map((level) => (
                  <option key={level._id} value={level._id}>
                    {level.code} - {level.name}
                  </option>
                ))}
              </select>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Opening balance"
                  value={form.openingBalance}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      openingBalance: event.target.value,
                    }))
                  }
                />

                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.openingDrCr}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, openingDrCr: event.target.value }))
                  }
                >
                  <option value="DR">Debit</option>
                  <option value="CR">Credit</option>
                </select>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700"
                onClick={saveLedger}
              >
                <Plus className="h-4 w-4" />
                {form.id ? "Update Ledger" : "Create Ledger"}
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Existing Ledgers</h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Search ledger..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-4 py-3 font-medium">Opening</th>
                    <th className="px-4 py-3 font-medium">Price Level</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgers.map((ledger) => (
                    <tr key={ledger._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{ledger.name}</td>
                      <td className="px-4 py-3 text-slate-500">{ledger.group?.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {Number(ledger.openingBalance || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {ledger.openingDrCr}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {priceLevelById.get(String(ledger.priceLevelId))?.name ||
                          priceLevelById.get(String(ledger.priceLevelId))?.code ||
                          "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() =>
                              setForm({
                                id: ledger._id,
                                name: ledger.name,
                                groupId: ledger.groupId,
                                openingBalance: ledger.openingBalance,
                                openingDrCr: ledger.openingDrCr,
                                priceLevelId: ledger.priceLevelId || "",
                              })
                            }
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => deleteLedger(ledger._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLedgers.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No ledgers matched this view.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
