import { useState, useEffect } from "react";
import api from "../api/api";

export default function CompanyList() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ name: "", financialYearFrom: "", financialYearTo: "" });

  const load = async () => {
    const res = await api.get("/companies");
    setCompanies(res.data);
  };

  const create = async () => {
    await api.post("/companies", form);
    setForm({ name: "", financialYearFrom: "", financialYearTo: "" });
    load();
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Companies</h1>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg mb-2">Create Company</h2>
        <input
          className="border p-2 mr-2"
          placeholder="Company Name"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="border p-2 mr-2"
          type="date"
          onChange={e => setForm({ ...form, financialYearFrom: e.target.value })}
        />
        <input
          className="border p-2 mr-2"
          type="date"
          onChange={e => setForm({ ...form, financialYearTo: e.target.value })}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={create}>
          Create
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg mb-2">Existing Companies</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Financial Year</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c._id}>
                <td className="border p-2">{c.name}</td>
                <td className="border p-2">
                  {c.financialYearFrom} → {c.financialYearTo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
