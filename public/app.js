const state = {
  meta: {},
  dashboard: {},
  google: {},
  resourceUsage: {},
  collections: {},
  activeView: "dashboard",
  taskFilter: "all",
  search: "",
  selectedReportId: null,
  selectedMeetingId: null,
};

const collectionNames = [
  "departments",
  "employees",
  "assignments",
  "employee-tasks",
  "meetings",
  "meeting-minutes",
  "reports",
  "report-templates",
  "employee-report-forms",
  "letters",
  "complaints",
  "documents",
  "decisions",
  "risks",
  "reminders",
  "knowledge-base",
  "approvals",
  "workspace-links",
  "api-keys",
  "ai-usage",
  "audit",
];

const doneStatuses = new Set(["Готово", "Закрыто", "Утверждено", "Готово к отправке"]);
const taskStatuses = ["Новая", "В работе", "Ждёт ответ", "Заблокирована", "На проверке", "Готово", "Закрыто", "Просрочена"];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", () => {
  bindUi();
  setDatePill();
  loadAll();
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `HTTP ${response.status}`;
    try {
      message = JSON.parse(text).error || message;
    } catch {}
    throw new Error(message);
  }
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.blob();
}

async function loadAll({ silent = false } = {}) {
  try {
    if (!silent) setBusy("Загрузка данных...");
    const bootstrap = await api("/api/bootstrap");
    state.meta = bootstrap.meta || {};
    state.dashboard = bootstrap.dashboard || {};
    state.google = bootstrap.google || {};
    state.resourceUsage = bootstrap.resourceUsage || {};

    const results = await Promise.all(collectionNames.map((name) => api(`/api/${name}`)));
    collectionNames.forEach((name, index) => {
      state.collections[toCamel(name)] = Array.isArray(results[index]) ? results[index] : [];
    });

    state.selectedReportId ||= state.collections.reports?.[0]?.id || null;
    state.selectedMeetingId ||= state.collections.meetings?.[0]?.id || null;
    fillSelects();
    renderAll();
    if (!silent) setBusy("");
  } catch (error) {
    setBusy("");
    toast(`Ошибка загрузки: ${error.message}`);
    setText("backendStatus", "ошибка");
  }
}

function bindUi() {
  $("#nav")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) showView(button.dataset.view);
  });

  document.body.addEventListener("click", async (event) => {
    const jump = event.target.closest("[data-jump]");
    if (jump) {
      showView(jump.dataset.jump);
      return;
    }

    const promptButton = event.target.closest("[data-prompt]");
    if (promptButton) {
      await runAssistant(promptButton.dataset.prompt);
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      await handleAction(action.dataset.action);
      return;
    }

    const edit = event.target.closest("[data-edit]");
    if (edit) {
      await editRecord(edit.dataset.edit, edit.dataset.id);
      return;
    }

    const del = event.target.closest("[data-delete]");
    if (del) {
      await deleteRecord(del.dataset.delete, del.dataset.id);
      return;
    }

    const report = event.target.closest("[data-report-id]");
    if (report) {
      state.selectedReportId = report.dataset.reportId;
      renderReportsPage();
      return;
    }

    const meeting = event.target.closest("[data-meeting-id]");
    if (meeting) {
      state.selectedMeetingId = meeting.dataset.meetingId;
      renderMeetingsPage();
      return;
    }

    const checkKey = event.target.closest("[data-check-key]");
    if (checkKey) {
      await checkApiKey(checkKey.dataset.checkKey);
      return;
    }

    const exportButton = event.target.closest("[data-export]");
    if (exportButton) {
      await exportReport(exportButton.dataset.export);
    }
  });

  $("#taskFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.taskFilter = button.dataset.filter;
    $$("#taskFilters button").forEach((item) => item.classList.toggle("active", item === button));
    renderTasksPage();
  });

  $("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.toLowerCase().trim();
    renderAll();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#searchInput")?.focus();
    }
  });

  $("#taskForm")?.addEventListener("submit", submitTask);
  $("#meetingForm")?.addEventListener("submit", submitMeeting);
  $("#reportForm")?.addEventListener("submit", submitReport);
  $("#letterForm")?.addEventListener("submit", submitLetter);
  $("#documentForm")?.addEventListener("submit", submitDocument);
  $("#apiKeyForm")?.addEventListener("submit", submitApiKey);
  $("#assistantForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.prompt;
    const prompt = input.value.trim();
    if (!prompt) return;
    input.value = "";
    await runAssistant(prompt);
  });

  $("#taskTable")?.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-status-id]");
    if (!select) return;
    await patchRecord("assignments", select.dataset.statusId, { status: select.value }, "Статус обновлён");
  });

  $("#createButton")?.addEventListener("click", () => showView("tasks"));
}

