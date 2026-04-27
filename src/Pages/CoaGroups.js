import { useEffect, useState } from "react";
import api from "../api/api";

export default function CoaGroups() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [searchCompany, setSearchCompany] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [groups, setGroups] = useState([]);

  // Load companies once
  useEffect(() => {
    async function loadCompanies() {
      const res = await api.get("/companies");
      setCompanies(res.data);
      if (res.data.length > 0) {
        setCompanyId((current) => current || res.data[0]._id);
        setSearchCompany((current) => current || res.data[0].name);
      }
    }
    loadCompanies();
  }, []);

  // Load hierarchical groups when company changes
  useEffect(() => {
    if (!companyId) return;

    async function loadGroups() {
      const res = await api.get(
        `/companies/${companyId}/chart-of-accounts/groups`
      );
      setGroups(res.data);
    }

    loadGroups();
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Chart of Accounts - Groups
      </h1>

      {/* Company picker (searchable) */}
      <div className="mb-4 relative w-80">
        <label className="block mb-1 font-medium">Select Company</label>
        <input
          className="border p-2 w-full"
          placeholder="Search company..."
          value={searchCompany}
          onFocus={() => setDropdownOpen(true)}
          onChange={(e) => {
            setSearchCompany(e.target.value);
            setDropdownOpen(true);
          }}
        />

        {dropdownOpen && (
          <div className="absolute bg-white border shadow w-full max-h-60 overflow-y-auto z-20">
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
                    setDropdownOpen(false);
                  }}
                >
                  {c.name}
                </div>
              ))}

            {companies.length === 0 && (
              <div className="p-2 text-gray-500">No companies found</div>
            )}
          </div>
        )}
      </div>

      {/* Groups list */}
      {companyId && (
        <div className="bg-white border rounded shadow">
          <div className="border-b px-4 py-2 bg-gray-100 flex justify-between">
            <span className="font-semibold">List of Groups</span>
            <span className="text-sm text-gray-600">
              {groups.length} Group(s)
            </span>
          </div>

          <div className="p-2 text-sm">
            {groups.map((g) => (
              <div
                key={g._id}
                className="py-1"
                style={{ paddingLeft: `${g.level * 20}px` }}
              >
                <span
                  className={
                    g.level === 0
                      ? "font-semibold"
                      : g.level === 1
                      ? "font-medium"
                      : ""
                  }
                >
                  {g.name}
                </span>
              </div>
            ))}

            {groups.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                No groups found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
