import axios from "axios";
export const STORAGE_KEY = "accubooks-active-company";
export const EMPLOYEE_SESSION_TOKEN_KEY = "accubooks-employee-session-token";

const defaultBaseUrl =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:15001`;

const api = axios.create({
  baseURL: defaultBaseUrl,
});

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

export default api;