function renderAll() {
  renderBadges();
  renderDashboard();
  renderTasksPage();
  renderMeetingsPage();
  renderReportsPage();
  renderLettersPage();
  renderDocumentsPage();
  renderSettingsPage();
}

function renderDashboard() {
  const metrics = getMetrics();
  setHtml(
    "dashboardMetrics",
    [
      metricCard("Задачи", metrics.activeTasks, "активные"),
      metricCard("Сегодня", metrics.todayTasks, "срок сегодня"),
      metricCard("Просрочено", metrics.overdueTasks, "нужна реакция", "danger"),
      metricCard("Отчёты", metrics.pendingReports, "на проверке"),
      metricCard("Письма", metrics.draftLetters, "черновики"),
      metricCard("AI", state.resourceUsage.requests || 0, "запросов"),
    ].join("")
  );

  const focus = [
    ...filteredTasks("overdue").slice(0, 4).map((item) => focusRow("Просрочено", item.title, `${ownerName(item.ownerId)} · ${formatDate(item.dueDate)}`, "danger")),
    ...meetingsToday().slice(0, 2).map((item) => focusRow("Встреча", item.title, item.time || formatDate(item.date), "info")),
    ...(state.collections.reports || []).filter((item) => item.status !== "Готов").slice(0, 2).map((item) => focusRow("Отчёт", item.title, item.status, "warn")),
  ];
  setHtml("todayFocus", focus.join("") || emptyState("Критичных событий нет. Можно спокойно закрывать план дня."));

  const brief = state.dashboard.briefing?.text || buildLocalBriefing();
  setHtml("directorBrief", `<div class="brief-text"><p>${escapeHtml(brief)}</p><p>${escapeHtml(nextActionText())}</p></div>`);
  renderMeetingTimeline();
  renderReportsQueue();
  renderRiskComplaintQueue();
}

function renderTasksPage() {
  const rows = filteredTasks();
  setHtml(
    "taskTable",
    `
      <div class="data-row data-head simple-task-grid">
        <span>Задача</span><span>Ответственный</span><span>Отдел</span><span>Срок</span><span>Приоритет</span><span>Статус</span><span></span>
      </div>
      ${
        rows
          .map(
            (item) => `
              <div class="data-row simple-task-grid">
                <div class="title-cell"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.source || item.description || "Личная задача")}</small></div>
                <span>${person(ownerName(item.ownerId))}</span>
                <span>${escapeHtml(departmentName(item.departmentId))}</span>
                <time class="${isOverdue(item) ? "danger-text" : ""}">${formatDate(item.dueDate)}</time>
                ${badge(item.priority || "Средний", priorityTone(item.priority))}
                <select data-status-id="${escapeHtml(item.id)}">${taskStatuses.map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select>
                <span class="row-actions"><button data-edit="assignments" data-id="${escapeHtml(item.id)}" type="button">Edit</button><button data-delete="assignments" data-id="${escapeHtml(item.id)}" type="button">Del</button></span>
              </div>
            `
          )
          .join("") || emptyState("Задач по фильтру нет.")
      }
    `
  );

  const complaints = (state.collections.complaints || []).filter(matchesSearch).slice(0, 6);
  const reminders = (state.collections.reminders || []).slice(0, 6);
  setHtml("complaintsList", complaints.map((item) => queueRow(item.title, `${departmentName(item.departmentId)} · ${formatDate(item.dueDate)}`, item.status, item.urgency === "Высокая" ? "danger" : "warn")).join("") || emptyState("Жалоб нет."));
  setHtml("remindersList", reminders.map((item) => queueRow(item.title, formatDate((item.dueAt || "").slice(0, 10)), item.status, "info")).join("") || emptyState("Напоминаний нет."));
}

