const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  "http://keval-todo-app-files-2026.s3-website-us-east-1.amazonaws.com";

/** CORS middleware — S3 frontend calls EC2 on a different origin. */
function corsMiddleware(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

module.exports = { corsMiddleware };
