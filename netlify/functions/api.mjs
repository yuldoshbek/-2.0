import { getDeployStore, getStore } from "@netlify/blobs";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export default async (request) => {
  const require = createRequire(import.meta.url);
  const { createDatabase } = require("../../backend/db");
  const { getConfig } = require("../../backend/config");
  const { handleApiRequest } = require("../../backend/api");
  const { createSeedData } = require("../../backend/seed");

  const dataFile = path.join(os.tmpdir(), "executive-control-center", "database.json");
  await hydrateDatabase(dataFile, createSeedData);
  process.env.DATA_FILE = dataFile;

  const config = getConfig();
  const db = createDatabase(config.dataFile);
  db.ensure();

  const before = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, "utf8") : "";
  const response = createResponseCapture();
  const requestUrl = new URL(request.url);

  await handleApiRequest(createNodeRequest(request), response, { db, config, requestUrl });

  const after = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, "utf8") : "";
  if (after && after !== before) {
    await persistDatabase(after);
  }

  return response.toWebResponse();
};

export const config = {
  path: "/api/*",
};

async function hydrateDatabase(dataFile, createSeedData) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });

  const store = getDatabaseStore();
  const stored = await store.get("database", { type: "json" });
  const data = stored || createSeedData();

  fs.writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function persistDatabase(jsonText) {
  const store = getDatabaseStore();
  await store.setJSON("database", JSON.parse(jsonText));
}

function getDatabaseStore() {
  const deployContext = globalThis.Netlify?.context?.deploy?.context || process.env.CONTEXT || "dev";

  if (deployContext === "production") {
    return getStore("ecc-data", { consistency: "strong" });
  }

  return getDeployStore("ecc-data");
}

function createNodeRequest(request) {
  let bodyBufferPromise = null;

  return {
    method: request.method,
    url: new URL(request.url).pathname + new URL(request.url).search,
    headers: Object.fromEntries(request.headers.entries()),
    async *[Symbol.asyncIterator]() {
      if (["GET", "HEAD"].includes(request.method)) return;
      bodyBufferPromise = bodyBufferPromise || request.arrayBuffer();
      const body = Buffer.from(await bodyBufferPromise);
      if (body.length) yield body;
    },
  };
}

function createResponseCapture() {
  const chunks = [];
  let status = 200;
  let headers = {};

  return {
    headersSent: false,
    writeHead(nextStatus, nextHeaders = {}) {
      status = nextStatus;
      headers = { ...headers, ...nextHeaders };
      this.headersSent = true;
    },
    write(chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    },
    end(chunk) {
      if (chunk) this.write(chunk);
    },
    toWebResponse() {
      return new Response(Buffer.concat(chunks), { status, headers });
    },
  };
}
