// Frontend lives on S3; API lives on EC2 — different origins, so we need the full EC2 URL.
const API_BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export const api = {
  health: () => request("/api/health"),
  stats: () => request("/api/todos/stats"),
  search: (q) => request(`/api/todos/search?q=${encodeURIComponent(q)}`),
  list: (filters = {}) => request(`/api/todos${toQuery(filters)}`),
  get: (id) => request(`/api/todos/${id}`),
  create: (payload) =>
    request("/api/todos", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, patch) =>
    request(`/api/todos/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  remove: (id) => request(`/api/todos/${id}`, { method: "DELETE" }),
  completeAll: () => request("/api/todos/bulk/complete-all", { method: "POST" }),
  clearCompleted: () => request("/api/todos/completed", { method: "DELETE" }),
};
