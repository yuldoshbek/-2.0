const http = require("http");
const path = require("path");
const { URL } = require("url");

const { loadEnv, getConfig } = require("./backend/config");
const { createDatabase } = require("./backend/db");
const { handleApiRequest } = require("./backend/api");
const { serveStatic } = require("./backend/static");

loadEnv();

const config = getConfig();
const db = createDatabase(config.dataFile);
db.ensure();

const publicDir = path.join(__dirname, "public");

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApiRequest(req, res, { db, config, requestUrl });
      return;
    }

    await serveStatic(req, res, publicDir);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ error: "Internal server error", detail: error.message }));
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Executive Control Center is running at http://${config.host}:${config.port}`);
});