function renderMeetingsPage() {
  const meetings = (state.collections.meetings || []).filter(matchesSearch).sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
  setHtml(
    "meetingsList",
    meetings
      .map(
        (item) => `
          <button class="card as-button ${state.selectedMeetingId === item.id ? "selected" : ""}" data-meeting-id="${escapeHtml(item.id)}" type="button">
            <span>${formatDate(item.date)} ${escapeHtml(item.time || "")}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml((item.agenda || []).join(", ") || item.status || "Встреча")}</p>
            <div>${badge(item.status || "Запланирована", statusTone(item.status))}</div>
          </button>
        `
      )
      .join("") || emptyState("Встреч пока нет.")
  );
  const minute = (state.collections.meetingMinutes || []).find((item) => item.meetingId === state.selectedMeetingId) || (state.collections.meetingMinutes || [])[0];
  const meeting = meetings.find((item) => item.id === state.selectedMeetingId) || meetings[0];
  setText("minutesOutput", minute?.protocolUz || buildMeetingPreview(meeting));
}

function renderReportsPage() {
  const reports = (state.collections.reports || []).filter(matchesSearch);
  const selected = reports.find((item) => item.id === state.selectedReportId) || reports[0];
  state.selectedReportId = selected?.id || null;
  setHtml(
    "reportsList",
    reports
      .map(
        (item) => `
          <article class="card as-button ${state.selectedReportId === item.id ? "selected" : ""}" data-report-id="${escapeHtml(item.id)}">
            <span>${escapeHtml(item.type || "Отчёт")}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${departmentName(item.ownerDepartmentId)} · готовность ${item.completeness || 0}%</p>
            <div>${badge(item.status || "Черновик", statusTone(item.status))}<span class="row-actions"><button data-edit="reports" data-id="${escapeHtml(item.id)}" type="button">Edit</button><button data-delete="reports" data-id="${escapeHtml(item.id)}" type="button">Del</button></span></div>
          </article>
        `
      )
      .join("") || emptyState("Отчётов пока нет.")
  );
  setText("reportOutput", selected ? selected.summary || selected.content || buildReportPreview(selected) : "Выберите отчёт или создайте новый.");
  renderReportTemplates();
}

function renderLettersPage() {
  const letters = (state.collections.letters || []).filter(matchesSearch).slice().reverse();
  const first = letters[0] || (state.collections.letters || [])[0];
  setText("letterOutput", first?.bodyUz || "Сгенерированное письмо появится здесь.");
  setHtml(
    "lettersList",
    letters
      .map((item) => card(item.recipient || "Адресат", item.subject || "Письмо", `${formatDate((item.createdAt || "").slice(0, 10))} · ${item.status || "Черновик"}`, [item.status || "Черновик"], "letters", item.id))
      .join("") || emptyState("Писем пока нет.")
  );
}

function renderDocumentsPage() {
  const docs = (state.collections.documents || []).filter(matchesSearch);
  const knowledge = (state.collections.knowledgeBase || []).filter(matchesSearch);
  setHtml("documentsList", docs.map((item) => card(item.type || "Документ", item.title, `${item.status || "Черновик"} · ${(item.tags || []).join(", ")}`, [item.status], "documents", item.id)).join("") || emptyState("Документов нет."));
  setHtml("knowledgeList", knowledge.map((item) => card(item.category || "База знаний", item.title, (item.tags || []).join(", "), [], "knowledge-base", item.id)).join("") || emptyState("Записей базы знаний нет."));
}

function renderSettingsPage() {
  renderGoogleStatus();
  renderApiKeys();
  renderResourceUsage();
  renderAudit();
}

function renderMeetingTimeline() {
  const meetings = meetingsToday().length ? meetingsToday() : (state.collections.meetings || []).slice(0, 4);
  setHtml("meetingTimeline", meetings.map((item) => queueRow(item.title, `${item.time || ""} · ${formatDate(item.date)}`, item.status || "Запланирована", "info")).join("") || emptyState("Сегодня встреч нет."));
}

function renderReportsQueue() {
  const reports = (state.collections.reports || []).filter((item) => item.status !== "Готов").slice(0, 5);
  setHtml("reportsQueue", reports.map((item) => queueRow(item.title, `${item.completeness || 0}% · ${departmentName(item.ownerDepartmentId)}`, item.status, statusTone(item.status))).join("") || emptyState("Нет отчётов на проверке."));
}

