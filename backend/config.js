const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").trim();
    }
  }
}

function getConfig() {
  return {
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 4173),
    dataFile: path.resolve(process.env.DATA_FILE || "data/database.json"),
    aiProvider: process.env.AI_PROVIDER || "mock",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    openaiApiBase: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    googleMode: process.env.GOOGLE_MODE || "mock",
  };
}

module.exports = {
  getConfig,
  loadEnv,
};
