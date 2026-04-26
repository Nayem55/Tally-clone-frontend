import { useEffect, useState } from "react";
import api from "../api/api";

export default function CoaStockGroups() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [searchCompany, setSearchCompany] = useState("");
  const [dropdown, setDropdown] = useState(false);

  const [rows, setRows] = useState([]);

  // Load companies
  useEffect(() => {
    async function load() {
      const res = await api.get("/companies");
      setCompanies(res.data);
    }
    load();
  }, []);

  // Load hierarchical stock groups
  useEffect(() => {
    if (!companyId) return;

    async function loadGroups() {
      const res = await api.get(
        `/companies/${companyId}/chart-of-accounts/stock-groups`
      );
      setRows(res.data);
    }

    loadGroups();
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Chart of Accounts – Stock Groups
      </h1>

      {/* Company Picker */}
      <div className="mb-4 relative w-80">
        <label className="block mb-1 font-medium">Select Company</label>
        <input
          className="border p-2 w-full"
          placeholder="Search company..."
          value={searchCompany}
          onFocus={() => setDropdown(true)}
          onChange={(e) => {
            setSearchCompany(e.target.value);
            setDropdown(true);
          }}
        />

        {dropdown && (
          <div className="absolute bg-white shadow border w-full max-h-60 overflow-y-auto z-20">
            {companies
              .filter((c) =>
                c.name.toLowerCase().includes(searchCompany.toLowerCase())
              )
              .map((c) => (
                <div
                  key={c._id}
                  className="p-2 hover:bg-blue-100 cursor-pointer"
                  onClick={() => {
                    setCompanyId(c._id);
                    setSearchCompany(c.name);
                    setDropdown(false);
                  }}
                >
                  {c.name}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Group Tree */}
      {companyId && (
        <div className="bg-white border rounded shadow p-2 text-sm">
          <div className="flex justify-between px-2 py-2 border-b bg-gray-100">
            <span className="font-semibold">List of Stock Groups</span>
            <span className="text-xs text-gray-600">
              {rows.length} Stock Group(s)
            </span>
          </div>

          {rows.map((g) => (
            <div
              key={g.id}
              className="py-1"
              style={{ paddingLeft: `${g.level * 20}px` }}
            >
              <span className="font-semibold text-gray-800">{g.name}</span>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No stock groups found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
