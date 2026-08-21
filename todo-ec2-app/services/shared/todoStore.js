const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.TABLE_NAME || "todos";
const REGION = process.env.AWS_REGION || "us-east-1";

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_CATEGORIES = ["general", "work", "personal", "shopping"];

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

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

module.exports = {
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
};
