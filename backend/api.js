const { runAiTask } = require("./services/ai");
const { createGoogleWorkspaceService } = require("./services/googleWorkspace");
const { exportEntity } = require("./services/exporter");
const { decryptSecret, encryptSecret, estimateTokens, maskSecret } = require("./services/secrets");

const collections = new Set([
  "modules",
  "users",
  "departments",
  "employees",
  "assignments",
  "employeeTasks",
  "meetings",
  "meetingMinutes",
  "reports",
  "reportTemplates",
  "employeeReportForms",
  "letters",
  "complaints",
  "documents",
  "decisions",
  "risks",
  "reminders",
  "knowledgeBase",
  "approvals",
  "workspaceLinks",
  "apiKeys",
  "aiUsage",
  "audit",
]);

const aliases = {
  "employee-tasks": "employeeTasks",
  "meeting-minutes": "meetingMinutes",
  "report-templates": "reportTemplates",
  "employee-report-forms": "employeeReportForms",
  "knowledge-base": "knowledgeBase",
  "workspace-links": "workspaceLinks",
  "api-keys": "apiKeys",
  "ai-usage": "aiUsage",
};

async function handleApiRequest(req, res, context) {
  const path = context.requestUrl.pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean);

  if (req.method === "OPTIONS") {
    send(res, 204, null);
    return;
  }

  if (!parts.length || parts[0] === "health") {
    sendJson(res, 200, { ok: true, product: "Executive Control Center", time: new Date().toISOString() });
    return;
  }

  if (parts[0] === "bootstrap" && req.method === "GET") {
    const data = context.db.read();
    sendJson(res, 200, {
      meta: data.meta,
      modules: data.modules,
      dashboard: buildDashboard(data),
      google: await createGoogleWorkspaceService(context.config).status(),
      resourceUsage: buildResourceUsage(data),
    });
    return;
  }

  if (parts[0] === "dashboard" && req.method === "GET") {
    sendJson(res, 200, buildDashboard(context.db.read()));
    return;
  }

  if (parts[0] === "api-keys") {
    if (parts[2] === "check") {
      await handleApiKeyCheck(req, res, parts[1], context);
      return;
    }
    await handleApiKeys(req, res, parts[1], context);
    return;
  }

  if (parts[0] === "resource-usage" && req.method === "GET") {
    sendJson(res, 200, buildResourceUsage(context.db.read()));
    return;
  }

  if (parts[0] === "ai" && req.method === "POST") {
    const task = parts[1] || "command";
    const payload = await readJson(req);
    const startedAt = Date.now();
    const result = await runAiTask(task, payload, context);
    recordAiUsage(context, task, payload, result, startedAt);
    sendJson(res, 200, result);
    return;
  }

  if (parts[0] === "workflows" && req.method === "POST") {
    const workflow = parts[1];
    const payload = await readJson(req);
    const startedAt = Date.now();
    const result = await handleWorkflow(workflow, payload, context);
    recordAiUsage(context, `workflow.${workflow}`, payload, result, startedAt);
    sendJson(res, 200, result);
    return;
  }

  if (parts[0] === "google") {
    await handleGoogle(req, res, parts, context);
    return;
  }

  if (parts[0] === "export" && req.method === "POST") {
    const format = parts[1] || "html";
    const payload = await readJson(req);
    const exported = exportEntity(format, payload);
    res.writeHead(200, {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(exported.filename)}"`,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(exported.body);
    return;
  }

  const collection = normalizeCollection(parts[0]);
  if (collection && collections.has(collection)) {
    await handleCollection(req, res, collection, parts[1], context);
    return;
  }

  sendJson(res, 404, { error: "Unknown API route", path: context.requestUrl.pathname });
}

