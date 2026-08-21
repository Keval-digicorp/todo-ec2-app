// Frontend calls TWO microservices on EC2 (different ports).
const TODOS_API = import.meta.env.VITE_TODOS_API_URL || import.meta.env.VITE_API_URL || "";
const ANALYTICS_API = import.meta.env.VITE_ANALYTICS_API_URL || "";

async function request(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
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
  health: async () => {
    const [todos, analytics] = await Promise.all([
      request(TODOS_API, "/api/health").catch(() => ({ status: "down", service: "todos-api" })),
      request(ANALYTICS_API, "/api/health").catch(() => ({ status: "down", service: "analytics-api" })),
    ]);
    return { todos, analytics };
  },
  stats: () => request(ANALYTICS_API, "/api/todos/stats"),
  search: (q) => request(ANALYTICS_API, `/api/todos/search?q=${encodeURIComponent(q)}`),
  list: (filters = {}) => request(TODOS_API, `/api/todos${toQuery(filters)}`),
  get: (id) => request(TODOS_API, `/api/todos/${id}`),
  create: (payload) =>
    request(TODOS_API, "/api/todos", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, patch) =>
    request(TODOS_API, `/api/todos/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  remove: (id) => request(TODOS_API, `/api/todos/${id}`, { method: "DELETE" }),
  completeAll: () => request(ANALYTICS_API, "/api/todos/bulk/complete-all", { method: "POST" }),
  clearCompleted: () => request(ANALYTICS_API, "/api/todos/completed", { method: "DELETE" }),
};
