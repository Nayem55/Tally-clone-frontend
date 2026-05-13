import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Search } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import SearchableSelect from "../Component/SearchableSelect";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeDateKey(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

function formatDate(value) {
  const key = normalizeDateKey(value);
  if (!key) return "-";
  const [year, month, day] = key.split("-");
  return `${day}-${month}-${year.slice(2)}`;
}

function resolvePriceForDate(item, priceLevelId, effectiveFromDate) {
  const selectedDateKey = normalizeDateKey(effectiveFromDate);
  const normalizedPriceLevelId = priceLevelId ? String(priceLevelId) : "";
  const entries = (item.prices || [])
    .filter(
      (entry) => String(entry.priceLevelId || "") === normalizedPriceLevelId,
    )
    .map((entry) => ({
      ...entry,
      effectiveKey: normalizeDateKey(entry.effectiveFrom),
    }));

  const datedEntries = entries
    .filter(
      (entry) =>
        entry.effectiveKey &&
        (!selectedDateKey || entry.effectiveKey <= selectedDateKey),
    )
    .sort((left, right) => right.effectiveKey.localeCompare(left.effectiveKey));

  if (datedEntries.length > 0) {
    return datedEntries[0];
  }

  const undatedEntry = entries.find((entry) => !entry.effectiveKey);
  return undatedEntry || null;
}

function resolveNextPriceAfterDate(item, priceLevelId, asOnDate) {
  const asOnKey = normalizeDateKey(asOnDate);
  const normalizedPriceLevelId = priceLevelId ? String(priceLevelId) : "";

  return (
    (item.prices || [])
      .filter(
        (entry) => String(entry.priceLevelId || "") === normalizedPriceLevelId,
      )
      .map((entry) => ({
        ...entry,
        effectiveKey: normalizeDateKey(entry.effectiveFrom),
      }))
      .filter(
        (entry) =>
          entry.effectiveKey && (!asOnKey || entry.effectiveKey > asOnKey),
      )
      .sort((left, right) =>
        left.effectiveKey.localeCompare(right.effectiveKey),
      )[0] || null
  );
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
  const [updateMode, setUpdateMode] = useState("group");
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkItemId, setBulkItemId] = useState("");
  const [bulkPriceLevelId, setBulkPriceLevelId] = useState("");
  const [bulkRate, setBulkRate] = useState("");
  const [asOnDate] = useState(today);
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
    const [groupResponse, itemResponse, priceLevelResponse] = await Promise.all(
      [
        api.get(
          `/companies/${selectedCompanyId}/chart-of-accounts/stock-groups`,
        ),
        api.get(`/companies/${selectedCompanyId}/items`),
        api.get(`/companies/${selectedCompanyId}/price-levels`),
      ],
    );
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
    if (!bulkPriceLevelId || !bulkRate || !effectiveFrom) {
      alert("Fill price level, rate, and applicable from date");
      return;
    }

    if (updateMode === "group" && !bulkGroupId) {
      alert("Select a group for group-wise price update");
      return;
    }

    if (updateMode === "item" && !bulkItemId) {
      alert("Select an item for item-wise price update");
      return;
    }

    setLoading(true);
    try {
      if (updateMode === "group") {
        await api.put(`/companies/${companyId}/update-prices-by-group`, {
          groupId: bulkGroupId,
          priceLevelId: bulkPriceLevelId,
          rate: Number(bulkRate),
          effectiveFrom,
        });
      } else {
        await api.put(`/companies/${companyId}/update-price-by-item`, {
          itemId: bulkItemId,
          priceLevelId: bulkPriceLevelId,
          rate: Number(bulkRate),
          effectiveFrom,
        });
      }
      setBulkRate("");
      await loadData();
    } catch (error) {
      alert(error.response?.data?.message || "Price update failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedPriceLevel =
    priceLevels.find((level) => level._id === bulkPriceLevelId) ||
    priceLevels[0];

  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) => String(group.id || group._id) === String(bulkGroupId || ""),
      ) || null,
    [groups, bulkGroupId],
  );

  const selectedItem = useMemo(
    () =>
      items.find((item) => String(item._id) === String(bulkItemId || "")) ||
      null,
    [items, bulkItemId],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const itemGroupId = String(item.group?._id || item.groupId || "");
      if (
        updateMode === "group" &&
        bulkGroupId &&
        itemGroupId !== String(bulkGroupId)
      )
        return false;
      if (
        updateMode === "item" &&
        bulkItemId &&
        String(item._id) !== String(bulkItemId)
      )
        return false;
      return `${item.name} ${item.group?.name || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [items, search, bulkGroupId, bulkItemId, updateMode]);

  const hasUpcomingRateView = useMemo(() => {
    const previewIsUpcoming =
      bulkRate !== "" &&
      normalizeDateKey(effectiveFrom) &&
      normalizeDateKey(asOnDate) &&
      normalizeDateKey(effectiveFrom) > normalizeDateKey(asOnDate);

    if (previewIsUpcoming) return true;

    return rows.some((item) =>
      Boolean(
        resolveNextPriceAfterDate(item, selectedPriceLevel?._id, asOnDate),
      ),
    );
  }, [rows, selectedPriceLevel?._id, bulkRate, effectiveFrom, asOnDate]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold text-slate-900">
            Alter Item Prices
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Update price lists in bulk and make the revised rate effective from
            the selected date.
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

          <div className="mt-6 grid gap-4 md:grid-cols-6">
            {/* Update Mode */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Select Mode
              </label>

              <select
                value={updateMode}
                onChange={(e) => setUpdateMode(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="group">Group-wise update</option>
                <option value="item">Single item update</option>
              </select>
            </div>

            {/* Group / Item */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                {updateMode === "group" ? "Select Group" : "Select Item"}
              </label>

              {updateMode === "group" ? (
                <SearchableSelect
                  className="w-full"
                  inputClassName="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={bulkGroupId}
                  onChange={(newValue) => {
                    setBulkGroupId(newValue);
                    setBulkItemId("");
                  }}
                  placeholder="Select Group"
                  options={groups.map((group) => ({
                    value: String(group.id || group._id),
                    label: group.name,
                  }))}
                />
              ) : (
                <SearchableSelect
                  className="w-full"
                  inputClassName="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={bulkItemId}
                  onChange={(newValue) => {
                    setBulkItemId(newValue);

                    const linkedItem = items.find(
                      (item) => String(item._id) === String(newValue),
                    );

                    if (linkedItem) {
                      setBulkGroupId(
                        String(
                          linkedItem.group?._id || linkedItem.groupId || "",
                        ),
                      );
                    }
                  }}
                  placeholder="Select Item"
                  options={items.map((item) => ({
                    value: String(item._id),
                    label: item.group?.name
                      ? `${item.name} (${item.group.name})`
                      : item.name,
                  }))}
                />
              )}
            </div>

            {/* Price Level */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Price Level
              </label>

              <select
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={bulkPriceLevelId}
                onChange={(e) => setBulkPriceLevelId(e.target.value)}
              >
                <option value="">Select Price Level</option>
                {priceLevels.map((level) => (
                  <option key={level._id} value={level._id}>
                    {level.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Rate */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Rate
              </label>

              <input
                type="number"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Enter rate"
                value={bulkRate}
                onChange={(e) => setBulkRate(e.target.value)}
              />
            </div>

            {/* Applied From */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Applied From
              </label>

              <div className="relative">
                <CalendarRange className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" />

                <input
                  type="date"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
            </div>

            {/* Button (no label needed) */}
            <div className="flex items-end">
              <button
                type="button"
                className="h-12 w-full rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                onClick={bulkUpdate}
                disabled={loading}
              >
                {updateMode === "group" ? "Update Group" : "Update Item"}
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Price List - {selectedPriceLevel?.code || "MRP"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                As on: {formatDate(asOnDate)}
              </p>
              {selectedGroup ? (
                <p className="mt-1 text-xs font-medium text-emerald-600">
                  Group filter: {selectedGroup.name}
                </p>
              ) : null}
              {selectedItem ? (
                <p className="mt-1 text-xs font-medium text-blue-600">
                  Item filter: {selectedItem.name}
                </p>
              ) : null}
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
                  {hasUpcomingRateView ? (
                    <>
                      <th className="px-4 py-3 text-right font-medium">
                        Current Rate
                      </th>
                      <th className="px-4 py-3 font-medium">As on</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Updated Rate
                      </th>
                      <th className="px-4 py-3 font-medium">Effective From</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Effective From</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right font-medium">
                    Cost Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => {
                  const currentEntry = resolvePriceForDate(
                    item,
                    selectedPriceLevel?._id,
                    asOnDate,
                  );
                  const savedUpcomingEntry = resolveNextPriceAfterDate(
                    item,
                    selectedPriceLevel?._id,
                    asOnDate,
                  );
                  const isPreviewTargetedGroup =
                    bulkGroupId &&
                    String(item.group?._id || item.groupId || "") ===
                      String(bulkGroupId);
                  const previewIsUpcoming =
                    bulkRate !== "" &&
                    (updateMode === "group"
                      ? isPreviewTargetedGroup
                      : String(item._id) === String(bulkItemId || "")) &&
                    normalizeDateKey(effectiveFrom) >
                      normalizeDateKey(asOnDate);
                  const previewEntry =
                    previewIsUpcoming && bulkRate !== ""
                      ? {
                          rate: Number(bulkRate || 0),
                          effectiveFrom,
                        }
                      : null;

                  const upcomingEntry = previewEntry || savedUpcomingEntry;
                  const currentRate = Number(currentEntry?.rate || 0);
                  const upcomingRate = Number(upcomingEntry?.rate || 0);
                  const rowHasUpcoming =
                    hasUpcomingRateView &&
                    upcomingEntry &&
                    normalizeDateKey(upcomingEntry.effectiveFrom);

                  return (
                    <tr key={item._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-blue-700">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {item.group?.name || "- -"}
                      </td>
                      {hasUpcomingRateView ? (
                        <>
                          <td className="px-4 py-3 text-right text-slate-800">
                            {rowHasUpcoming ? formatMoney(currentRate) : "- -"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {rowHasUpcoming
                              ? currentEntry?.effectiveFrom
                                ? formatDate(currentEntry.effectiveFrom)
                                : "Opening / Legacy"
                              : "- -"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-800">
                            {rowHasUpcoming ? (
                              <span className="font-semibold text-emerald-600">
                                {formatMoney(upcomingRate)}
                              </span>
                            ) : (
                              "- -"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {rowHasUpcoming
                              ? formatDate(upcomingEntry.effectiveFrom)
                              : currentEntry?.effectiveFrom
                                ? formatDate(currentEntry.effectiveFrom)
                                : "- -"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right text-slate-800">
                            {formatMoney(currentRate)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {currentEntry?.effectiveFrom
                              ? formatDate(currentEntry.effectiveFrom)
                              : "Opening / Legacy"}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatMoney(item.lastPurchaseRate ?? item.openingRate)}
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