function renderRiskComplaintQueue() {
  const risks = (state.collections.risks || []).filter((item) => item.status !== "Закрыт").slice(0, 3);
  const complaints = (state.collections.complaints || []).filter((item) => item.status !== "Закрыто").slice(0, 3);
  const rows = [
    ...risks.map((item) => queueRow(item.title, item.actionPlan || item.source, item.level, riskTone(item.level))),
    ...complaints.map((item) => queueRow(item.title, departmentName(item.departmentId), item.status, item.urgency === "Высокая" ? "danger" : "warn")),
  ];
  setHtml("riskComplaintQueue", rows.join("") || emptyState("Рисков и жалоб нет."));
}

function renderReportTemplates() {
  const templates = state.collections.reportTemplates || [];
  const forms = state.collections.employeeReportForms || [];
  setHtml(
    "reportTemplatesList",
    [
      ...templates.map((item) => compactItem(item.title, (item.blocks || []).join(", "))),
      ...forms.map((item) => compactItem(item.title, `${departmentName(item.departmentId)} · ${formatDate(item.deadline)}`)),
    ].join("") || emptyState("Шаблонов нет.")
  );
}

function renderGoogleStatus() {
  const google = state.google || {};
  const items = [
    ["Google Calendar", google.calendar],
    ["Gmail", google.gmail],
    ["Google Docs", google.docs],
    ["Google Sheets", google.sheets],
    ["Google Drive", google.drive],
  ];
  setText("backendStatus", "API работает");
  setHtml("googleStatus", items.map(([name, ok]) => `<span>${escapeHtml(name)}: <b>${ok ? "подключено" : "mock"}</b></span>`).join(""));
}

function renderApiKeys() {
  const keys = state.collections.apiKeys || [];
  setHtml(
    "apiKeysList",
    keys
      .map(
        (item) => `
          <div class="compact-item">
            <div><strong>${escapeHtml(item.name || item.provider)}</strong><span>${escapeHtml(item.provider)} · ${escapeHtml(item.maskedKey || "без ключа")} · ${escapeHtml(item.validationStatus || "unchecked")}</span></div>
            <span class="row-actions"><button data-check-key="${escapeHtml(item.id)}" type="button">Check</button><button data-delete="api-keys" data-id="${escapeHtml(item.id)}" type="button">Del</button></span>
          </div>
        `
      )
      .join("") || emptyState("API-ключи не добавлены. Можно работать в mock-режиме.")
  );
}

