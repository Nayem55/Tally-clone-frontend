import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../api/api";

export const STORAGE_KEY = "accubooks-active-company";
const ActiveCompanyContext = createContext(null);

function CompanyLoginModal({
  open,
  company,
  credentials,
  setCredentials,
  onSubmit,
  onCancel,
  submitting,
  errorMessage,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [open, onCancel]);

  if (!open || !company) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Protected Company
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{company.name}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Enter the master username and password to open this company.
          </p>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Master Username
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={credentials.masterUsername}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  masterUsername: event.target.value,
                }))
              }
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Master Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={credentials.masterPassword}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  masterPassword: event.target.value,
                }))
              }
              autoComplete="off"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Opening..." : "Open Company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ActiveCompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(() => window.localStorage.getItem(STORAGE_KEY) || "");
  const [loading, setLoading] = useState(true);
  const [pendingCompanyId, setPendingCompanyId] = useState("");
  const [credentials, setCredentials] = useState({
    masterUsername: "",
    masterPassword: "",
  });
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [unlockedCompanyId, setUnlockedCompanyId] = useState(
    () => window.localStorage.getItem(STORAGE_KEY) || ""
  );

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

  const pendingCompany = useMemo(
    () => companies.find((company) => String(company._id) === String(pendingCompanyId)) || null,
    [companies, pendingCompanyId]
  );

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company._id) === String(companyId)) || null,
    [companies, companyId]
  );

  useEffect(() => {
    if (loading || companies.length === 0) return;
    if (pendingCompanyId) return;

    const currentCompany =
      companies.find((company) => String(company._id) === String(companyId)) || null;

    if (currentCompany) {
      if (
        currentCompany.requiresCompanyLogin &&
        String(unlockedCompanyId) !== String(currentCompany._id)
      ) {
        setPendingCompanyId(String(currentCompany._id));
        setAuthError("");
        setCredentials({
          masterUsername: currentCompany.masterUsername || "",
          masterPassword: "",
        });
      }
      return;
    }

    const storedCompanyId = window.localStorage.getItem(STORAGE_KEY) || "";
    const preferredCompany =
      companies.find((company) => String(company._id) === String(storedCompanyId)) || companies[0];
    if (preferredCompany && String(companyId) !== String(preferredCompany._id)) {
      setCompanyId(String(preferredCompany._id));
    }
  }, [companies, companyId, loading, pendingCompanyId, unlockedCompanyId]);

  useEffect(() => {
    if (!unlockedCompanyId) return;
    if (String(unlockedCompanyId) === String(companyId)) return;
    setUnlockedCompanyId("");
  }, [companyId, unlockedCompanyId]);

  useEffect(() => {
    if (companyId) {
      window.localStorage.setItem(STORAGE_KEY, companyId);
    }
  }, [companyId]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      const nextValue = event.newValue || "";
      const targetCompany =
        companies.find((company) => String(company._id) === String(nextValue)) || null;
      if (!targetCompany) {
        setPendingCompanyId("");
        return;
      }
      if (targetCompany?.requiresCompanyLogin) {
        setCompanyId(String(targetCompany._id));
        setUnlockedCompanyId("");
        setPendingCompanyId(String(targetCompany._id));
        setCredentials({
          masterUsername: targetCompany.masterUsername || "",
          masterPassword: "",
        });
        setAuthError("");
        return;
      }
      setPendingCompanyId("");
      setUnlockedCompanyId("");
      setCompanyId((current) => (String(current) === String(nextValue) ? current : nextValue));
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [companies]);

  const requestCompanyChange = useCallback((nextCompanyId) => {
    const targetCompany =
      companies.find((company) => String(company._id) === String(nextCompanyId)) || null;
    if (!targetCompany) return;
    if (String(targetCompany._id) === String(companyId)) return;

    setAuthError("");
    if (targetCompany.requiresCompanyLogin) {
      setPendingCompanyId(String(targetCompany._id));
      setCredentials({
        masterUsername: targetCompany.masterUsername || "",
        masterPassword: "",
      });
      return;
    }

    setPendingCompanyId("");
    setUnlockedCompanyId("");
    setCompanyId(String(targetCompany._id));
  }, [companies, companyId]);

  function cancelPendingCompany() {
    setPendingCompanyId("");
    setAuthError("");
    setCredentials({
      masterUsername: "",
      masterPassword: "",
    });
  }

  async function submitCompanyCredentials() {
    if (!pendingCompany) return;
    if (!credentials.masterUsername.trim() || !credentials.masterPassword) {
      setAuthError("Master username and password are required.");
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");
    try {
      await api.post(
        `/companies/${pendingCompany._id}/authenticate`,
        {
          masterUsername: credentials.masterUsername,
          masterPassword: credentials.masterPassword,
        },
        { preserveCompanyId: true }
      );
      setUnlockedCompanyId(String(pendingCompany._id));
      setCompanyId(String(pendingCompany._id));
      setPendingCompanyId("");
      setCredentials({
        masterUsername: "",
        masterPassword: "",
      });
    } catch (error) {
      setAuthError(error.response?.data?.message || "Unable to open company");
    } finally {
      setAuthSubmitting(false);
    }
  }

  const value = useMemo(
    () => ({
      companies,
      companyId,
      setCompanyId,
      requestCompanyChange,
      selectedCompany,
      loading,
    }),
    [companies, companyId, requestCompanyChange, selectedCompany, loading]
  );

  return (
    <ActiveCompanyContext.Provider value={value}>
      {children}
      <CompanyLoginModal
        open={Boolean(pendingCompanyId)}
        company={pendingCompany}
        credentials={credentials}
        setCredentials={setCredentials}
        onSubmit={submitCompanyCredentials}
        onCancel={cancelPendingCompany}
        submitting={authSubmitting}
        errorMessage={authError}
      />
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
