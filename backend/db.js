const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createSeedData } = require("./seed");

const collectionPrefixes = {
  assignments: "A",
  employeeTasks: "ET",
  meetings: "M",
  meetingMinutes: "MIN",
  reports: "R",
  employeeReportForms: "ERF",
  letters: "L",
  complaints: "C",
  documents: "DOC",
  decisions: "DEC",
  risks: "K",
  reminders: "REM",
  knowledgeBase: "KB",
  approvals: "APR",
  audit: "AUD",
  workspaceLinks: "W",
  apiKeys: "KEY",
  aiUsage: "AIU",
};

function createDatabase(filePath) {
  function ensure() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      write(createSeedData());
    }
  }

  function read() {
    ensure();
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  function write(data) {
    data.meta = data.meta || {};
    data.meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  function list(collection, filters = {}) {
    const data = read();
    const items = data[collection] || [];
    return items.filter((item) => matches(item, filters));
  }

  function get(collection, id) {
    return list(collection).find((item) => item.id === id) || null;
  }

  function insert(collection, item, actor = "U-001") {
    const data = read();
    data[collection] = data[collection] || [];
    const now = new Date().toISOString();
    const record = {
      id: item.id || nextId(data[collection], collection),
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
    };
    data[collection].push(record);
    appendAudit(data, actor, `${collection}.created`, collection, record.id, record.title || record.subject || record.description || "");
    write(data);
    return record;
  }

  function update(collection, id, patch, actor = "U-001") {
    const data = read();
    data[collection] = data[collection] || [];
    const index = data[collection].findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = data[collection][index];
    const updated = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    data[collection][index] = updated;
    appendAudit(data, actor, `${collection}.updated`, collection, id, JSON.stringify(patch).slice(0, 500));
    write(data);
    return updated;
  }

  function remove(collection, id, actor = "U-001") {
    const data = read();
    data[collection] = data[collection] || [];
    const before = data[collection].length;
    data[collection] = data[collection].filter((item) => item.id !== id);
    const deleted = before !== data[collection].length;
    if (deleted) {
      appendAudit(data, actor, `${collection}.deleted`, collection, id, "");
      write(data);
    }
    return deleted;
  }

  function transaction(mutator, actor = "U-001", action = "transaction") {
    const data = read();
    const result = mutator(data);
    appendAudit(data, actor, action, "system", "ECC", "");
    write(data);
    return result;
  }

  return {
    ensure,
    filePath,
    get,
    insert,
    list,
    read,
    remove,
    transaction,
    update,
    write,
  };
}

function matches(item, filters) {
  return Object.entries(filters).every(([key, value]) => {
    if (value === undefined || value === null || value === "") return true;
    const current = item[key];
    if (Array.isArray(current)) return current.includes(value);
    return String(current).toLowerCase() === String(value).toLowerCase();
  });
}

function nextId(items, collection) {
  const prefix = collectionPrefixes[collection] || collection.slice(0, 3).toUpperCase();
  const max = items.reduce((result, item) => {
    const number = Number(String(item.id || "").replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(result, number) : result;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function appendAudit(data, actor, action, entityType, entityId, detail) {
  data.audit = data.audit || [];
  data.audit.push({
    id: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    at: new Date().toISOString(),
    actor,
    action,
    entityType,
    entityId,
    detail,
  });
}

module.exports = {
  createDatabase,
  nextId,
  appendAudit,
};
