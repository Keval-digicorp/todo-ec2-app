/**
 * DEPRECATED — monolith replaced by microservices.
 *
 * Use instead:
 *   services/todos-api/server.js      → port 3000 (CRUD)
 *   services/analytics-api/server.js  → port 3001 (stats, search, bulk)
 *
 * Start both: pm2 start ecosystem.config.js
 */
console.error(
  "server.js is deprecated. Run: pm2 start ecosystem.config.js"
);
process.exit(1);
