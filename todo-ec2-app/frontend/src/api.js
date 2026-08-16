// Since Express serves both the API and this frontend from the same origin,
// we use relative paths — no need for an env var pointing to a separate API URL.
async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  list: () => request("/api/todos"),
  create: (text) => request("/api/todos", { method: "POST", body: JSON.stringify({ text }) }),
  update: (id, patch) => request(`/api/todos/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  remove: (id) => request(`/api/todos/${id}`, { method: "DELETE" }),
};
