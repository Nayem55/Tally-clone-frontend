import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../api/api";
import { EMPLOYEE_SESSION_TOKEN_KEY } from "../utils/accessControl";

export const STORAGE_KEY = "accubooks-active-company";
const ActiveCompanyContext = createContext(null);

function clearEmployeeSession() {
  window.localStorage.removeItem("pos-user");
  window.localStorage.removeItem("attendance-user");
  window.localStorage.removeItem(EMPLOYEE_SESSION_TOKEN_KEY);
}

export function ActiveCompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(
    () => window.localStorage.getItem(STORAGE_KEY) || "",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true);
      try {
        const response = await api.get("/companies", { preserveCompanyId: true });
        const rows = response.data || [];
        setCompanies(rows);
      } finally {
        setLoading(false);
      }
    }
    loadCompanies();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company._id) === String(companyId)) || null,
    [companies, companyId],
  );

  useEffect(() => {
    if (loading || companies.length === 0) return;

    const currentCompany =
      companies.find((company) => String(company._id) === String(companyId)) || null;
    if (currentCompany) return;

    const storedCompanyId = window.localStorage.getItem(STORAGE_KEY) || "";
    const preferredCompany = storedCompanyId
      ? companies.find((company) => String(company._id) === String(storedCompanyId))
      : null;

    if (preferredCompany && String(companyId) !== String(preferredCompany._id)) {
      setCompanyId(String(preferredCompany._id));
      return;
    }

    if (!preferredCompany) {
      window.localStorage.removeItem(STORAGE_KEY);
      if (companyId) {
        setCompanyId("");
      }
    }
  }, [companies, companyId, loading]);

  useEffect(() => {
    if (!companyId) return;
    window.localStorage.setItem(STORAGE_KEY, companyId);
  }, [companyId]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      const nextValue = event.newValue || "";
      setCompanyId((current) => (String(current) === String(nextValue) ? current : nextValue));
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const requestCompanyChange = useCallback((nextCompanyId) => {
    const targetCompany =
      companies.find((company) => String(company._id) === String(nextCompanyId)) || null;
    if (!targetCompany) return;
    if (String(targetCompany._id) === String(companyId)) return;

    clearEmployeeSession();
    setCompanyId(String(targetCompany._id));
  }, [companies, companyId]);

  const value = useMemo(
    () => ({
      companies,
      companyId,
      setCompanyId,
      requestCompanyChange,
      selectedCompany,
      loading,
    }),
    [companies, companyId, requestCompanyChange, selectedCompany, loading],
  );

  return (
    <ActiveCompanyContext.Provider value={value}>
      {children}
    </ActiveCompanyContext.Provider>
  );
}

export function useActiveCompany() {
  const context = useContext(ActiveCompanyContext);
  if (!context) {
    throw new Error("useActiveCompany must be used inside ActiveCompanyProvider");
  }
  return context;
}
