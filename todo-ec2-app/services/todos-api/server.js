// Microservice 1 — Todo CRUD (runs on port 3000 via PM2)
const express = require("express");
const { randomUUID } = require("crypto");
const { corsMiddleware } = require("../shared/cors");
const {
  ddb,
  TABLE_NAME,
  normalizeTodo,
  scanTodos,
  parsePriority,
  parseCategory,
  applyListFilters,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require("../shared/todoStore");

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE = "todos-api";
const DEPLOY_VERSION = "microservices-v1";

app.use(express.json());
app.use(corsMiddleware);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: SERVICE,
    deployVersion: DEPLOY_VERSION,
    port: PORT,
    role: "CRUD — create, read, update, delete todos",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/todos", async (req, res) => {
  try {
    const items = applyListFilters(await scanTodos(), req.query);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error listing todos", error: err.message });
  }
});

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

app.listen(PORT, () => {
  console.log(`[${SERVICE}] running on port ${PORT}`);
});
