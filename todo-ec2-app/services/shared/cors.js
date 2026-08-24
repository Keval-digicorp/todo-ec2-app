// Allow frontend from S3 (HTTP) and CloudFront (HTTPS).
const ALLOWED_ORIGINS = [
  "http://keval-todo-app-files-2026.s3-website-us-east-1.amazonaws.com",
  "https://dgubys71735h4.cloudfront.net",
];

if (process.env.CORS_ORIGIN) {
  ALLOWED_ORIGINS.push(process.env.CORS_ORIGIN);
}

/** Reflect request origin when allowed — needed for S3 + CloudFront frontends. */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

module.exports = { corsMiddleware };
