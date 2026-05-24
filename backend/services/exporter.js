function exportEntity(format, payload) {
  const now = new Date().toISOString();
  const title = payload.title || "Executive Control Center Export";

  if (format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      filename: safeName(`${title}.json`),
      body: JSON.stringify({ exportedAt: now, ...payload }, null, 2),
    };
  }

  if (format === "csv") {
    const rows = payload.rows || [];
    const headers = rows.length ? Object.keys(rows[0]) : ["title", "status"];
    const body = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")),
    ].join("\n");

    return {
      contentType: "text/csv; charset=utf-8",
      filename: safeName(`${title}.csv`),
      body,
    };
  }

  if (format === "doc") {
    const body = [
      "<!doctype html>",
      "<html><head><meta charset=\"utf-8\"><title>",
      escapeHtml(title),
      "</title></head><body>",
      `<h1>${escapeHtml(title)}</h1>`,
      `<p>Exported at: ${escapeHtml(now)}</p>`,
      `<pre style=\"white-space:pre-wrap;font-family:Segoe UI,Arial,sans-serif\">${escapeHtml(payload.content || JSON.stringify(payload, null, 2))}</pre>`,
      "</body></html>",
    ].join("");
    return {
      contentType: "application/msword; charset=utf-8",
      filename: safeName(`${title}.doc`),
      body,
    };
  }

  const html = [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><title>",
    escapeHtml(title),
    "</title><style>body{font-family:Segoe UI,Arial,sans-serif;line-height:1.55;padding:32px;color:#16202a}h1{font-size:24px}pre{white-space:pre-wrap;border:1px solid #d8dee6;padding:16px;border-radius:8px}</style></head><body>",
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>Exported at: ${escapeHtml(now)}</p>`,
    `<pre>${escapeHtml(payload.content || JSON.stringify(payload, null, 2))}</pre>`,
    "</body></html>",
  ].join("");

  return {
    contentType: "text/html; charset=utf-8",
    filename: safeName(`${title}.html`),
    body: html,
  };
}

function safeName(value) {
  return String(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  exportEntity,
};
