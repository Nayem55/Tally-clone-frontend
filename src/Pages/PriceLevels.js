import { useEffect, useState } from "react";
import api from "../api/api";

export default function PriceLevels() {
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [levels, setLevels] = useState([]);

  const [form, setForm] = useState({
    id: "",
    code: "",
    name: ""
  });

  useEffect(() => {
    api.get("/companies").then(res => {
      setCompanies(res.data);
      if (res.data.length > 0) {
        setCompanyId((current) => current || res.data[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (companyId) loadLevels();
  }, [companyId]);

  const loadLevels = async () => {
    const res = await api.get(`/companies/${companyId}/price-levels`);
    setLevels(res.data);
  };

  const save = async () => {
    if (form.id) {
      await api.put(`/companies/${companyId}/price-levels/${form.id}`, form);
    } else {
      await api.post(`/companies/${companyId}/price-levels`, form);
    }
    setForm({ id: "", code: "", name: "" });
    loadLevels();
  };

  const deleteLevel = async (id) => {
    if (!window.confirm("Delete this price level?")) return;
    await api.delete(`/companies/${companyId}/price-levels/${id}`);
    loadLevels();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4 font-semibold">Price Levels</h1>

      {/* Select Company */}
      <select
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
        className="border p-2 mb-4"
      >
        <option value="">Select Company</option>
        {companies.map(c => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>

      {/* Form */}
      <div className="bg-white shadow p-4 rounded w-96 mb-6">
        <h2 className="font-semibold mb-3">
          {form.id ? "Alter Price Level" : "Create Price Level"}
        </h2>

        <input
          className="border p-2 w-full mb-2"
          placeholder="Price Level Code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />

        <input
          className="border p-2 w-full mb-4"
          placeholder="Display Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={save}
        >
          {form.id ? "Update" : "Create"}
        </button>
      </div>

      {/* Listing */}
      <table className="w-full border bg-white shadow">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2 border">Code</th>
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((l) => (
            <tr key={l._id}>
              <td className="border p-2">{l.code}</td>
              <td className="border p-2">{l.name}</td>
              <td className="border p-2">
                <button
                  className="text-blue-600 mr-3"
                  onClick={() => setForm({ id: l._id, code: l.code, name: l.name })}
                >
                  Edit
                </button>
                <button className="text-red-600" onClick={() => deleteLevel(l._id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}

          {levels.length === 0 && (
            <tr>
              <td colSpan="3" className="p-4 text-center text-gray-500">
                No price levels found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
