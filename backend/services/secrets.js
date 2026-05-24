const crypto = require("crypto");

function encryptSecret(value, appSecret) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const key = deriveKey(appSecret);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  };
}

function decryptSecret(payload, appSecret) {
  if (!payload?.iv || !payload?.tag || !payload?.value) return "";
  const key = deriveKey(appSecret);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.value, "base64")), decipher.final()]).toString("utf8");
}

function maskSecret(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 8) return "****";
  return `${text.slice(0, 4)}****${text.slice(-4)}`;
}

function estimateTokens(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return Math.max(1, Math.ceil(text.length / 4));
}

function deriveKey(appSecret) {
  return crypto.createHash("sha256").update(String(appSecret || "local-secret")).digest();
}

module.exports = {
  decryptSecret,
  encryptSecret,
  estimateTokens,
  maskSecret,
};
