import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, Search } from "lucide-react";

export default function CompanyPicker({
  companies,
  value,
  onChange,
  label = "Company",
  className = "",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value && companies.length > 0) {
      onChange(companies[0]._id);
      setQuery(companies[0].name);
      return;
    }

    const selected = companies.find((company) => company._id === value);
    if (selected) {
      setQuery(selected.name);
    }
  }, [companies, value, onChange]);

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return companies;
    return companies.filter((company) =>
      company.name.toLowerCase().includes(normalizedQuery)
    );
  }, [companies, query]);

  return (
    <div className={`relative ${className}`}>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Building2 className="h-4 w-4 text-blue-600" />
        {label}
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Search company..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
      </div>

      {open && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
          {filteredCompanies.map((company) => (
            <button
              key={company._id}
              type="button"
              className={`flex w-full items-start justify-between rounded-lg px-3 py-2 text-left transition ${
                value === company._id
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => {
                onChange(company._id);
                setQuery(company.name);
                setOpen(false);
              }}
            >
              <span className="font-medium">{company.name}</span>
              {company.financialYearFrom && company.financialYearTo && (
                <span className="ml-4 whitespace-nowrap text-xs text-slate-400">
                  {company.financialYearFrom} to {company.financialYearTo}
                </span>
              )}
            </button>
          ))}

          {filteredCompanies.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No companies match this search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
