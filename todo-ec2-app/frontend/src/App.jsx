import { useEffect, useState } from "react";
import { api } from "./api";

const FRONTEND_DEPLOY_VERSION = "frontend-v4-microservices";
const PRIORITIES = ["low", "medium", "high"];
const CATEGORIES = ["general", "work", "personal", "shopping"];
const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Active" },
  { key: "done", label: "Done" },
];

const priorityColor = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

export default function App() {
  const [todos, setTodos] = useState([]);
  const [stats, setStats] = useState(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [dueDate, setDueDate] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [services, setServices] = useState({ todos: null, analytics: null });

  useEffect(() => {
    refresh();
  }, [statusFilter]);

  async function refresh() {
    try {
      setLoading(true);
      setError("");
      const filters = statusFilter === "all" ? {} : { status: statusFilter };
      const [todoData, statsData, health] = await Promise.all([
        api.list(filters),
        api.stats(),
        api.health(),
      ]);
      setTodos(todoData);
      setStats(statsData);
      setServices(health);
    } catch {
      setError("Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    if (!search.trim()) return refresh();
    try {
      setLoading(true);
      const result = await api.search(search.trim());
      setTodos(result.items);
      setError("");
    } catch {
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const newTodo = await api.create({
      text: text.trim(),
      priority,
      category,
      dueDate: dueDate || null,
      notes: notes.trim(),
    });
    setTodos((prev) => [...prev, newTodo]);
    setText("");
    setNotes("");
    setDueDate("");
    await refreshStats();
  }

  async function refreshStats() {
    try {
      setStats(await api.stats());
    } catch {
      /* stats refresh is best-effort */
    }
  }

  async function toggleDone(todo) {
    const updated = await api.update(todo.id, { done: !todo.done });
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    await refreshStats();
  }

  async function removeTodo(id) {
    await api.remove(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await refreshStats();
  }

  async function handleCompleteAll() {
    await api.completeAll();
    await refresh();
  }

  async function handleClearCompleted() {
    await api.clearCompleted();
    await refresh();
  }

  function isOverdue(todo) {
    return !todo.done && todo.dueDate && new Date(todo.dueDate) < new Date();
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Todo App — Microservices</h1>
        <p style={styles.subtitle}>2 backend services on EC2 · 1 frontend on S3</p>

        <div style={styles.versionBox}>
          <p style={styles.versionLine}>
            <span style={styles.badgeFrontend}>FRONTEND</span> {FRONTEND_DEPLOY_VERSION} (S3)
          </p>
          <p style={styles.versionLine}>
            <span style={styles.badgeBackend}>TODOS API</span>
            :3000 — {services.todos?.deployVersion || services.todos?.status || "…"}
          </p>
          <p style={styles.versionLine}>
            <span style={styles.badgeAnalytics}>ANALYTICS API</span>
            :3001 — {services.analytics?.deployVersion || services.analytics?.status || "…"}
          </p>
        </div>

        {stats && (
          <div style={styles.statsGrid}>
            <Stat label="Total" value={stats.total} color="#6366f1" />
            <Stat label="Active" value={stats.pending} color="#f59e0b" />
            <Stat label="Done" value={stats.done} color="#22c55e" />
            <Stat label="Overdue" value={stats.overdue} color="#ef4444" />
          </div>
        )}

        <form onSubmit={runSearch} style={styles.searchRow}>
          <input
            style={styles.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search todos (text, notes, category)…"
          />
          <button style={styles.secondaryBtn} type="submit">Search</button>
          {search && (
            <button style={styles.linkBtn} type="button" onClick={() => { setSearch(""); refresh(); }}>
              Clear
            </button>
          )}
        </form>

        <div style={styles.filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              style={{
                ...styles.filterBtn,
                ...(statusFilter === f.key ? styles.filterBtnActive : {}),
              }}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <form onSubmit={addTodo} style={styles.addForm}>
          <input
            style={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs doing?"
          />
          <div style={styles.addMeta}>
            <select style={styles.select} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select style={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              style={styles.dateInput}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <input
            style={styles.input}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
          />
          <button style={styles.addBtn} type="submit">Add todo</button>
        </form>

        <div style={styles.bulkRow}>
          <button style={styles.secondaryBtn} type="button" onClick={handleCompleteAll}>
            Complete all active
          </button>
          <button style={styles.dangerBtn} type="button" onClick={handleClearCompleted}>
            Clear completed
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {loading && <p style={styles.muted}>Loading…</p>}

        <ul style={styles.list}>
          {todos.map((todo) => (
            <li key={todo.id} style={{ ...styles.item, ...(isOverdue(todo) ? styles.overdueItem : {}) }}>
              <div style={styles.itemMain}>
                <label style={styles.itemLabel}>
                  <input type="checkbox" checked={todo.done} onChange={() => toggleDone(todo)} />
                  <span style={{ ...styles.itemText, ...(todo.done ? styles.done : {}) }}>
                    {todo.text}
                  </span>
                </label>
                <div style={styles.tags}>
                  <span style={{ ...styles.tag, background: priorityColor[todo.priority] }}>
                    {todo.priority}
                  </span>
                  <span style={styles.tagMuted}>{todo.category}</span>
                  {todo.dueDate && (
                    <span style={isOverdue(todo) ? styles.overdueDate : styles.tagMuted}>
                      {todo.dueDate}
                    </span>
                  )}
                </div>
                {todo.notes && <p style={styles.notes}>{todo.notes}</p>}
              </div>
              <button style={styles.removeBtn} onClick={() => removeTodo(todo.id)}>✕</button>
            </li>
          ))}
        </ul>

        {!loading && todos.length === 0 && !error && (
          <p style={styles.muted}>No todos match your filter.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={styles.statBox}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "40px 16px",
    background: "#0c4a6e",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#1e293b",
    padding: "28px",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
    border: "2px solid #6366f1",
  },
  title: { color: "#f8fafc", margin: 0, fontSize: "22px" },
  subtitle: { color: "#94a3b8", fontSize: "13px", marginTop: "4px", marginBottom: "16px" },
  versionBox: { color: "#94a3b8", fontSize: "12px", marginBottom: "16px" },
  badgeFrontend: {
    background: "#6366f1", color: "white", fontSize: "10px", fontWeight: 700,
    padding: "2px 5px", borderRadius: "4px", marginRight: "4px",
  },
  badgeBackend: {
    background: "#f59e0b", color: "#1e293b", fontSize: "10px", fontWeight: 700,
    padding: "2px 5px", borderRadius: "4px", marginRight: "4px",
  },
  badgeAnalytics: {
    background: "#ec4899", color: "white", fontSize: "10px", fontWeight: 700,
    padding: "2px 5px", borderRadius: "4px", marginRight: "4px",
  },
  versionLine: { color: "#e2e8f0", fontSize: "12px", margin: "4px 0" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" },
  statBox: { background: "#0f172a", borderRadius: "8px", padding: "10px", textAlign: "center" },
  statValue: { fontSize: "20px", fontWeight: 700 },
  statLabel: { color: "#64748b", fontSize: "11px", marginTop: "2px" },
  searchRow: { display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" },
  filterRow: { display: "flex", gap: "8px", marginBottom: "16px" },
  filterBtn: {
    padding: "6px 12px", borderRadius: "999px", border: "1px solid #334155",
    background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "13px",
  },
  filterBtnActive: { background: "#6366f1", color: "white", borderColor: "#6366f1" },
  addForm: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" },
  addMeta: { display: "flex", gap: "8px", flexWrap: "wrap" },
  select: {
    flex: 1, minWidth: "90px", padding: "8px", borderRadius: "8px",
    border: "1px solid #334155", background: "#0f172a", color: "#f8fafc",
  },
  dateInput: {
    flex: 1, minWidth: "130px", padding: "8px", borderRadius: "8px",
    border: "1px solid #334155", background: "#0f172a", color: "#f8fafc",
  },
  input: {
    flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid #334155",
    background: "#0f172a", color: "#f8fafc", minWidth: "120px",
  },
  addBtn: {
    padding: "10px 16px", borderRadius: "8px", border: "none",
    background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600,
  },
  secondaryBtn: {
    padding: "8px 12px", borderRadius: "8px", border: "1px solid #475569",
    background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: "13px",
  },
  dangerBtn: {
    padding: "8px 12px", borderRadius: "8px", border: "none",
    background: "#7f1d1d", color: "#fecaca", cursor: "pointer", fontSize: "13px",
  },
  linkBtn: {
    padding: "8px 12px", borderRadius: "8px", border: "none",
    background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "13px",
  },
  bulkRow: { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" },
  item: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    background: "#0f172a", padding: "12px", borderRadius: "8px", gap: "8px",
  },
  overdueItem: { border: "1px solid #ef4444" },
  itemMain: { flex: 1 },
  itemLabel: { display: "flex", alignItems: "center", gap: "10px", color: "#e2e8f0" },
  itemText: { fontSize: "14px" },
  done: { textDecoration: "line-through", color: "#64748b" },
  tags: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" },
  tag: { fontSize: "10px", fontWeight: 700, color: "white", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" },
  tagMuted: { fontSize: "11px", color: "#64748b", background: "#1e293b", padding: "2px 6px", borderRadius: "4px" },
  overdueDate: { fontSize: "11px", color: "#ef4444", background: "#450a0a", padding: "2px 6px", borderRadius: "4px" },
  notes: { margin: "6px 0 0", fontSize: "12px", color: "#94a3b8" },
  removeBtn: { background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px" },
  muted: { color: "#64748b", fontSize: "14px" },
  error: { color: "#f87171", fontSize: "13px" },
};
