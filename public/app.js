const state = {
  meta: {},
  modules: [],
  dashboard: null,
  google: null,
  collections: {},
  activeFilter: "all",
  selectedReportId: null,
  lastLetter: null,
  lastReportSummary: "",
};

const titles = {
  dashboard: "Главная панель",
  assignments: "Поручения и задачи",
  meetings: "Встречи и протоколы",
  reports: "Отчёты",
  letters: "Официальные письма",
  complaints: "Жалобы и обратная связь",
  documents: "Документы и Google Workspace",
  departments: "Контроль отделов",
  risks: "Риски и напоминания",
  control: "Решения, согласования, аудит",
  tools: "AI и каталог модулей",
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
  "audit",
];

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

async function loadAll() {
  const bootstrap = await api("/api/bootstrap");
  state.meta = bootstrap.meta;
  state.modules = bootstrap.modules;
  state.dashboard = bootstrap.dashboard;
  state.google = bootstrap.google;

  const results = await Promise.all(collectionNames.map((name) => api(`/api/${name}`)));
  collectionNames.forEach((name, index) => {
    state.collections[toCamel(name)] = results[index];
  });

  state.selectedReportId = state.selectedReportId || state.collections.reports?.[0]?.id;
  renderAll();
}

function toCamel(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function todayISO(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function renderAll() {
  $("#backendStatus").textContent = "API подключен";
  fillSelects();
  renderDashboard();
  renderAssignments();
  renderMeetings();
  renderReports();
  renderLetters();
  renderComplaints();
  renderDocuments();
  renderDepartments();
  renderRisks();
  renderControl();
  renderTools();
}

function renderDashboard() {
  const dashboard = state.dashboard;
  if (!dashboard) return;

  const metricLabels = [
    ["todayAssignments", "Задачи сегодня"],
    ["overdueAssignments", "Просрочено"],
    ["urgentAssignments", "Срочные"],
    ["meetingsToday", "Встречи"],
    ["pendingReports", "Отчёты"],
    ["draftLetters", "Письма"],
    ["openComplaints", "Жалобы"],
    ["highRisks", "Высокие риски"],
  ];

  $("#metrics").innerHTML = metricLabels
    .map(([key, label]) => `<div class="metric"><strong>${dashboard.metrics[key]}</strong><span>${label}</span></div>`)
    .join("");

  $("#briefing").innerHTML = `
    <div class="brief-card"><strong>Картина дня</strong><p>${escapeHtml(dashboard.briefing.text)}</p></div>
    <div class="brief-card"><strong>Что доложить</strong><p>Юридическое заключение и бюджет пока остаются главными точками контроля.</p></div>
    <div class="brief-card"><strong>Что запросить</strong><p>Статус у юридического отдела, подтверждение бюджета и готовность отчёта.</p></div>
  `;

  $("#todayAssignments").innerHTML = renderList(dashboard.todayAssignments, assignmentItem);
  $("#overdueAssignments").innerHTML = renderList(dashboard.overdueAssignments, assignmentItem);
  $("#overdueCount").textContent = dashboard.metrics.overdueAssignments;
  $("#meetingsToday").innerHTML = renderList(dashboard.meetingsToday, meetingItem);
  $("#pendingReports").innerHTML = renderList(dashboard.pendingReports, reportItem);
  $("#openComplaints").innerHTML = renderList(dashboard.openComplaints, complaintItem);
  $("#highRisks").innerHTML = renderList(dashboard.highRisks, riskItem);
}

function renderAssignments() {
  const assignments = filteredAssignments();
  $("#assignmentTable").innerHTML = `
    <div class="table-row header">
      <div>Поручение</div><div>Отдел</div><div>Срок</div><div>Приоритет</div><div>Риск</div><div>Статус</div>
    </div>
    ${assignments.map(assignmentRow).join("") || `<div class="empty">Поручений не найдено.</div>`}
  `;

  const employeeTasks = state.collections.employeeTasks || [];
  $("#employeeTaskCount").textContent = employeeTasks.length;
  $("#employeeTasks").innerHTML = renderCards(employeeTasks, (task) => `
    <div class="card">
      <strong>${escapeHtml(task.title)}</strong>
      <p>${employeeName(task.employeeId)} · ${departmentName(task.departmentId)} · ${formatDate(task.dueDate)}</p>
      ${chip(task.status, statusTone(task.status))}
    </div>
  `);
}

function filteredAssignments() {
  const query = ($("#searchInput").value || "").toLowerCase().trim();
  const today = todayISO();
  return (state.collections.assignments || []).filter((item) => {
    const matchesQuery = !query || [item.title, item.description, item.source, departmentName(item.departmentId), employeeName(item.ownerId)].join(" ").toLowerCase().includes(query);
    if (!matchesQuery) return false;
    if (state.activeFilter === "today") return item.dueDate === today;
    if (state.activeFilter === "overdue") return isOverdue(item);
    if (state.activeFilter === "risk") return item.riskLevel === "Высокий";
    return true;
  });
}

function assignmentRow(item) {
  return `
    <div class="table-row" data-assignment-id="${item.id}">
      <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.source)} · ${employeeName(item.ownerId)}</p></div>
      <div>${departmentName(item.departmentId)}</div>
      <div>${formatDate(item.dueDate)}</div>
      <div>${chip(item.priority, priorityTone(item.priority))}</div>
      <div>${chip(item.riskLevel, priorityTone(item.riskLevel))}</div>
      <div>
        <select data-status-id="${item.id}">
          ${["Новая", "В работе", "Ждёт ответа", "Заблокирована", "На проверке", "Готово", "Закрыто", "Просрочена"]
            .map((status) => `<option ${item.status === status ? "selected" : ""}>${status}</option>`)
            .join("")}
        </select>
      </div>
    </div>
  `;
}

function renderMeetings() {
  const meetings = state.collections.meetings || [];
  const minutes = state.collections.meetingMinutes || [];

  $("#meetingsList").innerHTML = renderCards(meetings, (meeting) => `
    <div class="card">
      <strong>${escapeHtml(meeting.title)}</strong>
      <p>${formatDate(meeting.date)} · ${meeting.time || ""} · ${(meeting.agenda || []).join(", ")}</p>
      ${chip(meeting.status || "Запланирована", "ok")}
    </div>
  `);

  if (!$("#minutesOutput").textContent.trim() && minutes[0]) {
    $("#minutesOutput").textContent = minutes[0].protocolUz;
  }
}

function renderReports() {
  const reports = state.collections.reports || [];
  $("#reportsList").innerHTML = renderCards(reports, (report) => `
    <button class="card as-button" data-report-id="${report.id}" type="button">
      <strong>${escapeHtml(report.title)}</strong>
      <p>${escapeHtml(report.type)} · готовность ${report.completeness}%</p>
      ${chip(report.status, report.status === "Готов" ? "ok" : "warn")}
    </button>
  `);

  const selected = reports.find((report) => report.id === state.selectedReportId) || reports[0];
  if (selected && !state.lastReportSummary) {
    $("#reportOutput").textContent = [
      "RAHBARIYAT UCHUN QISQA XULOSA",
      "",
      `Hisobot: ${selected.title}`,
      `Holat: ${selected.status}`,
      `Tayyorlik darajasi: ${selected.completeness}%`,
      "",
      `To‘ldirilishi kerak: ${(selected.missing || []).join(", ") || "yo‘q"}.`,
    ].join("\n");
  }

  $("#employeeReportForms").innerHTML = renderCards(state.collections.employeeReportForms || [], (form) => `
    <div class="card">
      <strong>${escapeHtml(form.title)}</strong>
      <p>${departmentName(form.departmentId)} · дедлайн ${formatDate(form.deadline)} · вопросов: ${(form.questions || []).length}</p>
      ${chip(form.status, "ok")}
    </div>
  `);
}

function renderLetters() {
  const letters = state.collections.letters || [];
  $("#lettersList").innerHTML = renderCards(letters, (letter) => `
    <div class="card">
      <strong>${escapeHtml(letter.subject)}</strong>
      <p>${escapeHtml(letter.recipient)} · ${formatDate((letter.createdAt || "").slice(0, 10))}</p>
      ${chip(letter.status, letter.status === "Готово к отправке" ? "ok" : "warn")}
    </div>
  `);

  if (!$("#letterOutput").textContent.trim() && letters[0]) {
    $("#letterOutput").textContent = letters[0].bodyUz;
    state.lastLetter = letters[0];
  }
}

function renderComplaints() {
  $("#complaintsList").innerHTML = renderCards(state.collections.complaints || [], (complaint) => complaintItem(complaint, true));
}

function renderDocuments() {
  $("#documentsList").innerHTML = renderCards(state.collections.documents || [], (doc) => `
    <div class="card">
      <strong>${escapeHtml(doc.title)}</strong>
      <p>${escapeHtml(doc.type)} · ${(doc.tags || []).join(", ")}</p>
      ${chip(doc.status, doc.status === "Утверждено" ? "ok" : "warn")}
    </div>
  `);

  $("#googleStatus").innerHTML = (state.google?.tools || []).map((tool) => `
    <div class="integration">
      <span>${tool.id.slice(0, 2).toUpperCase()}</span>
      <div><strong>${tool.title}</strong><p>${tool.mode}</p></div>
    </div>
  `).join("");

  $("#workspaceLinks").innerHTML = renderCards(state.collections.workspaceLinks || [], (link) => `
    <div class="card">
      <strong>${escapeHtml(link.title)}</strong>
      <p>${escapeHtml(link.provider)} · статус: ${escapeHtml(link.status)}</p>
    </div>
  `);
}

function renderDepartments() {
  const assignments = state.collections.assignments || [];
  $("#departmentsList").innerHTML = renderCards(state.collections.departments || [], (department) => {
    const active = assignments.filter((item) => item.departmentId === department.id && !["Готово", "Закрыто"].includes(item.status));
    const overdue = active.filter(isOverdue);
    return `
      <div class="card">
        <strong>${escapeHtml(department.name)}</strong>
        <p>${escapeHtml(department.head)} · нагрузка ${department.workload} · ответы ${department.responseRate}%</p>
        ${chip(`${active.length} задач`, "ok")} ${chip(`${overdue.length} просрочено`, overdue.length ? "danger" : "ok")}
      </div>
    `;
  });
}

function renderRisks() {
  $("#risksList").innerHTML = renderCards(state.collections.risks || [], (risk) => riskItem(risk, true));
  $("#remindersList").innerHTML = renderCards(state.collections.reminders || [], (reminder) => `
    <div class="card">
      <strong>${escapeHtml(reminder.title)}</strong>
      <p>${escapeHtml(reminder.targetType)} · ${escapeHtml(reminder.channel)} · ${escapeHtml(reminder.dueAt || "")}</p>
      ${chip(reminder.status, "warn")}
    </div>
  `);
}

function renderControl() {
  $("#approvalsList").innerHTML = renderCards(state.collections.approvals || [], (approval) => `
    <div class="card">
      <strong>${escapeHtml(approval.targetType)} · ${escapeHtml(approval.targetId)}</strong>
      <p>Проверяющий: ${escapeHtml(approval.reviewer)}</p>
      ${chip(approval.status, approval.status === "Утверждено" ? "ok" : "warn")}
    </div>
  `);

  $("#decisionsList").innerHTML = renderCards(state.collections.decisions || [], (decision) => `
    <div class="card">
      <strong>${escapeHtml(decision.description)}</strong>
      <p>${escapeHtml(decision.source)} · ${formatDate(decision.dueDate)}</p>
      ${chip(decision.status, "warn")}
    </div>
  `);

  $("#knowledgeList").innerHTML = renderCards(state.collections.knowledgeBase || [], (item) => `
    <div class="card">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.category)} · ${(item.tags || []).join(", ")}</p>
    </div>
  `);

  $("#auditList").innerHTML = (state.collections.audit || []).slice(-10).reverse().map((item) => `
    <div class="audit-item">
      <strong>${escapeHtml(item.action)} · ${escapeHtml(item.entityId)}</strong>
      <p>${escapeHtml(item.at)} · ${escapeHtml(item.detail || "")}</p>
    </div>
  `).join("");
}

function renderTools() {
  $("#moduleList").innerHTML = state.modules.map((module) => `
    <div class="module-item">
      <strong>${module.number}. ${escapeHtml(module.title)}</strong>
      <p>${escapeHtml(module.description)}</p>
    </div>
  `).join("");
}

function renderList(items, renderer) {
  if (!items || !items.length) return `<div class="empty">Пока пусто.</div>`;
  return items.map((item) => renderer(item)).join("");
}

function renderCards(items, renderer) {
  if (!items || !items.length) return `<div class="empty">Пока пусто.</div>`;
  return items.map((item) => renderer(item)).join("");
}

function assignmentItem(item) {
  return `
    <div class="list-item">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${departmentName(item.departmentId)} · ${employeeName(item.ownerId)} · ${formatDate(item.dueDate)}</p>
      ${chip(item.status, isOverdue(item) ? "danger" : "warn")}
    </div>
  `;
}

function meetingItem(item) {
  return `
    <div class="list-item">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${formatDate(item.date)} · ${item.time || ""} · ${(item.agenda || []).join(", ")}</p>
    </div>
  `;
}

function reportItem(item) {
  return `
    <div class="list-item">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.type)} · готовность ${item.completeness}%</p>
      ${chip(item.status, item.status === "Готов" ? "ok" : "warn")}
    </div>
  `;
}

function complaintItem(item, asCard = false) {
  const wrapper = asCard ? "card" : "list-item";
  return `
    <div class="${wrapper}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${departmentName(item.departmentId)} · ${escapeHtml(item.category)} · ${formatDate(item.dueDate)}</p>
      ${chip(item.status, item.urgency === "Высокая" ? "danger" : "warn")}
    </div>
  `;
}

function riskItem(item, asCard = false) {
  const wrapper = asCard ? "card" : "list-item";
  return `
    <div class="${wrapper}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.actionPlan || "")}</p>
      ${chip(item.level, item.level === "Высокий" ? "danger" : "warn")} ${chip(`${item.probability}% / ${item.impact}%`, "warn")}
    </div>
  `;
}

function chip(text, tone = "") {
  return `<span class="chip ${tone}">${escapeHtml(text)}</span>`;
}

function statusTone(status) {
  if (["Готово", "Закрыто", "Выполнена"].includes(status)) return "ok";
  if (["Просрочена", "Заблокирована"].includes(status)) return "danger";
  return "warn";
}

function priorityTone(value) {
  if (value === "Высокий") return "danger";
  if (value === "Низкий") return "ok";
  return "warn";
}

function isOverdue(item) {
  return item.dueDate && item.dueDate < todayISO() && !["Готово", "Закрыто", "Выполнена"].includes(item.status);
}

function departmentName(id) {
  return (state.collections.departments || []).find((item) => item.id === id)?.name || id || "";
}

function employeeName(id) {
  return (state.collections.employees || []).find((item) => item.id === id)?.name || id || "";
}

function fillSelects() {
  const departments = state.collections.departments || [];
  const employees = state.collections.employees || [];
  const departmentOptions = departments.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  const employeeOptions = employees.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");

  ["assignmentDepartment", "complaintDepartment", "requestDepartment"].forEach((id) => {
    const select = $(`#${id}`);
    if (select && !select.innerHTML) select.innerHTML = departmentOptions;
  });
  const owner = $("#assignmentOwner");
  if (owner && !owner.innerHTML) owner.innerHTML = employeeOptions;

  $all('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = todayISO(1);
  });
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function createItem(collection, payload) {
  await api(`/api/${collection}`, { method: "POST", body: JSON.stringify(payload) });
  await loadAll();
}

async function refreshDashboardOnly() {
  state.dashboard = await api("/api/dashboard");
  renderDashboard();
}

function bindEvents() {
  $("#nav").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) return;
    showView(button.dataset.view);
  });

  $all("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.jump));
  });

  $("#refreshButton").addEventListener("click", async () => {
    await loadAll();
    toast("Данные обновлены");
  });

  $("#briefButton").addEventListener("click", async () => {
    showView("tools");
    await runAssistant("Сделай короткий брифинг для директора");
  });

  $("#searchInput").addEventListener("input", renderAssignments);

  $("#assignmentFilters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.activeFilter = button.dataset.filter;
    $all("#assignmentFilters button").forEach((item) => item.classList.toggle("active", item === button));
    renderAssignments();
  });

  $("#assignmentTable").addEventListener("change", async (event) => {
    const select = event.target.closest("select[data-status-id]");
    if (!select) return;
    await api(`/api/assignments/${select.dataset.statusId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value }),
    });
    await loadAll();
    toast("Статус обновлён");
  });

  $("#assignmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      ...formData(event.currentTarget),
      status: "Новая",
      comments: ["Создано вручную."],
      related: {},
    };
    await createItem("assignments", payload);
    event.currentTarget.reset();
    fillSelects();
    toast("Поручение создано");
  });

  $("#minutesForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    const result = await api("/api/workflows/meeting-minutes", {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        notes: data.notes,
        participants: data.participants.split(",").map((item) => item.trim()).filter(Boolean),
        meetingId: "M-001",
      }),
    });
    $("#minutesOutput").textContent = result.ai.protocolUz;
    await loadAll();
    toast("Протокол и задачи созданы");
  });

  $("#reportsList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-id]");
    if (!button) return;
    state.selectedReportId = button.dataset.reportId;
    state.lastReportSummary = "";
    renderReports();
  });

  $("#reportSummaryButton").addEventListener("click", async () => {
    const result = await api("/api/ai/reportSummary", {
      method: "POST",
      body: JSON.stringify({ reportId: state.selectedReportId }),
    });
    state.lastReportSummary = result.summaryUz;
    $("#reportOutput").textContent = result.summaryUz;
    toast("Выжимка сформирована");
  });

  $all("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportReport(button.dataset.export));
  });

  $("#createReportFormButton").addEventListener("click", async () => {
    await createItem("employee-report-forms", {
      title: "Еженедельный отчёт отдела",
      departmentId: "D-005",
      deadline: todayISO(3),
      questions: ["Основные результаты", "Выполненные задачи", "Просрочки", "Риски", "Потребности"],
      status: "Активна",
      responses: [],
    });
    toast("Форма отчёта создана");
  });

  $("#letterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formData(event.currentTarget);
    const result = await api("/api/ai/letter", { method: "POST", body: JSON.stringify(payload) });
    const letter = await api("/api/letters", {
      method: "POST",
      body: JSON.stringify({
        recipient: payload.recipient,
        subject: result.subject,
        instruction: payload.instruction,
        bodyUz: result.bodyUz,
        status: payload.mode,
      }),
    });
    state.lastLetter = letter;
    $("#letterOutput").textContent = result.bodyUz;
    $("#letterQuality").innerHTML = result.quality.map((item) => `<div class="${item.status}">${escapeHtml(item.label)}</div>`).join("");
    await loadAll();
    toast("Письмо подготовлено");
  });

  $("#gmailDraftButton").addEventListener("click", async () => {
    const letter = state.lastLetter || (state.collections.letters || [])[0];
    if (!letter) return toast("Нет письма для черновика");
    const result = await api("/api/google/draft-email", {
      method: "POST",
      body: JSON.stringify({ to: letter.recipient, subject: letter.subject, body: letter.bodyUz }),
    });
    $("#googleOutput").textContent = JSON.stringify(result, null, 2);
    showView("documents");
    toast("Gmail-черновик создан в mock-режиме");
  });

  $("#complaintForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await createItem("complaints", {
      ...formData(event.currentTarget),
      status: "Новая",
      comments: [],
    });
    event.currentTarget.reset();
    fillSelects();
    toast("Обращение зарегистрировано");
  });

  $("#createDocumentButton").addEventListener("click", async () => {
    await createItem("documents", {
      title: "Новый рабочий документ",
      type: "Документ",
      status: "Черновик",
      tags: ["новый"],
      linked: {},
      versions: [{ version: 1, at: new Date().toISOString(), note: "Создано в системе" }],
    });
    toast("Документ добавлен");
  });

  $("#driveSearchButton").addEventListener("click", async () => {
    const result = await api("/api/google/drive-search", {
      method: "POST",
      body: JSON.stringify({ query: $("#searchInput").value || "критическое сырьё" }),
    });
    $("#googleOutput").textContent = JSON.stringify(result, null, 2);
    toast("Поиск Drive выполнен в mock-режиме");
  });

  $("#departmentRequestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formData(event.currentTarget);
    payload.departmentName = departmentName(payload.departmentId);
    const result = await api("/api/workflows/department-request", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    $("#departmentRequestOutput").textContent = result.ai.letterUz;
    await loadAll();
    toast("Запрос, задача, форма и напоминание созданы");
  });

  $all("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action));
  });

  $("#assistantForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.prompt;
    const prompt = input.value.trim();
    if (!prompt) return;
    input.value = "";
    await runAssistant(prompt);
  });

  $all("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => runAssistant(button.dataset.prompt));
  });
}

async function handleAction(action) {
  if (action === "daily-briefing") {
    const result = await api("/api/workflows/daily-briefing", { method: "POST", body: "{}" });
    $("#briefing").innerHTML = result.cards.map((card) => `<div class="brief-card"><strong>${escapeHtml(card.title)}</strong><p>${escapeHtml(card.text)}</p></div>`).join("");
    toast("Брифинг сформирован");
  }

  if (action === "delay-analysis") {
    const result = await api("/api/workflows/delay-analysis", { method: "POST", body: "{}" });
    $("#delayAnalysis").innerHTML = renderCards(result.reasons, (item) => `
      <div class="card">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.likelyReason)}</p>
        ${chip(item.recommendation, "warn")}
      </div>
    `);
    toast("Анализ задержек готов");
  }

  if (action === "risk-ai") {
    const result = await api("/api/ai/risks", { method: "POST", body: "{}" });
    $("#risksList").innerHTML = `
      <div class="card"><strong>Рекомендация</strong><p>${escapeHtml(result.recommendation)}</p></div>
      ${renderCards(result.risks, (risk) => riskItem(risk, true))}
    `;
    toast("AI-анализ рисков готов");
  }

  if (action === "meeting-prep") {
    const result = await api("/api/workflows/meeting-prep", {
      method: "POST",
      body: JSON.stringify({ meetingId: "M-001" }),
    });
    $("#minutesOutput").textContent = [
      "ЦЕНТР ПОДГОТОВКИ К СОВЕЩАНИЮ",
      "",
      `Встреча: ${result.meeting.title}`,
      "",
      "Повестка:",
      ...result.agenda.map((item, index) => `${index + 1}. ${item}`),
      "",
      "Вопросы участникам:",
      ...result.questions.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n");
    showView("meetings");
    toast("Справка к совещанию готова");
  }

  if (action === "complaint-report") {
    showView("reports");
    $("#reportOutput").textContent = [
      "ОТЧЁТ ПО ЖАЛОБАМ",
      "",
      ...state.collections.complaints.map((item) => `- ${item.title}: ${item.status}, отдел: ${departmentName(item.departmentId)}`),
    ].join("\n");
  }
}

async function runAssistant(prompt) {
  addMessage("user", prompt);
  let result;
  const lower = prompt.toLowerCase();
  if (lower.includes("письм") || lower.includes("узбек")) {
    result = await api("/api/ai/letter", {
      method: "POST",
      body: JSON.stringify({
        recipient: "Министерство горнодобывающей промышленности и геологии",
        instruction: prompt,
        mode: "Черновик",
      }),
    });
    addMessage("assistant", result.bodyUz);
    return;
  }
  if (lower.includes("риск") || lower.includes("задерж")) {
    result = await api("/api/ai/risks", { method: "POST", body: JSON.stringify({ prompt }) });
    addMessage("assistant", `${result.recommendation}\n\n${result.risks.map((risk) => `- ${risk.title}: ${risk.actionPlan}`).join("\n")}`);
    return;
  }
  result = await api("/api/ai/briefing", { method: "POST", body: JSON.stringify({ prompt }) });
  addMessage("assistant", result.directorText || JSON.stringify(result, null, 2));
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  $("#chat").append(message);
  $("#chat").scrollTop = $("#chat").scrollHeight;
}

async function exportReport(format) {
  const selected = (state.collections.reports || []).find((item) => item.id === state.selectedReportId) || state.collections.reports?.[0];
  const payload = {
    title: selected?.title || "Report",
    content: $("#reportOutput").textContent,
    rows: state.collections.reports || [],
  };
  const response = await fetch(`/api/export/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${payload.title}.${format === "csv" ? "csv" : format}`;
  link.click();
  URL.revokeObjectURL(url);
}

function showView(view) {
  $all(".nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $all(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.view === view));
  $("#pageTitle").textContent = titles[view] || "Executive Control Center";
  const params = new URLSearchParams(location.search);
  params.set("view", view);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function toast(text) {
  const toastEl = $("#toast");
  toastEl.textContent = text;
  toastEl.classList.add("visible");
  setTimeout(() => toastEl.classList.remove("visible"), 2400);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

bindEvents();
loadAll()
  .then(() => {
    const view = new URLSearchParams(location.search).get("view");
    if (view && titles[view]) showView(view);
    addMessage("assistant", "Система готова: можно дать поручение на русском, а документы и письма будут формироваться в управленческом формате.");
  })
  .catch((error) => {
    $("#backendStatus").textContent = "Ошибка API";
    toast(error.message);
    console.error(error);
  });
