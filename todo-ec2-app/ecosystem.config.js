// PM2 runs both microservices on EC2 — one process per service.
module.exports = {
  apps: [
    {
      name: "todos-api",
      cwd: "./services/todos-api",
      script: "server.js",
      env: { PORT: 3000, NODE_ENV: "production" },
    },
    {
      name: "analytics-api",
      cwd: "./services/analytics-api",
      script: "server.js",
      env: { PORT: 3001, NODE_ENV: "production" },
    },
  ],
};
