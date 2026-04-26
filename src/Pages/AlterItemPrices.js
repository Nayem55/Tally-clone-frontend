import { useEffect, useState } from "react";
import api from "../api/api";

export default function AlterItemPrices() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [itemData, setItemData] = useState(null);
  const [priceInputs, setPriceInputs] = useState({});
  const [loading, setLoading] = useState(false);

  // Bulk
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkPriceLevelId, setBulkPriceLevelId] = useState("");
  const [bulkRate, setBulkRate] = useState("");

  useEffect(() => {
    api.get("/companies").then((res) => setCompanies(res.data));
  }, []);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      api.get(`/companies/${companyId}/chart-of-accounts/stock-groups`),
      api.get(`/companies/${companyId}/items`),
      api.get(`/companies/${companyId}/price-levels`),
    ]).then(([g, i, p]) => {
      setGroups(g.data.filter((row) => row.type === "group"));
      setItems(i.data);
      setPriceLevels(p.data);
    });
  }, [companyId]);

  useEffect(() => {
    if (!selectedItem || !items.length) {
      setItemData(null);
      setPriceInputs({});
      return;
    }
    const item = items.find((i) => i._id === selectedItem);
    if (!item) return;
    setItemData(item);
    const map = {};
    (item.prices || []).forEach((p) => (map[p.priceLevelId] = p.rate));
    setPriceInputs(map);
  }, [selectedItem, items]);


  const bulkUpdate = async () => {
    if (!bulkGroupId || !bulkPriceLevelId || !bulkRate) {
      return alert("Fill all fields");
    }
    setLoading(true);
    console.log(bulkGroupId,bulkPriceLevelId,bulkRate)
    try {
      await api.put(`/companies/${companyId}/update-prices-by-group`, {
        groupId: bulkGroupId,
        priceLevelId: bulkPriceLevelId,
        rate: Number(bulkRate),
      });
      alert("Bulk update done!");
      setBulkRate("");
    } catch (err) {
      alert("Bulk update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Alter Item Prices</h1>

      <select
        className="border p-2 mb-6"
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
      >
        <option value="">Select Company</option>
        {companies.map((c) => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>

      {companyId && (
        <>
          <div className="bg-white p-6 shadow rounded">
            <h2 className="text-xl font-bold mb-4">Bulk Update</h2>
            <select
              className="border p-2 mr-2"
              value={bulkGroupId}
              onChange={(e) => setBulkGroupId(e.target.value)}
            >
              <option value="">Group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <select
              className="border p-2 mr-2"
              value={bulkPriceLevelId}
              onChange={(e) => setBulkPriceLevelId(e.target.value)}
            >
              <option value="">Price Level</option>
              {priceLevels.map((pl) => (
                <option key={pl._id} value={pl._id}>{pl.name}</option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Rate"
              className="border p-2 mr-2"
              value={bulkRate}
              onChange={(e) => setBulkRate(e.target.value)}
            />

            <button
              onClick={bulkUpdate}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-2 rounded"
            >
              Update Group
            </button>
          </div>
        </>
      )}
    </div>
  );
}
