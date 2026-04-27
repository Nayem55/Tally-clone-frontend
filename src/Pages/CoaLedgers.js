import { useEffect, useState } from "react";
import api from "../api/api";

export default function CoaLedgers() {
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
      if (res.data.length > 0) {
        setCompanyId((current) => current || res.data[0]._id);
        setSearchCompany((current) => current || res.data[0].name);
      }
    }
    load();
  }, []);

  // Load ledger tree
  useEffect(() => {
    if (!companyId) return;

    async function loadLedgers() {
      const res = await api.get(
        `/companies/${companyId}/chart-of-accounts/ledgers`
      );
      setRows(res.data);
    }

    loadLedgers();
  }, [companyId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Chart of Accounts – Ledgers
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
                    setDropdown(false);
                  }}
                >
                  {c.name}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Ledger List */}
      {companyId && (
        <div className="bg-white border rounded shadow p-2 text-sm">
          <div className="flex justify-between border-b px-2 py-2 bg-gray-100">
            <span className="font-semibold">List of Ledgers</span>
            <span className="text-xs text-gray-600">
              {rows.filter((r) => r.type === "group").length} Groups &nbsp; | &nbsp;
              {rows.filter((r) => r.type === "ledger").length} Ledgers
            </span>
          </div>

          {rows.map((r) => (
            <div
              key={r.id}
              className="py-1"
              style={{ paddingLeft: `${r.level * 20}px` }}
            >
              {r.type === "group" ? (
                <span className="font-semibold text-gray-700">{r.name}</span>
              ) : (
                <span className="text-gray-800">{r.name}</span>
              )}
            </div>
          ))}

          {rows.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No ledgers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
