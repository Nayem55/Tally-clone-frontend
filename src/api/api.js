import axios from "axios";
const STORAGE_KEY = "accubooks-active-company";

const defaultBaseUrl =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:15001`;

const api = axios.create({
  baseURL: defaultBaseUrl,
});

api.interceptors.request.use((config) => {
  const activeCompanyId = window.localStorage.getItem(STORAGE_KEY);
  const rawUser = window.localStorage.getItem("pos-user");
  const url = config.url || "";
  const nextHeaders = {
    ...(config.headers || {}),
  };

  if (rawUser) {
    nextHeaders["x-user-context"] = rawUser;
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
