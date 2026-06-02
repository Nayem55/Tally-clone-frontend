import axios from "axios";
export const STORAGE_KEY = "accubooks-active-company";
export const EMPLOYEE_SESSION_TOKEN_KEY = "accubooks-employee-session-token";
export const SESSION_EXPIRED_NOTICE_KEY = "accubooks-session-expired-notice";

const defaultBaseUrl =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:15001`;

const api = axios.create({
  baseURL: defaultBaseUrl,
});

function clearEmployeeSessionStorage() {
  window.localStorage.removeItem("pos-user");
  window.localStorage.removeItem("attendance-user");
  window.localStorage.removeItem(EMPLOYEE_SESSION_TOKEN_KEY);
}

function handleExpiredEmployeeSession() {
  window.sessionStorage.setItem(
    SESSION_EXPIRED_NOTICE_KEY,
    "Your session expired. Please sign in again to continue.",
  );
  clearEmployeeSessionStorage();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

api.interceptors.request.use((config) => {
  const activeCompanyId = window.localStorage.getItem(STORAGE_KEY);
  const rawUser = window.localStorage.getItem("pos-user");
  const sessionToken = window.localStorage.getItem(EMPLOYEE_SESSION_TOKEN_KEY);
  const url = config.url || "";
  const nextHeaders = {
    ...(config.headers || {}),
  };

  if (rawUser) {
    nextHeaders["x-user-context"] = rawUser;
  }

  if (sessionToken) {
    nextHeaders.Authorization = `Bearer ${sessionToken}`;
  }

  if (config.preserveCompanyId || !activeCompanyId || !url.startsWith("/companies/")) {
    return {
      ...config,
      headers: nextHeaders,
    };
  }

  const nextUrl = url.replace(/^\/companies\/[^/]+/, `/companies/${activeCompanyId}`);
  return {
    ...config,
    url: nextUrl,
    headers: nextHeaders,
  };
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const sessionToken = window.localStorage.getItem(EMPLOYEE_SESSION_TOKEN_KEY);
    if (status === 401 && sessionToken) {
      handleExpiredEmployeeSession();
      error.__sessionExpired = true;
    }
    return Promise.reject(error);
  },
);

export default api;
