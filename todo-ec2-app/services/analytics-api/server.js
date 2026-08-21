// Microservice 2 — Stats, search, bulk actions (runs on port 3001 via PM2)
const express = require("express");
const { corsMiddleware } = require("../shared/cors");
const {
  ddb,
  TABLE_NAME,
  scanTodos,
  UpdateCommand,
  DeleteCommand,
} = require("../shared/todoStore");

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE = "analytics-api";
const DEPLOY_VERSION = "microservices-v1";

app.use(express.json());
app.use(corsMiddleware);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: SERVICE,
    deployVersion: DEPLOY_VERSION,
    port: PORT,
    role: "Analytics — stats, search, bulk complete/clear",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/todos/stats", async (req, res) => {
  try {
    const items = await scanTodos();
    const now = Date.now();
    const byPriority = { low: 0, medium: 0, high: 0 };
    const byCategory = {};

    for (const todo of items) {
      byPriority[todo.priority]++;
      byCategory[todo.category] = (byCategory[todo.category] || 0) + 1;
    }

    res.json({
      total: items.length,
      done: items.filter((t) => t.done).length,
      pending: items.filter((t) => !t.done).length,
      overdue: items.filter(
        (t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < now
      ).length,
      byPriority,
      byCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching stats", error: err.message });
  }
});

app.get("/api/todos/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    if (!q) return res.status(400).json({ message: "Query param 'q' is required" });

    const items = await scanTodos();
    const matches = items.filter(
      (t) =>
        t.text.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
    res.json({ query: q, count: matches.length, items: matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error searching todos", error: err.message });
  }
});

app.post("/api/todos/bulk/complete-all", async (req, res) => {
  try {
    const items = await scanTodos();
    const pending = items.filter((t) => !t.done);
    await Promise.all(
      pending.map((todo) =>
        ddb.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: todo.id },
            UpdateExpression: "SET #done = :done",
            ExpressionAttributeNames: { "#done": "done" },
            ExpressionAttributeValues: { ":done": true },
          })
        )
      )
    );
    res.json({ message: "All pending todos marked complete", updated: pending.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error completing todos", error: err.message });
  }
});

app.delete("/api/todos/completed", async (req, res) => {
  try {
    const items = await scanTodos();
    const completed = items.filter((t) => t.done);
    await Promise.all(
      completed.map((todo) =>
        ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id: todo.id } }))
      )
    );
    res.json({ message: "Completed todos cleared", deleted: completed.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error clearing completed todos", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[${SERVICE}] running on port ${PORT}`);
});
