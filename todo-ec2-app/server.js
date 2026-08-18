// server.js
// Express API for the Todo app, running on EC2.
// The React frontend is hosted separately on S3; this server handles /api/todos only
// (still serves public/ as a fallback if you visit EC2:3000 directly).
//
// Requires: IAM role on this EC2 instance with DynamoDB access on the "todos" table.

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
const {
  SSMClient,
  GetParameterCommand,
} = require("@aws-sdk/client-ssm");

const app = express();
const PORT = process.env.PORT || 3000;
const TABLE_NAME = process.env.TABLE_NAME || "todos";
const REGION = process.env.AWS_REGION || "us-east-1";
// S3 website origin allowed to call this API (browser CORS check).
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  "http://keval-todo-app-files-2026.s3-website-us-east-1.amazonaws.com";

// The SDK automatically picks up credentials from the EC2 instance's IAM role
// — no access keys needed on the server itself.
const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

const ssmClient = new SSMClient({ region: REGION });

async function getSecret(name) {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter.Value;
}

app.use(express.json());

// CORS: browser blocks cross-origin requests unless the API explicitly allows the S3 URL.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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