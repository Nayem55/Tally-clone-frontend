import axios from "axios";

const defaultBaseUrl =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:15001`;

const api = axios.create({
  baseURL: defaultBaseUrl,
});

export default api;
