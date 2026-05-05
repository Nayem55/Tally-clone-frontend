import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";

export default function CompanyPicker({
  companies,
  value,
  onChange,
  label = "Company",
  className = "",
}) {
  const { companyId: activeCompanyId, selectedCompany } = useActiveCompany();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeCompanyId || typeof onChange !== "function") return;
    if (String(value || "") !== String(activeCompanyId)) {
      onChange(activeCompanyId);
    }
  }, [activeCompanyId, onChange, value]);

  useEffect(() => {
    const selected = companies.find((company) => company._id === activeCompanyId) || selectedCompany;
    setQuery(selected?.name || "");
  }, [companies, activeCompanyId, selectedCompany]);

  return (
    <div className={`relative ${className}`}>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Building2 className="h-4 w-4 text-blue-600" />
        {label}
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
        {query || "No company selected"}
      </div>
    </div>
  );
}
