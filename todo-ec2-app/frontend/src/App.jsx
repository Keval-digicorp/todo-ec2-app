import { useEffect, useState } from "react";
import { api } from "./api";

// Change this when testing frontend deploy — should appear on S3 after CodePipeline runs.
const FRONTEND_DEPLOY_VERSION = "frontend-v2-full-stack-test";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backendVersion, setBackendVersion] = useState("");

  useEffect(() => {
    load();
    api.health()
      .then((data) => setBackendVersion(data.deployVersion || data.message || "unknown"))
      .catch(() => setBackendVersion("unreachable"));
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await api.list();
      setTodos(data);
      setError("");
    } catch (e) {
      setError("Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const newTodo = await api.create(text.trim());
    setTodos((prev) => [...prev, newTodo]);
    setText("");
  }

  async function toggleDone(todo) {
    const updated = await api.update(todo.id, { done: !todo.done });
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
  }

  async function removeTodo(id) {
    await api.remove(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.deployBanner}>
          <strong>Deploy test v2</strong> — push to GitHub → CodePipeline updates both
        </div>

        <h1 style={styles.title}>Todo App — Full Stack Test</h1>
        <p style={styles.subtitle}>React (S3) + Express (EC2) → DynamoDB</p>

        <div style={styles.versionBox}>
          <p style={styles.versionLine}>
            <span style={styles.badgeFrontend}>FRONTEND</span>
            {FRONTEND_DEPLOY_VERSION} (S3)
          </p>
          <p style={styles.versionLine}>
            <span style={styles.badgeBackend}>BACKEND</span>
            {backendVersion || "loading…"} (EC2)
          </p>
        </div>

        <form onSubmit={addTodo} style={styles.form}>
          <input
            style={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to doing?"
          />
          <button style={styles.addBtn} type="submit">Add</button>
        </form>

        {error && <p style={styles.error}>{error}</p>}
        {loading && <p style={styles.muted}>Loading…</p>}

        <ul style={styles.list}>
          {todos.map((todo) => (
            <li key={todo.id} style={styles.item}>
              <label style={styles.itemLabel}>
                <input type="checkbox" checked={todo.done} onChange={() => toggleDone(todo)} />
                <span style={{ ...styles.itemText, ...(todo.done ? styles.done : {}) }}>
                  {todo.text}
                </span>
              </label>
              <button style={styles.removeBtn} onClick={() => removeTodo(todo.id)}>✕</button>
            </li>
          ))}
        </ul>

        {!loading && todos.length === 0 && !error && (
          <p style={styles.muted}>No todos yet — add your first one above.</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "60px", background: "#0c4a6e", fontFamily: "system-ui, sans-serif" },
  card: { background: "#1e293b", padding: "32px", borderRadius: "12px", width: "460px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", border: "2px solid #10b981" },
  deployBanner: { background: "#065f46", color: "#6ee7b7", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px", textAlign: "center" },
  versionBox: { background: "#0f172a", padding: "12px", borderRadius: "8px", marginBottom: "16px" },
  versionLine: { color: "#e2e8f0", fontSize: "13px", margin: "6px 0", display: "flex", alignItems: "center", gap: "8px" },
  badgeFrontend: { background: "#6366f1", color: "white", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px" },
  badgeBackend: { background: "#f59e0b", color: "#1e293b", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px" },
  title: { color: "#f8fafc", margin: 0, fontSize: "24px" },
  subtitle: { color: "#94a3b8", fontSize: "13px", marginTop: "4px", marginBottom: "20px" },
  form: { display: "flex", gap: "8px", marginBottom: "16px" },
  input: { flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid #334155", background: "#0f172a", color: "#f8fafc" },
  addBtn: { padding: "10px 16px", borderRadius: "8px", border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" },
  item: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f172a", padding: "10px 12px", borderRadius: "8px" },
  itemLabel: { display: "flex", alignItems: "center", gap: "10px", color: "#e2e8f0" },
  itemText: { fontSize: "14px" },
  done: { textDecoration: "line-through", color: "#64748b" },
  removeBtn: { background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px" },
  muted: { color: "#64748b", fontSize: "14px" },
  error: { color: "#f87171", fontSize: "13px" },
};
