// Frontend lives on S3; API lives on EC2 — different origins, so we need the full EC2 URL.
// Set VITE_API_URL in frontend/.env before running npm run build.
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

export const api = {
  list: () => request("/api/todos"),
  health: () => request("/api/health"),
  create: (text) => request("/api/todos", { method: "POST", body: JSON.stringify({ text }) }),
  update: (id, patch) => request(`/api/todos/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  remove: (id) => request(`/api/todos/${id}`, { method: "DELETE" }),
};