async function handleCollection(req, res, collection, id, context) {
  if (collection === "apiKeys") {
    await handleApiKeys(req, res, id, context);
    return;
  }

  if (req.method === "GET") {
    if (id) {
      const item = context.db.get(collection, id);
      sendJson(res, item ? 200 : 404, item || { error: "Not found" });
      return;
    }

    const filters = Object.fromEntries(context.requestUrl.searchParams.entries());
    sendJson(res, 200, context.db.list(collection, filters));
    return;
  }

  if (req.method === "POST") {
    const payload = await readJson(req);
    const item = context.db.insert(collection, payload);
    sendJson(res, 201, item);
    return;
  }

  if (req.method === "PATCH" && id) {
    const payload = await readJson(req);
    const item = context.db.update(collection, id, payload);
    sendJson(res, item ? 200 : 404, item || { error: "Not found" });
    return;
  }

  if (req.method === "DELETE" && id) {
    const deleted = context.db.remove(collection, id);
    sendJson(res, deleted ? 200 : 404, { deleted });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}

async function handleApiKeys(req, res, id, context) {
  if (req.method === "GET") {
    if (id) {
      const item = context.db.get("apiKeys", id);
      sendJson(res, item ? 200 : 404, item ? sanitizeApiKey(item) : { error: "Not found" });
      return;
    }
    sendJson(res, 200, context.db.list("apiKeys").map(sanitizeApiKey));
    return;
  }

  if (req.method === "POST") {
    const payload = await readJson(req);
    if (!payload.provider || !payload.token) {
      sendJson(res, 400, { error: "Provider and token are required" });
      return;
    }
    const record = context.db.insert("apiKeys", {
      name: payload.name || `${payload.provider} key`,
      provider: payload.provider,
      model: payload.model || "",
      tokenEncrypted: encryptSecret(payload.token, context.config.appSecret),
      maskedKey: maskSecret(payload.token),
      status: "active",
      validationStatus: "unchecked",
      limitMonthly: Number(payload.limitMonthly || 0),
      budgetMonthly: Number(payload.budgetMonthly || 0),
      lastCheckedAt: null,
    });
    sendJson(res, 201, sanitizeApiKey(record));
    return;
  }

  if (req.method === "PATCH" && id) {
    const payload = await readJson(req);
    const patch = { ...payload };
    delete patch.token;
    if (payload.token) {
      patch.tokenEncrypted = encryptSecret(payload.token, context.config.appSecret);
      patch.maskedKey = maskSecret(payload.token);
      patch.validationStatus = "unchecked";
    }
    const item = context.db.update("apiKeys", id, patch);
    sendJson(res, item ? 200 : 404, item ? sanitizeApiKey(item) : { error: "Not found" });
    return;
  }

  if (req.method === "DELETE" && id) {
    const deleted = context.db.remove("apiKeys", id);
    sendJson(res, deleted ? 200 : 404, { deleted });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}

async function handleApiKeyCheck(req, res, id, context) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const item = context.db.get("apiKeys", id);
  if (!item) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  let validationStatus = item.tokenEncrypted ? "ok" : "missing";
  let message = validationStatus === "ok" ? "Key is stored and ready to use." : "Key is missing.";

  if (validationStatus === "ok" && item.provider === "openai") {
    try {
      const token = decryptSecret(item.tokenEncrypted, context.config.appSecret);
      const response = await fetch(`${context.config.openaiApiBase}/models`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      validationStatus = response.ok ? "ok" : "error";
      message = response.ok ? "OpenAI connection is working." : `OpenAI returned HTTP ${response.status}.`;
    } catch (error) {
      validationStatus = "error";
      message = error.message;
    }
  }

  const updated = context.db.update("apiKeys", id, {
    validationStatus,
    lastCheckedAt: new Date().toISOString(),
    status: validationStatus === "ok" ? "active" : "error",
  });
  sendJson(res, 200, {
    ok: validationStatus === "ok",
    key: sanitizeApiKey(updated),
    message,
  });
}

async function handleGoogle(req, res, parts, context) {
  const google = createGoogleWorkspaceService(context.config);

  if (parts[1] === "status" && req.method === "GET") {
    sendJson(res, 200, await google.status());
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const payload = await readJson(req);
  const action = parts[1];
  const actions = {
    "draft-email": () => google.createDraftEmail(payload),
    "calendar-event": () => google.createCalendarEvent(payload),
    "google-doc": () => google.createGoogleDoc(payload),
    "google-sheet": () => google.createGoogleSheet(payload),
    "drive-search": () => google.searchDrive(payload),
  };

  if (!actions[action]) {
    sendJson(res, 404, { error: "Unknown Google action" });
    return;
  }

  const result = await actions[action]();
  context.db.transaction((data) => {
    data.workspaceLinks.push({
      id: `W-${Date.now()}`,
      module: "googleWorkspace",
      title: result.action,
      provider: result.action.split(".")[0],
      status: result.mode,
      lastSyncAt: new Date().toISOString(),
    });
  }, "U-001", `google.${action}`);
  sendJson(res, 200, result);
}

async function handleWorkflow(workflow, payload, context) {
  if (workflow === "meeting-minutes") {
    const result = await runAiTask("minutes", payload, context);
    const meetingMinute = context.db.insert("meetingMinutes", {
      meetingId: payload.meetingId || null,
      title: payload.title || "Протокол встречи",
      protocolUz: result.protocolUz,
      decisions: result.decisions,
      tasks: result.tasks,
      risks: result.risks,
      status: "Сформирован",
    });

    const createdAssignments = result.tasks.map((task) =>
      context.db.insert("assignments", {
        title: `${task.department}: ${task.text}`,
        description: task.text,
        source: "Протокол встречи",
        ownerId: payload.ownerId || "E-005",
        departmentId: departmentIdByUz(task.department),
        dueDate: payload.dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        priority: "Высокий",
        riskLevel: task.department.includes("Yuridik") ? "Высокий" : "Средний",
        status: "Новая",
        comments: ["Создано генератором протоколов."],
        related: { meetingIds: payload.meetingId ? [payload.meetingId] : [] },
      })
    );

    return { meetingMinute, createdAssignments, ai: result };
  }

  if (workflow === "department-request") {
    const ai = await runAiTask("departmentRequest", payload, context);
    const department = findDepartment(context.db.read(), payload.departmentId, payload.departmentName);
    const assignment = context.db.insert("assignments", {
      title: ai.taskTitle,
      description: payload.needed || payload.topic || "Запросить данные у отдела.",
      source: "Генератор запросов в отделы",
      ownerId: payload.ownerId || "E-005",
      departmentId: department?.id || "D-005",
      dueDate: payload.dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      priority: payload.priority || "Средний",
      riskLevel: "Средний",
      status: "Новая",
      comments: ["Создано генератором запросов."],
      related: {},
    });
    const letter = context.db.insert("letters", {
      recipient: department?.name || payload.departmentName || "Отдел",
      subject: `So‘rov: ${payload.topic || "ma’lumot taqdim etish"}`,
      instruction: payload.topic || "",
      bodyUz: ai.letterUz,
      status: "Черновик",
    });
    const form = context.db.insert("employeeReportForms", {
      title: `Форма ответа: ${payload.topic || "запрос"}`,
      departmentId: department?.id || "D-005",
      deadline: payload.dueDate,
      questions: ["Что сделано?", "Какие данные переданы?", "Какие проблемы есть?", "Нужна ли помощь руководства?"],
      status: "Активна",
      responses: [],
    });
    const reminder = context.db.insert("reminders", {
      title: ai.reminder,
      targetType: "assignment",
      targetId: assignment.id,
      channel: "system",
      dueAt: `${payload.dueDate || assignment.dueDate}T16:00:00`,
      status: "Запланировано",
    });

    return { ai, assignment, letter, form, reminder };
  }

  if (workflow === "daily-briefing") {
    return runAiTask("briefing", payload, context);
  }

  if (workflow === "delay-analysis") {
    return runAiTask("delayAnalysis", payload, context);
  }

  if (workflow === "meeting-prep") {
    return runAiTask("meetingPrep", payload, context);
  }

  return { error: "Unknown workflow" };
}

function buildDashboard(data) {
  const today = new Date().toISOString().slice(0, 10);
  const openAssignments = data.assignments.filter((item) => !["Готово", "Закрыто"].includes(item.status));
  const todayAssignments = openAssignments.filter((item) => item.dueDate === today);
  const overdueAssignments = openAssignments.filter((item) => item.dueDate < today);
  const urgentAssignments = openAssignments.filter((item) => item.priority === "Высокий");
  const meetingsToday = data.meetings.filter((item) => item.date === today);
  const pendingReports = data.reports.filter((item) => item.status !== "Готов");
  const draftLetters = data.letters.filter((item) => item.status === "Черновик");
  const openComplaints = data.complaints.filter((item) => item.status !== "Закрыто");
  const highRisks = data.risks.filter((item) => item.level === "Высокий" && item.status !== "Закрыт");
  const waitingDepartments = data.departments.filter((department) =>
    openAssignments.some((assignment) => assignment.departmentId === department.id && assignment.status !== "Готово")
  );

  return {
    metrics: {
      todayAssignments: todayAssignments.length,
      overdueAssignments: overdueAssignments.length,
      urgentAssignments: urgentAssignments.length,
      meetingsToday: meetingsToday.length,
      pendingReports: pendingReports.length,
      draftLetters: draftLetters.length,
      openComplaints: openComplaints.length,
      highRisks: highRisks.length,
      waitingDepartments: waitingDepartments.length,
    },
    todayAssignments,
    overdueAssignments,
    urgentAssignments,
    meetingsToday,
    pendingReports,
    draftLetters,
    openComplaints,
    highRisks,
    waitingDepartments,
    briefing: {
      title: "Краткий брифинг для директора",
      text: `Сегодня: ${todayAssignments.length} задач, ${meetingsToday.length} встреч, ${pendingReports.length} отчёта на проверке, ${highRisks.length} высокий риск. Главный контроль: юридическое заключение и бюджет по критическому сырью.`,
    },
  };
}

function normalizeCollection(value) {
  return aliases[value] || value;
}

function departmentIdByUz(name) {
  if (name.includes("Geologiya")) return "D-001";
  if (name.includes("Moliya")) return "D-002";
  if (name.includes("Yuridik")) return "D-003";
  return "D-005";
}

function findDepartment(data, id, name) {
  if (id) return data.departments.find((item) => item.id === id);
  if (!name) return null;
  return data.departments.find((item) => item.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function sanitizeApiKey(item) {
  if (!item) return item;
  const { tokenEncrypted, ...safe } = item;
  return {
    ...safe,
    hasSecret: Boolean(tokenEncrypted),
  };
}

function recordAiUsage(context, task, payload, result, startedAt) {
  const now = new Date().toISOString();
  const promptTokens = estimateTokens(payload);
  const completionTokens = estimateTokens(result);
  const totalTokens = promptTokens + completionTokens;
  const provider = result?.provider || context.config.aiProvider || "mock";
  const costUsd = provider === "mock" ? 0 : Number(((totalTokens / 1000000) * 0.6).toFixed(6));

  context.db.transaction((data) => {
    data.aiUsage = data.aiUsage || [];
    data.aiUsage.push({
      id: `AIU-${Date.now()}`,
      at: now,
      task,
      provider,
      model: context.config.openaiModel || "",
      status: result?.error ? "error" : "ok",
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      durationMs: Math.max(0, Date.now() - startedAt),
      error: result?.error || "",
    });
    data.audit.push({
      id: `AUD-AI-${Date.now()}`,
      at: now,
      actor: "U-001",
      action: `ai.${task}`,
      entityType: "ai",
      entityId: task,
      detail: JSON.stringify(payload).slice(0, 500),
    });
  }, "U-001", `ai.${task}`);
}

function buildResourceUsage(data) {
  const usage = data.aiUsage || [];
  const apiKeys = (data.apiKeys || []).map(sanitizeApiKey);
  const totalTokens = usage.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
  const costUsd = usage.reduce((sum, item) => sum + Number(item.costUsd || 0), 0);
  const errors = usage.filter((item) => item.status === "error");
  const activeKey = apiKeys.find((item) => item.status === "active") || null;
  return {
    requests: usage.length,
    totalTokens,
    costUsd: Number(costUsd.toFixed(6)),
    errors: errors.length,
    activeKey,
    keys: apiKeys,
    history: usage.slice(-50).reverse(),
    warnings: [
      ...(errors.length ? [`${errors.length} AI errors recorded.`] : []),
      ...(activeKey?.budgetMonthly && costUsd > activeKey.budgetMonthly ? ["Monthly budget limit exceeded."] : []),
      ...(activeKey?.limitMonthly && usage.length > activeKey.limitMonthly ? ["Monthly request limit exceeded."] : []),
    ],
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), "application/json; charset=utf-8");
}

function send(res, status, body = "", contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body || "");
}

module.exports = {
  buildDashboard,
  handleApiRequest,
};
