import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/api";

export const STORAGE_KEY = "accubooks-active-company";
const ActiveCompanyContext = createContext(null);

export function ActiveCompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true);
      try {
        const response = await api.get("/companies");
        const rows = response.data || [];
        setCompanies(rows);
      } finally {
        setLoading(false);
      }
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    if (companies.length === 0) return;
    if (!companyId) {
      setCompanyId(companies[0]._id);
      return;
    }
    if (!companies.some((company) => company._id === companyId)) {
      setCompanyId(companies[0]._id);
    }
  }, [companies, companyId]);

  useEffect(() => {
    if (companyId) {
      localStorage.setItem(STORAGE_KEY, companyId);
    }
  }, [companyId]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      const nextValue = event.newValue || "";
      setCompanyId((current) => (current === nextValue ? current : nextValue));
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company._id === companyId) || null,
    [companies, companyId]
  );

  const value = useMemo(
    () => ({
      companies,
      companyId,
      setCompanyId,
      selectedCompany,
      loading,
    }),
    [companies, companyId, selectedCompany, loading]
  );

  return <ActiveCompanyContext.Provider value={value}>{children}</ActiveCompanyContext.Provider>;
}

export function useActiveCompany() {
  const context = useContext(ActiveCompanyContext);
  if (!context) {
    throw new Error("useActiveCompany must be used inside ActiveCompanyProvider");
  }
  return context;
}