function renderResourceUsage() {
  const usage = state.resourceUsage || {};
  const warnings = usage.warnings || [];
  setHtml(
    "resourceUsage",
    `
      <div class="usage-grid">
        ${metricCard("AI-запросы", usage.requests || 0, "всего")}
        ${metricCard("Токены", usage.totalTokens || 0, "примерно")}
        ${metricCard("Расход", `$${Number(usage.costUsd || 0).toFixed(4)}`, "оценка")}
        ${metricCard("Ошибки", usage.errors || 0, "AI", usage.errors ? "danger" : "")}
      </div>
      <p class="muted">Активный ключ: ${escapeHtml(usage.activeKey?.name || "не выбран")}</p>
      ${warnings.length ? `<div class="warning-list">${warnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>` : ""}
      <div class="compact-stack">${(usage.history || []).slice(0, 8).map((item) => compactItem(`${item.task} · ${item.status}`, `${item.totalTokens} tokens · ${formatDateTime(item.at)}`)).join("") || emptyState("История AI-запросов пока пуста.")}</div>
    `
  );
}

function renderAudit() {
  const audit = (state.collections.audit || []).slice().reverse().slice(0, 12);
  setHtml("auditList", audit.map((item) => `<div class="audit-row"><time>${formatDateTime(item.at)}</time><strong>${escapeHtml(item.action)}</strong><span>${escapeHtml(item.entityType || "")}</span><p>${escapeHtml(item.detail || "")}</p></div>`).join("") || emptyState("Аудит пуст."));
}

async function submitTask(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await createRecord("assignments", {
    ...data,
    source: "Личная система",
    status: "Новая",
    riskLevel: data.priority === "Высокий" ? "Средний" : "Низкий",
    description: "",
    comments: [],
    related: {},
  }, "Задача создана");
  event.currentTarget.reset();
  fillSelects();
}

async function submitMeeting(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await createRecord("meetings", {
    ...data,
    agenda: data.notes ? [data.notes.slice(0, 80)] : [],
    participants: [],
    documentIds: [],
    status: "Запланирована",
  }, "Встреча сохранена");
  event.currentTarget.reset();
}

async function submitReport(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await createRecord("reports", {
    title: data.title,
    type: data.type || "Отчёт для директора",
    content: data.content || "",
    ownerDepartmentId: "D-000",
    status: "Черновик",
    completeness: data.content ? 70 : 20,
    missing: [],
    summary: "",
  }, "Отчёт сохранён");
  event.currentTarget.reset();
}

async function submitLetter(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  setStatus("aiRunStatus", "выполняется");
  try {
    const result = await api("/api/ai/letter", { method: "POST", body: JSON.stringify(data) });
    const bodyUz = result.bodyUz || result.text || "";
    setText("letterOutput", bodyUz);
    await createRecord("letters", {
      recipient: data.recipient,
      subject: data.subject || result.subject || "Rasmiy xat",
      instruction: data.instruction,
      bodyUz,
      status: "Черновик",
    }, "Письмо создано", { silent: true });
    setStatus("aiRunStatus", "готов");
    await refreshUsage();
    renderLettersPage();
    toast("Письмо подготовлено и сохранено.");
  } catch (error) {
    setStatus("aiRunStatus", "ошибка");
    toast(`AI ошибка: ${error.message}`);
  }
}

async function submitDocument(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await createRecord("documents", { ...data, tags: [], linked: {}, versions: [] }, "Документ сохранён");
  event.currentTarget.reset();
}

async function submitApiKey(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await createRecord("api-keys", data, "API-ключ сохранён");
  event.currentTarget.reset();
  await refreshUsage();
}

async function handleAction(action) {
  if (action === "refresh") return loadAll();
  if (action === "new-task") return showView("tasks");
  if (action === "new-report") return showView("reports");
  if (action === "new-letter") return showView("letters");
  if (action === "new-document") return showView("documents");
  if (action === "daily-briefing") return runAssistant("Сделай краткий брифинг дня для директора");
  if (action === "delay-analysis") return runAssistant("Покажи просроченные задачи и причины задержек");
  if (action === "report-summary") return summarizeReport();
  if (action === "import-template") return importReportTemplate();
  if (action === "generate-minutes") return generateMinutes();
  if (action === "meeting-prep") return runAssistant("Подготовь справку к ближайшему совещанию");
  if (action === "department-request") return createDepartmentRequest();
  if (action === "gmail-draft") return createGmailDraft();
  if (action === "refresh-google") return refreshGoogle();
  if (action === "refresh-usage") return refreshUsage();
}

async function createRecord(collection, payload, success, options = {}) {
  try {
    await api(`/api/${collection}`, { method: "POST", body: JSON.stringify(payload) });
    await loadAll({ silent: true });
    if (!options.silent) toast(success);
  } catch (error) {
    toast(`Не сохранено: ${error.message}`);
  }
}

async function patchRecord(collection, id, payload, success) {
  try {
    const updated = await api(`/api/${collection}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    const key = toCamel(collection);
    const list = state.collections[key] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index !== -1) list[index] = updated;
    renderAll();
    toast(success);
  } catch (error) {
    toast(`Не обновлено: ${error.message}`);
  }
}

async function deleteRecord(collection, id) {
  if (!window.confirm("Удалить запись?")) return;
  try {
    await api(`/api/${collection}/${id}`, { method: "DELETE" });
    await loadAll({ silent: true });
    toast("Удалено");
  } catch (error) {
    toast(`Не удалено: ${error.message}`);
  }
}

async function editRecord(collection, id) {
  const key = toCamel(collection);
  const item = (state.collections[key] || []).find((record) => record.id === id);
  if (!item) return;
  const title = window.prompt("Название", item.title || item.subject || "");
  if (title === null || !title.trim()) return;
  await patchRecord(collection, id, item.subject !== undefined ? { subject: title } : { title }, "Изменено");
}

async function runAssistant(prompt) {
  addChat("user", prompt);
  setStatus("aiRunStatus", "выполняется");
  setStatus("aiBriefStatus", "выполняется");
  try {
    const lower = prompt.toLowerCase();
    let result;
    if (lower.includes("пись") || lower.includes("uzbek") || lower.includes("узбек")) {
      result = await api("/api/ai/letter", { method: "POST", body: JSON.stringify({ instruction: prompt, recipient: "Hamkasblar" }) });
      addChat("assistant", result.bodyUz || result.text || stringify(result));
    } else if (lower.includes("риск")) {
      result = await api("/api/ai/risks", { method: "POST", body: JSON.stringify({ prompt }) });
      addChat("assistant", result.recommendation || stringify(result));
    } else {
      result = await api("/api/workflows/daily-briefing", { method: "POST", body: JSON.stringify({ prompt }) });
      addChat("assistant", result.directorText || result.text || stringify(result));
      setHtml("directorBrief", `<div class="brief-text"><p>${escapeHtml(result.directorText || "")}</p></div>`);
    }
    setStatus("aiRunStatus", "готов");
    setStatus("aiBriefStatus", "готов");
    await refreshUsage();
  } catch (error) {
    setStatus("aiRunStatus", "ошибка");
    setStatus("aiBriefStatus", "ошибка");
    addChat("assistant", `Ошибка: ${error.message}`);
  }
}

async function summarizeReport() {
  const id = state.selectedReportId;
  if (!id) return toast("Сначала выберите отчёт.");
  setStatus("aiRunStatus", "выполняется");
  try {
    const result = await api("/api/ai/reportSummary", { method: "POST", body: JSON.stringify({ reportId: id }) });
    setText("reportOutput", result.summaryUz || stringify(result));
    await patchRecord("reports", id, { summary: result.summaryUz || stringify(result), status: "На проверке", completeness: 90 }, "AI-выжимка сохранена");
    await refreshUsage();
  } catch (error) {
    toast(`AI-выжимка не готова: ${error.message}`);
  } finally {
    setStatus("aiRunStatus", "готов");
  }
}

async function generateMinutes() {
  const meeting = (state.collections.meetings || []).find((item) => item.id === state.selectedMeetingId) || (state.collections.meetings || [])[0];
  if (!meeting) return toast("Сначала создайте встречу.");
  try {
    const result = await api("/api/workflows/meeting-minutes", { method: "POST", body: JSON.stringify(meeting) });
    setText("minutesOutput", result.ai?.protocolUz || result.meetingMinute?.protocolUz || stringify(result));
    await loadAll({ silent: true });
    await refreshUsage();
    toast("Протокол и задачи созданы.");
  } catch (error) {
    toast(`Протокол не создан: ${error.message}`);
  }
}

async function createDepartmentRequest() {
  const department = (state.collections.departments || []).find((item) => item.id !== "D-000") || {};
  try {
    await api("/api/workflows/department-request", {
      method: "POST",
      body: JSON.stringify({
        departmentId: department.id,
        departmentName: department.name || "Отдел",
        topic: "Запрос статуса по открытым задачам",
        needed: "Предоставить текущий статус, проблемы и новый срок при задержке.",
        dueDate: todayISO(1),
        priority: "Средний",
      }),
    });
    await loadAll({ silent: true });
    await refreshUsage();
    toast("Запрос, задача, форма и письмо созданы.");
  } catch (error) {
    toast(`Запрос не создан: ${error.message}`);
  }
}

async function createGmailDraft() {
  const letter = (state.collections.letters || [])[0];
  if (!letter) return toast("Сначала создайте письмо.");
  try {
    await api("/api/google/draft-email", { method: "POST", body: JSON.stringify({ to: letter.recipient, subject: letter.subject, body: letter.bodyUz }) });
    toast("Gmail draft создан в mock/Google режиме.");
  } catch (error) {
    toast(`Gmail draft не создан: ${error.message}`);
  }
}

async function refreshGoogle() {
  try {
    state.google = await api("/api/google/status");
    renderGoogleStatus();
    toast("Google Workspace статус обновлён.");
  } catch (error) {
    toast(`Google статус недоступен: ${error.message}`);
  }
}

async function refreshUsage() {
  try {
    state.resourceUsage = await api("/api/resource-usage");
    state.collections.apiKeys = state.resourceUsage.keys || state.collections.apiKeys || [];
    renderSettingsPage();
  } catch (error) {
    toast(`Usage недоступен: ${error.message}`);
  }
}

async function checkApiKey(id) {
  try {
    const result = await api(`/api/api-keys/${id}/check`, { method: "POST", body: "{}" });
    await loadAll({ silent: true });
    toast(result.ok ? "Ключ подключён." : `Ключ не прошёл проверку: ${result.message}`);
  } catch (error) {
    toast(`Проверка не прошла: ${error.message}`);
  }
}

async function exportReport(format) {
  const report = (state.collections.reports || []).find((item) => item.id === state.selectedReportId);
  if (!report) return toast("Выберите отчёт.");
  try {
    const blob = await api(`/api/export/${format}`, {
      method: "POST",
      body: JSON.stringify({
        title: report.title,
        content: report.summary || report.content || buildReportPreview(report),
        rows: state.collections.assignments || [],
      }),
    });
    const extension = format === "csv" ? "csv" : format === "json" ? "json" : format === "doc" ? "doc" : "html";
    downloadBlob(blob, `${safeName(report.title)}.${extension}`);
  } catch (error) {
    toast(`Экспорт не выполнен: ${error.message}`);
  }
}

function importReportTemplate() {
  const template = (state.collections.reportTemplates || [])[0];
  if (!template) return toast("Шаблонов нет.");
  const form = $("#reportForm");
  form.elements.title.value ||= template.title;
  form.elements.content.value = (template.blocks || []).map((block) => `${block}:\n`).join("\n");
  toast("Шаблон добавлен в форму отчёта.");
}

function fillSelects() {
  setHtml("taskDepartment", (state.collections.departments || []).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join(""));
  setHtml("taskOwner", (state.collections.employees || []).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join(""));
  setHtml("reportType", (state.collections.reportTemplates || []).map((item) => `<option>${escapeHtml(item.title)}</option>`).join("") || "<option>Отчёт для директора</option>");
  const due = $("#taskForm")?.elements.dueDate;
  if (due && !due.value) due.value = todayISO();
  const meetingDate = $("#meetingForm")?.elements.date;
  if (meetingDate && !meetingDate.value) meetingDate.value = todayISO();
}

function filteredTasks(forceFilter) {
  const filter = forceFilter || state.taskFilter;
  const today = todayISO();
  return (state.collections.assignments || [])
    .filter(matchesSearch)
    .filter((item) => {
      if (filter === "today") return item.dueDate === today;
      if (filter === "overdue") return isOverdue(item);
      if (filter === "risk") return item.riskLevel === "Высокий" || item.priority === "Высокий";
      return true;
    })
    .sort((a, b) => executiveScore(b) - executiveScore(a));
}

function getMetrics() {
  const tasks = state.collections.assignments || [];
  const reports = state.collections.reports || [];
  const letters = state.collections.letters || [];
  return {
    activeTasks: tasks.filter((item) => !isDone(item.status)).length,
    todayTasks: tasks.filter((item) => item.dueDate === todayISO()).length,
    overdueTasks: tasks.filter(isOverdue).length,
    pendingReports: reports.filter((item) => item.status !== "Готов").length,
    draftLetters: letters.filter((item) => item.status !== "Готово к отправке").length,
  };
}

function renderBadges() {
  const metrics = getMetrics();
  setBadge("navTasks", metrics.activeTasks);
  setBadge("navReports", metrics.pendingReports);
  setBadge("navLetters", metrics.draftLetters);
}

function showView(view) {
  state.activeView = view;
  $$(".view").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  $$("#nav [data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function meetingsToday() {
  return (state.collections.meetings || []).filter((item) => item.date === todayISO());
}

function matchesSearch(item) {
  if (!state.search) return true;
  return JSON.stringify(item || {}).toLowerCase().includes(state.search);
}

function isDone(status = "") {
  return doneStatuses.has(status);
}

function isOverdue(item) {
  return item?.dueDate && item.dueDate < todayISO() && !isDone(item.status);
}

function executiveScore(item) {
  return (isOverdue(item) ? 100 : 0) + (item.priority === "Высокий" ? 20 : 0) + (item.riskLevel === "Высокий" ? 25 : 0) - daysUntil(item.dueDate);
}

function daysUntil(value) {
  if (!value) return 999;
  return Math.ceil((new Date(`${value}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000);
}

function buildLocalBriefing() {
  const metrics = getMetrics();
  return `Сегодня в фокусе: ${metrics.activeTasks} активных задач, ${metrics.overdueTasks} просроченных, ${metrics.pendingReports} отчётов на проверке. Главный порядок дня - закрыть просрочки и подготовить короткую управленческую выжимку.`;
}

function nextActionText() {
  const overdue = filteredTasks("overdue")[0];
  return overdue ? `Следующее действие: запросить статус по задаче "${overdue.title}".` : "Следующее действие: проверить отчёты и подготовить письма.";
}

function buildMeetingPreview(meeting) {
  if (!meeting) return "Выберите встречу или создайте новую.";
  return [
    "BAYONNOMA",
    "",
    `Mavzu: ${meeting.title}`,
    `Vaqt: ${formatDate(meeting.date)} ${meeting.time || ""}`,
    "",
    "Kun tartibi:",
    ...(meeting.agenda || []).map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");
}

function buildReportPreview(report) {
  return [
    "RAHBARIYAT UCHUN QISQA XULOSA",
    "",
    `Hisobot: ${report.title}`,
    `Holat: ${report.status || "Черновик"}`,
    `Tayyorlik: ${report.completeness || 0}%`,
    "",
    report.content || "Hisobot matni hali kiritilmagan.",
  ].join("\n");
}

function metricCard(title, value, label, tone = "") {
  return `<article class="mini-metric ${tone}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(title)}</span><p>${escapeHtml(label)}</p></article>`;
}

function focusRow(label, title, meta, tone = "") {
  return `<div class="focus-row ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(meta)}</p></div>`;
}

function queueRow(title, meta, status, tone = "info") {
  return `<div class="queue-row"><div><strong>${escapeHtml(title || "")}</strong><span>${escapeHtml(meta || "")}</span></div>${badge(status || "Новая", tone)}</div>`;
}

function card(label, title, meta, chips = [], collection = "", id = "") {
  return `
    <article class="card">
      <span>${escapeHtml(label || "")}</span>
      <strong>${escapeHtml(title || "")}</strong>
      <p>${escapeHtml(meta || "")}</p>
      <div>${chips.filter(Boolean).map((item) => badge(item, statusTone(item))).join("")}${collection ? `<span class="row-actions"><button data-edit="${collection}" data-id="${escapeHtml(id)}" type="button">Edit</button><button data-delete="${collection}" data-id="${escapeHtml(id)}" type="button">Del</button></span>` : ""}</div>
    </article>
  `;
}

function compactItem(title, meta) {
  return `<div class="compact-item"><div><strong>${escapeHtml(title || "")}</strong><span>${escapeHtml(meta || "")}</span></div></div>`;
}

function person(name) {
  return `<span class="person"><i>${initials(name)}</i>${escapeHtml(shortName(name))}</span>`;
}

function badge(text, tone = "muted") {
  return `<span class="badge ${tone}">${escapeHtml(text || "")}</span>`;
}

function priorityTone(value = "") {
  if (value === "Высокий" || value === "Высокая") return "danger";
  if (value === "Средний" || value === "Средняя") return "warn";
  return "ok";
}

function riskTone(value = "") {
  return priorityTone(value);
}

function statusTone(value = "") {
  if (["Готово", "Закрыто", "Утверждено", "Готово к отправке", "active", "ok"].includes(value)) return "ok";
  if (["Просрочена", "Заблокирована", "Требует правок", "error"].includes(value)) return "danger";
  if (["На проверке", "На согласовании", "Ждёт ответ", "Черновик", "В работе", "Новая"].includes(value)) return "info";
  return priorityTone(value) || "muted";
}

function departmentName(id) {
  return (state.collections.departments || []).find((item) => item.id === id)?.name || id || "";
}

function ownerName(id) {
  return (state.collections.employees || []).find((item) => item.id === id)?.name || id || "Ответственный";
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function addChat(role, text) {
  const node = $("#aiPageChat");
  if (!node) return;
  node.insertAdjacentHTML("beforeend", `<div class="message ${role}"><strong>${role === "user" ? "Вы" : "AI"}</strong><pre>${escapeHtml(text)}</pre></div>`);
  node.scrollTop = node.scrollHeight;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setBusy(message) {
  const node = $("#toast");
  if (!node) return;
  if (message) {
    toast(message, 1200);
    return;
  }
  window.clearTimeout(toast.timer);
  node.classList.remove("show");
}

function setStatus(id, text) {
  setText(id, text);
}

function setDatePill() {
  setText("datePill", new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "long" }).format(new Date()));
}

function todayISO(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function initials(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() : "U";
}

function shortName(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return value;
  return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
}

function safeName(value) {
  return String(value || "export").replace(/[\\/:*?"<>|]+/g, "-");
}

function stringify(value) {
  return JSON.stringify(value, null, 2);
}

function toCamel(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value == null ? "" : String(value);
}

function setBadge(id, value) {
  setText(id, value > 0 ? value : "");
}

function setHtml(id, value) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = value || "";
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function toast(message, delay = 2800) {
  const node = $("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), delay);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
