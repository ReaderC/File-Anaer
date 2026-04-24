const API_BASE = window.__FILE_ANAER_CONFIG__?.apiBase ?? "";

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const isJSON = response.headers.get("content-type")?.includes("application/json");
  let body;
  if (isJSON) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  if (!response.ok) {
    throw new APIError(typeof body === "object" && body?.error ? body.error : "Request failed", response.status);
  }
  return body;
}

function buildURL(path) {
  return `${API_BASE}${path}`;
}

export const fetchHealth = () => request("/api/health");
export const fetchAuthStatus = () => request("/api/me");
export const fetchHistoryEntries = (store, limit = 10) =>
  request(`/api/history?store=${encodeURIComponent(store)}&limit=${limit}`);
export const fetchHistoryEntry = (store, id) =>
  request(`/api/history?store=${encodeURIComponent(store)}&id=${encodeURIComponent(id)}`);
export const saveHistoryEntry = (store, entry, limit = 10) =>
  request(`/api/history?store=${encodeURIComponent(store)}&limit=${limit}`, { method: "POST", body: JSON.stringify(entry) });
export const deleteHistoryEntry = (store, id, limit = 10) =>
  request(`/api/history?store=${encodeURIComponent(store)}&id=${encodeURIComponent(id)}&limit=${limit}`, { method: "DELETE" });
export const clearHistoryEntries = (store) =>
  request(`/api/history?store=${encodeURIComponent(store)}`, { method: "DELETE" });
export const fetchSettings = () => request("/api/settings");
export const updateSettings = (payload) => request("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
export const login = (payload) => request("/api/login", { method: "POST", body: JSON.stringify(payload) });
export const logout = () => request("/api/logout", { method: "POST" });
export const releaseRuntimeMemory = (payload = {}) =>
  request("/api/runtime/release", { method: "POST", body: JSON.stringify(payload) });
export function releaseRuntimeMemoryBeacon(payload = {}) {
  const url = `${API_BASE}/api/runtime/release`;
  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    return navigator.sendBeacon(url, blob);
  }
  if (typeof fetch === "function") {
    void fetch(url, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body
    }).catch(() => {});
    return true;
  }
  return false;
}
export const setupAuth = (payload) => request("/api/setup", { method: "POST", body: JSON.stringify(payload) });
export const updateCredentials = (payload) =>
  request("/api/account/credentials", { method: "POST", body: JSON.stringify(payload) });
export const fetchRoots = () => request("/api/roots");
export const fetchDirectories = (root, path, includeFiles = false) =>
  request(`/api/directories?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}&includeFiles=${includeFiles ? "true" : "false"}`);
export const fetchAnalyzeJob = (jobId) => request(`/api/analyze/${jobId}`);
export const createAnalyzeJob = (payload) =>
  request("/api/analyze", { method: "POST", body: JSON.stringify(payload) });
export const fetchAnalyzeTree = (payload) =>
  request("/api/analyze/tree", { method: "POST", body: JSON.stringify(payload) });
export const fetchDuplicateJob = (jobId) => request(`/api/duplicates/${jobId}`);
export const createDuplicateJob = (payload) =>
  request("/api/duplicates", { method: "POST", body: JSON.stringify(payload) });
export const cancelDuplicateJob = (jobId) => request(`/api/duplicates/${jobId}`, { method: "DELETE" });
export const runDuplicateAction = (payload) =>
  request("/api/duplicates/actions", { method: "POST", body: JSON.stringify(payload) });
export const undoDuplicateRenameAction = (payload) =>
  request("/api/duplicates/actions/undo-rename", { method: "POST", body: JSON.stringify(payload) });
export const refreshDuplicatePaths = (payload) =>
  request("/api/duplicates/refresh", { method: "POST", body: JSON.stringify(payload) });
export const fetchTextPreview = (root, path, limit = 65536, expanded = false) =>
  request(`/api/preview?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}&mode=text&limit=${limit}&expanded=${expanded ? "true" : "false"}`);
export const buildPreviewURL = (root, path) =>
  buildURL(`/api/preview?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`);
export const runSearch = (payload) =>
  request("/api/search", { method: "POST", body: JSON.stringify(payload) });
