// server.js
// Express API for the Todo app, running on EC2.
// The React frontend is hosted separately on S3; this server handles /api/* routes
// (still serves public/ as a fallback if you visit EC2:3000 directly).
//
// Requires: IAM role on this EC2 instance with DynamoDB access on the "todos" table.

const express = require("express");
const path = require("path");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const app = express();
const PORT = process.env.PORT || 3000;
const TABLE_NAME = process.env.TABLE_NAME || "todos";
const REGION = process.env.AWS_REGION || "us-east-1";
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  "http://keval-todo-app-files-2026.s3-website-us-east-1.amazonaws.com";

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_CATEGORIES = ["general", "work", "personal", "shopping"];

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);
const ssmClient = new SSMClient({ region: REGION });

const DEPLOY_VERSION = "backend-v3-features";

async function getSecret(name) {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter.Value;
}

/** Fill defaults for todos created before v3 fields existed. */
function normalizeTodo(item) {
  return {
    id: item.id,
    text: item.text,
    done: !!item.done,
    priority: VALID_PRIORITIES.includes(item.priority) ? item.priority : "medium",
    category: VALID_CATEGORIES.includes(item.category) ? item.category : "general",
    dueDate: item.dueDate || null,
    notes: item.notes || "",
    createdAt: item.createdAt,
  };
}

async function scanTodos() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (result.Items || []).map(normalizeTodo).sort((a, b) => a.createdAt - b.createdAt);
}

function parsePriority(value) {
  return VALID_PRIORITIES.includes(value) ? value : "medium";
}

function parseCategory(value) {
  return VALID_CATEGORIES.includes(value) ? value : "general";
}

function applyListFilters(items, query) {
  let filtered = items;
  if (query.status === "done") filtered = filtered.filter((t) => t.done);
  if (query.status === "pending") filtered = filtered.filter((t) => !t.done);
  if (query.category) filtered = filtered.filter((t) => t.category === query.category);
  if (query.priority) filtered = filtered.filter((t) => t.priority === query.priority);
  return filtered;
}

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ---- API routes ----

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    deployVersion: DEPLOY_VERSION,
    message: "Backend v3 — stats, search, filters, bulk actions",
    features: ["stats", "search", "filters", "priority", "category", "dueDate", "bulk"],
    timestamp: new Date().toISOString(),
  });
});

/** Dashboard counts — NEW API */
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

/** Full-text search — NEW API */
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

/** Mark all pending todos done — NEW API */
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

/** Delete all completed todos — NEW API */
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

/** List with optional filters: ?status=pending&category=work&priority=high */
app.get("/api/todos", async (req, res) => {
  try {
    const items = applyListFilters(await scanTodos(), req.query);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error listing todos", error: err.message });
  }
});

/** Get single todo — NEW API */
app.get("/api/todos/:id", async (req, res) => {
  try {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { id: req.params.id } })
    );
    if (!result.Item) return res.status(404).json({ message: "Todo not found" });
    res.json(normalizeTodo(result.Item));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching todo", error: err.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { text, priority, category, dueDate, notes } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "'text' is required" });
    }

    const item = normalizeTodo({
      id: randomUUID(),
      text: text.trim(),
      done: false,
      priority: parsePriority(priority),
      category: parseCategory(category),
      dueDate: dueDate || null,
      notes: typeof notes === "string" ? notes.trim() : "",
      createdAt: Date.now(),
    });

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating todo", error: err.message });
  }
});

app.put("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateParts = [];
    const values = {};
    const names = {};

    if (typeof req.body.text === "string") {
      updateParts.push("#text = :text");
      names["#text"] = "text";
      values[":text"] = req.body.text;
    }
    if (typeof req.body.done === "boolean") {
      updateParts.push("#done = :done");
      names["#done"] = "done";
      values[":done"] = req.body.done;
    }
    if (req.body.priority !== undefined) {
      updateParts.push("#priority = :priority");
      names["#priority"] = "priority";
      values[":priority"] = parsePriority(req.body.priority);
    }
    if (req.body.category !== undefined) {
      updateParts.push("#category = :category");
      names["#category"] = "category";
      values[":category"] = parseCategory(req.body.category);
    }
    if (req.body.dueDate !== undefined) {
      updateParts.push("#dueDate = :dueDate");
      names["#dueDate"] = "dueDate";
      values[":dueDate"] = req.body.dueDate || null;
    }
    if (typeof req.body.notes === "string") {
      updateParts.push("#notes = :notes");
      names["#notes"] = "notes";
      values[":notes"] = req.body.notes;
    }
    if (updateParts.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: "SET " + updateParts.join(", "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );
    res.json(normalizeTodo(result.Attributes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating todo", error: err.message });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id: req.params.id } }));
    res.json({ message: "Deleted", id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting todo", error: err.message });
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function startServer() {
  try {
    const jwtSecret = await getSecret("/todo-app/JWT_SECRET");
    console.log("✅ Successfully fetched secret from SSM. First 4 chars:", jwtSecret.substring(0, 4) + "****");
  } catch (err) {
    console.error("❌ Failed to fetch secret from SSM:", err.message);
  }

  app.listen(PORT, () => {
    console.log(`Todo server running on port ${PORT}`);
  });
}

startServer();
