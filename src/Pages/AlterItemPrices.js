import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Search } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeDateKey(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function formatDate(value) {
  const key = normalizeDateKey(value);
  if (!key) return "-";
  const [year, month, day] = key.split("-");
  return `${day}-${month}-${year.slice(2)}`;
}

function resolvePriceForDate(item, priceLevelId, effectiveFromDate) {
  const selectedDateKey = normalizeDateKey(effectiveFromDate);
  const entries = (item.prices || [])
    .filter((entry) => entry.priceLevelId === priceLevelId)
    .map((entry) => ({
      ...entry,
      effectiveKey: normalizeDateKey(entry.effectiveFrom),
    }));

  const datedEntries = entries
    .filter((entry) => entry.effectiveKey && (!selectedDateKey || entry.effectiveKey <= selectedDateKey))
    .sort((left, right) => right.effectiveKey.localeCompare(left.effectiveKey));

  if (datedEntries.length > 0) {
    return datedEntries[0];
  }

  const undatedEntry = entries.find((entry) => !entry.effectiveKey);
  return undatedEntry || null;
}

export default function AlterItemPrices() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkPriceLevelId, setBulkPriceLevelId] = useState("");
  const [bulkRate, setBulkRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);

  useEffect(() => {
    api.get("/companies").then((response) => {
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || response.data[0]._id);
      }
    });
  }, []);

  async function loadData(selectedCompanyId = companyId) {
    if (!selectedCompanyId) return;
    const [groupResponse, itemResponse, priceLevelResponse] = await Promise.all([
      api.get(`/companies/${selectedCompanyId}/chart-of-accounts/stock-groups`),
      api.get(`/companies/${selectedCompanyId}/items`),
      api.get(`/companies/${selectedCompanyId}/price-levels`),
    ]);
    setGroups(groupResponse.data.filter((row) => row.type === "group"));
    setItems(itemResponse.data);
    setPriceLevels(priceLevelResponse.data);
    if (!bulkPriceLevelId && priceLevelResponse.data.length > 0) {
      setBulkPriceLevelId(priceLevelResponse.data[0]._id);
    }
  }

  useEffect(() => {
    loadData();
  }, [companyId]);

  async function bulkUpdate() {
    if (!bulkGroupId || !bulkPriceLevelId || !bulkRate || !effectiveFrom) {
      alert("Fill group, price level, rate, and applicable from date");
      return;
    }

    setLoading(true);
    try {
      await api.put(`/companies/${companyId}/update-prices-by-group`, {
        groupId: bulkGroupId,
        priceLevelId: bulkPriceLevelId,
        rate: Number(bulkRate),
        effectiveFrom,
      });
      setBulkRate("");
      await loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Bulk update failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedPriceLevel =
    priceLevels.find((level) => level._id === bulkPriceLevelId) || priceLevels[0];

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) =>
      `${item.name} ${item.group?.name || ""}`.toLowerCase().includes(query)
    );
  }, [items, search]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold text-slate-900">Alter Item Prices</h1>
          <p className="mt-2 text-sm text-slate-500">
            Update price lists in bulk and make the revised rate effective from the selected date.
          </p>
          <div className="mt-6 max-w-md">
            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              label="Company"
            />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Update</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <select
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={bulkGroupId}
              onChange={(event) => setBulkGroupId(event.target.value)}
            >
              <option value="">Select Group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={bulkPriceLevelId}
              onChange={(event) => setBulkPriceLevelId(event.target.value)}
            >
              <option value="">Price Level</option>
              {priceLevels.map((level) => (
                <option key={level._id} value={level._id}>
                  {level.code}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Enter rate"
              value={bulkRate}
              onChange={(event) => setBulkRate(event.target.value)}
            />
            <div className="relative">
              <CalendarRange className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              onClick={bulkUpdate}
              disabled={loading}
            >
              Update Group
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Price List - {selectedPriceLevel?.code || "MRP"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Applicable from: {formatDate(effectiveFrom)}
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 px-10 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Search item..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">S.No.</th>
                  <th className="px-4 py-3 font-medium">Particulars</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Effective From</th>
                  <th className="px-4 py-3 text-right font-medium">Cost Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => {
                  const selectedEntry = resolvePriceForDate(
                    item,
                    selectedPriceLevel?._id,
                    effectiveFrom
                  );
                  return (
                    <tr key={item._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-blue-700">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-slate-500">{item.group?.name || "-"}</td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {formatMoney(selectedEntry?.rate || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {selectedEntry?.effectiveFrom
                          ? formatDate(selectedEntry.effectiveFrom)
                          : "Opening / Legacy"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatMoney(item.openingRate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            Total Items: {rows.length}
          </div>
        </section>
      </div>
    </div>
  );
}
