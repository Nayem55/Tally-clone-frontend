import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import api, { SESSION_EXPIRED_NOTICE_KEY } from "../api/api";
import {
  STORAGE_KEY,
  useActiveCompany,
} from "../Contexts/ActiveCompanyContext";
import SearchableSelect from "../Component/SearchableSelect";
import {
  EMPLOYEE_SESSION_TOKEN_KEY,
  readStoredSessionToken,
} from "../utils/accessControl";

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem("pos-user");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export default function EmployeeLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCompanyId } = useActiveCompany();
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [needsEmployeeLogin, setNeedsEmployeeLogin] = useState(false);
  const [loginEmployees, setLoginEmployees] = useState([]);
  const [form, setForm] = useState(() => ({
    companyId: "",
    username: "",
    password: "",
  }));

  const storedUser = useMemo(readStoredUser, []);
  const storedToken = useMemo(readStoredSessionToken, []);
  const targetPath = location.state?.from?.pathname || "/";
  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        value: company._id,
        label: company.name,
      })),
    [companies],
  );
  const selectedEmployee = useMemo(
    () =>
      loginEmployees.find(
        (employee) =>
          String(employee.accessControl?.username || "").toLowerCase() ===
          String(form.username || "").toLowerCase(),
      ) || null,
    [form.username, loginEmployees],
  );

  useEffect(() => {
    window.localStorage.removeItem("pos-user");
    window.localStorage.removeItem("attendance-user");
    window.localStorage.removeItem(EMPLOYEE_SESSION_TOKEN_KEY);
    const expiredNotice =
      window.sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) || "";
    if (expiredNotice) {
      setInfoMessage(expiredNotice);
      window.sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
    }

    async function loadCompanies() {
      setLoadingCompanies(true);
      try {
        const response = await api.get("/companies", {
          preserveCompanyId: true,
        });
        const rows = response.data || [];
        setCompanies(rows);
      } catch (error) {
        setErrorMessage("Unable to load companies right now.");
      } finally {
        setLoadingCompanies(false);
      }
    }
    loadCompanies();
  }, []);

  if (
    storedUser &&
    storedToken &&
    String(storedUser.companyId || "") ===
      String(window.localStorage.getItem(STORAGE_KEY) || "")
  ) {
    return <Navigate to={targetPath} replace />;
  }

  async function handleOpenCompany(event) {
    event.preventDefault();
    if (!form.companyId) {
      setErrorMessage("Please select a company first.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const employeeResponse = await api.get(
        `/companies/${form.companyId}/employees`,
        { preserveCompanyId: true },
      );
      const employees = employeeResponse.data || [];
      const hasPasswordAdmin = employees.some(
        (employee) =>
          employee.accessControl?.loginEnabled &&
          employee.accessControl?.hasPassword &&
          String(employee.accessControl?.role || "").trim().toLowerCase() ===
            "admin" &&
          String(employee.accessControl?.username || "").trim() &&
          String(employee.accessControl?.status || "Active").trim().toLowerCase() !==
            "inactive",
      );

      if (!hasPasswordAdmin) {
        setCompanyId(String(form.companyId));
        window.localStorage.setItem(STORAGE_KEY, String(form.companyId));
        navigate(targetPath, { replace: true });
        return;
      }

      setLoginEmployees(
        employees.filter(
          (employee) =>
            employee.accessControl?.loginEnabled &&
            String(employee.accessControl?.username || "").trim() &&
            String(employee.accessControl?.status || "Active").trim().toLowerCase() !==
              "inactive",
        ),
      );
      setNeedsEmployeeLogin(true);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Unable to open company right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmployeeLogin(event) {
    event.preventDefault();
    if (!form.companyId || !form.username.trim()) {
      setErrorMessage("Please enter your username.");
      return;
    }
    if (selectedEmployee?.accessControl?.hasPassword && !form.password) {
      setErrorMessage("Password is required for this employee.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await api.post(
        `/companies/${form.companyId}/employee-authenticate`,
        {
          username: form.username,
          password: form.password,
        },
        { preserveCompanyId: true },
      );

      const user = response.data?.user;
      const token = String(response.data?.token || "");
      if (!user) {
        throw new Error("Employee login response is incomplete.");
      }
      if (!token) {
        throw new Error("Employee session token is missing.");
      }

      setCompanyId(String(form.companyId));
      window.localStorage.setItem(STORAGE_KEY, String(form.companyId));
      window.localStorage.setItem("pos-user", JSON.stringify(user));
      window.localStorage.setItem(EMPLOYEE_SESSION_TOKEN_KEY, token);
      window.localStorage.setItem(
        "attendance-user",
        JSON.stringify({
          _id: user.attendance_id || user.employeeId || user._id,
        }),
      );
      navigate(targetPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Unable to sign in right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Workspace Access
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Open Company
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Select a company first. If employee access is already set up there,
            we’ll ask for username and password next.
          </p>
        </div>

        {companies.length === 0 && !loadingCompanies ? (
          <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              No company found yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Create your first company to start the accounting workspace. After
              that, you can come back here and open it directly.
            </p>
            <div className="mt-4">
              <Link
                to="/login/create-company"
                className="inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create Company
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="mt-8 space-y-5"
            onSubmit={
              needsEmployeeLogin ? handleEmployeeLogin : handleOpenCompany
            }
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Company
              </span>
              <SearchableSelect
                options={companyOptions}
                value={form.companyId}
                onChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    companyId: value,
                    username: "", // also clear credentials
                    password: "",
                  }));
                  setLoginEmployees([]);

                  // Reset to company selection mode when company changes
                  setNeedsEmployeeLogin(false);
                  setErrorMessage(""); // optional: clear previous errors
                }}
                placeholder="Search company"
                disabled={loadingCompanies}
                inputClassName="rounded-xl border border-slate-200 bg-white px-4 py-3 pl-9 pr-8 text-sm text-slate-900"
                className="rounded-xl"
                allowClear
              />
            </label>

            {needsEmployeeLogin ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Username
                  </span>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        username: event.target.value,
                        password: "",
                      }))
                    }
                    autoComplete="username"
                    placeholder="Enter username"
                  />
                </label>

                {selectedEmployee?.accessControl?.hasPassword ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Password
                    </span>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      autoComplete="current-password"
                      placeholder="Enter employee password"
                    />
                  </label>
                ) : selectedEmployee ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    This employee has no password saved. Continue to open the workspace.
                  </div>
                ) : null}
              </>
            ) : null}

            {errorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {infoMessage ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {infoMessage}
              </div>
            ) : null}

            <div className="flex gap-3">
              {needsEmployeeLogin ? (
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setNeedsEmployeeLogin(false);
                    setErrorMessage("");
                    setForm((current) => ({
                      ...current,
                      username: "",
                      password: "",
                    }));
                  }}
                >
                  Back
                </button>
              ) : null}
              <button
                type="submit"
                className="flex-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                disabled={submitting || loadingCompanies}
              >
                {submitting
                  ? needsEmployeeLogin
                    ? "Signing In..."
                    : "Opening..."
                  : needsEmployeeLogin
                    ? "Open Workspace"
                    : "Open Company"}
              </button>
            </div>

            {!needsEmployeeLogin ? (
              <div className="pt-2 text-center">
                <Link
                  to="/login/create-company"
                  className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  Create Company
                </Link>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
