// server.js
// Express backend for the Todo app, designed to run on an EC2 instance.
// Serves BOTH the REST API (/api/todos) AND the built frontend (public/) from one server.
//
// Requires: an IAM role attached to this EC2 instance with DynamoDB access
// on the "todos" table (see README.md, Part 3).

const express = require("express");
const path = require("path");
const {
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const TABLE_NAME = process.env.TABLE_NAME || "todos";
const REGION = process.env.AWS_REGION || "us-east-1";

// The SDK automatically picks up credentials from the EC2 instance's IAM role
// — no access keys needed on the server itself.
const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

app.use(express.json());

// ---- API routes ----

app.get("/api/todos", async (req, res) => {
  try {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
    const items = (result.Items || []).sort((a, b) => a.createdAt - b.createdAt);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error listing todos", error: err.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "'text' is required" });
    }
    const item = { id: randomUUID(), text, done: false, createdAt: Date.now() };
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
    res.json(result.Attributes);
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

// ---- Serve the built frontend ----
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Todo server running on port ${PORT}`);
});
