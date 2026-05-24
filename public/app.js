const state = {
  meta: {},
  modules: [],
  dashboard: null,
  google: null,
  collections: {},
  activeFilter: "all",
  activeView: "dashboard",
  search: "",
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

const doneStatuses = new Set(["Готово", "Закрыто", "Утверждено", "Yopildi"]);
const statusOrder = ["Новая", "В работе", "Ждёт ответ", "Заблокирована", "На проверке", "Готово", "Закрыто", "Просрочена"];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", () => {
  bindUi();
  setDatePill();
  loadAll().catch((error) => {
    console.error(error);
    toast("Не удалось подключиться к API. Проверьте backend.");
    setText("backendStatus", "ошибка подключения");
  });
});

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
  return contentType.includes("application/json") ? response.json() : response.text();
}

async function loadAll() {
  const bootstrap = await api("/api/bootstrap");
  state.meta = bootstrap.meta || {};
  state.modules = bootstrap.modules || [];
  state.dashboard = bootstrap.dashboard || {};
  state.google = bootstrap.google || null;

  const results = await Promise.all(collectionNames.map((name) => api(`/api/${name}`)));
  collectionNames.forEach((name, index) => {
    state.collections[toCamel(name)] = Array.isArray(results[index]) ? results[index] : [];
  });

  renderAll();
}

function bindUi() {
  $("#nav")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) showView(button.dataset.view);
  });

  document.body.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-jump]");
    if (jump) {
      showView(jump.dataset.jump);
      return;
    }

    const promptButton = event.target.closest("[data-prompt]");
    if (promptButton) {
      runAssistant(promptButton.dataset.prompt);
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) handleAction(action.dataset.action);

    const report = event.target.closest("[data-report-id]");
    if (report) {
      summarizeReport(report.dataset.reportId);
      showView("reports");
    }
  });

  $("#assignmentFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.activeFilter = button.dataset.filter;
    $$("#assignmentFilters button").forEach((item) => item.classList.toggle("active", item === button));
    renderAssignments();
  });

  $("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.toLowerCase().trim();
    renderAssignments();
    renderPriorityAssignments();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#searchInput")?.focus();
    }
  });

  $("#assistantForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.prompt;
    const prompt = input.value.trim();
    if (!prompt) return;
    input.value = "";
    runAssistant(prompt);
  });

  $("#createButton")?.addEventListener("click", () => handleAction("new-assignment"));
}

function renderAll() {
  setText("backendStatus", "API подключён");
  renderNavigationBadges();
  renderDashboard();
  renderAssignments();
  renderSecondaryViews();
  renderGoogleStatus();
}

function renderDashboard() {
  renderDirectorBrief();
  renderKpiGrid();
  renderPriorityAssignments();
  renderDepartmentStatus();
  renderOverdueList();
  renderMeetingTimeline();
  renderQueues();
  renderLetterPreview();
  renderDocuments();
  renderActivity();
  seedAssistantMessage();
}

function renderDirectorBrief() {
  const metrics = getMetrics();
  const nextMeeting = meetingsToday()[0];
  const lines = [
    "Доброе утро!",
    `На сегодня запланировано ${metrics.meetingsToday} встреч.`,
    `${metrics.activeAssignments} поручений требуют внимания.`,
    `${metrics.overdueAssignments} задач просрочены.`,
    `${metrics.pendingReports} отчётов ожидают проверки.`,
    `${metrics.openComplaints} жалоб требуют реакции.`,
    `${metrics.highRisks} риска требуют доклада.`,
    nextMeeting ? `Подготовьте краткий отчёт к ${nextMeeting.time || "встрече"}.` : "Первый фокус дня - закрыть просрочки и запросить статусы.",
  ];

  setHtml(
    "directorBrief",
    `<div class="brief-text">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`
  );
}

function renderKpiGrid() {
  const metrics = getMetrics();
  const cards = [
    ["Поручения", metrics.activeAssignments, "Активные", "+12 за неделю", "blue", "☑"],
    ["Просрочено", metrics.overdueAssignments, "Критичных", "+3 за день", "red", "⏱"],
    ["Встречи сегодня", metrics.meetingsToday, "Запланировано", nextMeetingText(), "cyan", "□"],
    ["Отчёты на проверке", metrics.pendingReports, "Ожидают", "+4 за день", "blue", "▣"],
    ["Письма в работе", metrics.draftLetters, "Черновиков", `${metrics.lettersToSend} требуют отправки`, "blue", "✉"],
    ["Жалобы", metrics.openComplaints, "Открытые", `${metrics.urgentComplaints} срочная`, "red", "◇"],
  ];

  setHtml(
    "kpiGrid",
    cards
      .map(
        ([title, value, label, trend, tone, icon]) => `
          <article class="kpi-card ${tone}">
            <div class="kpi-icon">${icon}</div>
            <span>${escapeHtml(title)}</span>
            <strong>${value}</strong>
            <p>${escapeHtml(label)}</p>
            <em>${escapeHtml(trend)}</em>
          </article>
        `
      )
      .join("")
  );
}

function renderPriorityAssignments() {
  const rows = filteredAssignments()
    .sort(sortByExecutivePriority)
    .slice(0, 6);

  setHtml(
    "priorityAssignments",
    `
      <div class="data-row data-head assignment-grid">
        <span>Поручение</span><span>Ответственный</span><span>Отдел</span><span>Дедлайн</span><span>Риск</span><span>Статус</span>
      </div>
      ${
        rows
          .map(
            (item, index) => `
              <div class="data-row assignment-grid">
                <div class="title-cell">
                  <i class="${isOverdue(item) ? "signal danger" : index < 2 ? "signal warn" : "signal"}"></i>
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>${escapeHtml(item.source || "Поручение")}</small>
                </div>
                <span>${personWithAvatar(employeeName(item.ownerId), item.ownerId)}</span>
                <span>${escapeHtml(departmentName(item.departmentId))}</span>
                <time class="${isOverdue(item) ? "danger-text" : ""}">${formatDate(item.dueDate)}</time>
                ${badge(item.riskLevel || "Низкий", riskTone(item.riskLevel))}
                ${badge(item.status || "Новая", statusTone(item.status))}
              </div>
            `
          )
          .join("") || emptyState("Приоритетных поручений нет.")
      }
    `
  );
}

function renderDepartmentStatus() {
  const departments = state.collections.departments || [];
  const assignments = state.collections.assignments || [];
  const tasks = state.collections.employeeTasks || [];
  const reports = state.collections.reports || [];

  const rows = departments.slice(1, 7).map((department) => {
    const departmentAssignments = assignments.filter((item) => item.departmentId === department.id);
    const departmentTasks = tasks.filter((item) => item.departmentId === department.id);
    const overdue = departmentAssignments.filter(isOverdue).length;
    const reportCount = reports.filter((item) => item.ownerDepartmentId === department.id).length;
    const rate = Number(department.responseRate || 0);
    return { department, taskCount: departmentAssignments.length + departmentTasks.length, overdue, reportCount, rate };
  });

  setHtml(
    "departmentStatus",
    `
      <div class="department-row department-head"><span>Отдел</span><span>Задачи</span><span>Просрочено</span><span>Отчёты</span></div>
      ${rows
        .map(
          ({ department, taskCount, overdue, reportCount, rate }) => `
            <div class="department-row">
              <strong>${escapeHtml(department.name)}</strong>
              <span>${taskCount}</span>
              <span class="${overdue ? "danger-text" : ""}">${overdue}</span>
              <span class="rate-cell"><i class="ring" style="--rate:${rate}"></i>${Math.max(rate, reportCount ? rate : 60)}%</span>
            </div>
          `
        )
        .join("")}
    `
  );
}

function renderOverdueList() {
  const overdue = filteredAssignments("overdue").slice(0, 5);
  setHtml(
    "overdueList",
    overdue
      .map(
        (item) => `
          <div class="compact-row">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${personWithAvatar(employeeName(item.ownerId), item.ownerId)}</span>
            <b>${daysOverdue(item.dueDate)} дн.</b>
          </div>
        `
      )
      .join("") || emptyState("Просроченных задач нет.")
  );
}

function renderMeetingTimeline() {
  const meetings = meetingsToday().length ? meetingsToday() : (state.collections.meetings || []).slice(0, 4);
  setHtml(
    "meetingTimeline",
    meetings
      .map(
        (meeting) => `
          <div class="meeting-row">
            <time>${meeting.time || "09:00"}</time>
            <div>
              <strong>${escapeHtml(meeting.title)}</strong>
              <span>${escapeHtml((meeting.agenda || []).slice(0, 2).join(", ") || meeting.status || "Рабочая встреча")}</span>
            </div>
            <div class="avatars">${meetingAvatars(meeting)}</div>
          </div>
        `
      )
      .join("") || emptyState("На сегодня встреч нет.")
  );
}

function renderQueues() {
  const reports = (state.collections.reports || []).filter((item) => item.status !== "Готов").slice(0, 4);
  const complaints = (state.collections.complaints || []).filter((item) => item.status !== "Закрыто").slice(0, 4);
  const approvals = state.collections.approvals || [];

  setHtml("reportsQueue", reports.map((item) => queueRow(item.title, departmentName(item.ownerDepartmentId), item.status, statusTone(item.status))).join("") || emptyState("Нет отчётов на проверке."));
  setHtml("complaintsQueue", complaints.map((item) => queueRow(`#${item.id}`, item.title, item.status, item.urgency === "Высокая" ? "danger" : "warn")).join("") || emptyState("Нет открытых жалоб."));
  setHtml("approvalQueue", approvals.map((item) => queueRow(targetTitle(item), item.reviewer || "Проверяющий", item.status, statusTone(item.status))).join("") || emptyState("Нет документов на согласовании."));
}

function renderLetterPreview() {
  const letter = (state.collections.letters || [])[0];
  const text = letter?.bodyUz || "Hurmatli hamkasblar,\n\nRasmiy xat matni AI orqali tayyorlangach shu yerda ko‘rinadi.\n\nHurmat bilan,\nBosh direktor yordamchisi";
  const preview = `${text}\n\n[${letter?.status || "Черновик"}]`;
  setText("letterPreview", preview);
}

function renderDocuments() {
  const documents = (state.collections.documents || []).slice(0, 5);
  setHtml(
    "documentList",
    documents
      .map(
        (document) => `
          <div class="document-row">
            <span>${documentIcon(document.type)}</span>
            <strong>${escapeHtml(document.title)}</strong>
            <time>${escapeHtml(document.status || "Черновик")}</time>
          </div>
        `
      )
      .join("") || emptyState("Документы не загружены.")
  );
}

function renderActivity() {
  const audit = (state.collections.audit || []).slice(-6);
  const fallback = [
    ["Создано поручение", "Петров П.П.", "09:12", "☑"],
    ["Изменён статус задачи", "Иванов И.И.", "09:45", "◉"],
    ["Загружен документ", "Юлдашева М.М.", "10:02", "▣"],
    ["Создан черновик письма", "Сидорова А.А.", "10:15", "✉"],
    ["Отчёт отправлен", "Ким Д.В.", "10:30", "□"],
    ["Жалоба зарегистрирована", "Юлдашева М.М.", "10:45", "◇"],
  ];
  const items = audit.length > 1 ? audit.map((item) => [translateAudit(item.action), actorName(item.actor), formatTime(item.at), "◉"]) : fallback;

  setHtml(
    "activityTimeline",
    items
      .map(
        ([title, actor, time, icon]) => `
          <div class="activity-item">
            <span class="activity-icon">${icon}</span>
            <strong>${escapeHtml(title)}</strong>
            <em>${escapeHtml(actor)}</em>
            <time>${escapeHtml(time)}</time>
          </div>
        `
      )
      .join("")
  );
}

function renderAssignments() {
  const rows = filteredAssignments();
  setHtml(
    "assignmentTable",
    `
      <div class="data-row data-head assignment-page-grid">
        <span>Поручение</span><span>Источник</span><span>Ответственный</span><span>Отдел</span><span>Срок</span><span>Приоритет</span><span>Риск</span><span>Статус</span>
      </div>
      ${
        rows
          .map(
            (item) => `
              <div class="data-row assignment-page-grid">
                <div class="title-cell"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || "")}</small></div>
                <span>${escapeHtml(item.source || "")}</span>
                <span>${personWithAvatar(employeeName(item.ownerId), item.ownerId)}</span>
                <span>${escapeHtml(departmentName(item.departmentId))}</span>
                <time class="${isOverdue(item) ? "danger-text" : ""}">${formatDate(item.dueDate)}</time>
                ${badge(item.priority || "Средний", priorityTone(item.priority))}
                ${badge(item.riskLevel || "Низкий", riskTone(item.riskLevel))}
                <select data-status-id="${escapeHtml(item.id)}">${statusOrder.map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select>
              </div>
            `
          )
          .join("") || emptyState("Поручения по выбранному фильтру не найдены.")
      }
    `
  );
}

function renderSecondaryViews() {
  renderCardGrid("employeeTasks", state.collections.employeeTasks, (task) => card("Задача", task.title, `${employeeName(task.employeeId)} · ${departmentName(task.departmentId)} · ${formatDate(task.dueDate)}`, [task.status, task.priority]));
  renderMeetingsPage();
  renderReportsPage();
  renderLettersPage();
  renderCardGrid("complaintsList", state.collections.complaints, (item) => card(item.category || "Жалоба", item.title, `${departmentName(item.departmentId)} · срок ${formatDate(item.dueDate)}`, [item.status, item.urgency]));
  renderCardGrid("documentsList", state.collections.documents, (item) => card(item.type || "Документ", item.title, `${item.status} · ${(item.tags || []).join(", ")}`, [item.status]));
  renderCardGrid("decisionsList", state.collections.decisions, (item) => card("Решение", item.description, `${item.source} · срок ${formatDate(item.dueDate)}`, [item.status]));
  renderCardGrid("risksList", state.collections.risks, (item) => card(item.source || "Риск", item.title, `Вероятность ${item.probability}% · влияние ${item.impact}%`, [item.level, item.status]));
  renderCardGrid("remindersList", state.collections.reminders, (item) => card(item.channel || "Напоминание", item.title, formatDate((item.dueAt || "").slice(0, 10)), [item.status]));
  renderDepartmentsPage();
  renderEmployeesPage();
  renderCardGrid("knowledgeList", state.collections.knowledgeBase, (item) => card(item.category || "База знаний", item.title, (item.tags || []).join(", "), []));
  renderAuditPage();
  renderCardGrid("approvalsList", state.collections.approvals, (item) => card(item.targetType || "Согласование", targetTitle(item), item.reviewer || "Проверяющий", [item.status]));
}

function renderMeetingsPage() {
  renderCardGrid("meetingsList", state.collections.meetings, (meeting) => card(meeting.time || "Встреча", meeting.title, `${formatDate(meeting.date)} · ${(meeting.agenda || []).join(", ")}`, [meeting.status]));
  const minutes = (state.collections.meetingMinutes || [])[0];
  const meeting = (state.collections.meetings || [])[0];
  const output = minutes?.protocolUz || buildMeetingPreview(meeting);
  setText("minutesOutput", output);
}

function renderReportsPage() {
  renderCardGrid("reportsList", state.collections.reports, (report) => `
    <button class="card as-button" data-report-id="${escapeHtml(report.id)}" type="button">
      <span>${escapeHtml(report.type || "Отчёт")}</span>
      <strong>${escapeHtml(report.title)}</strong>
      <p>${departmentName(report.ownerDepartmentId)} · готовность ${report.completeness || 0}%</p>
      <div>${badge(report.status, statusTone(report.status))}</div>
    </button>
  `);
  const report = (state.collections.reports || [])[0];
  setText("reportOutput", buildReportPreview(report));
}

function renderLettersPage() {
  renderCardGrid("lettersList", state.collections.letters, (letter) => card(letter.recipient || "Адресат", letter.subject, formatDate((letter.createdAt || "").slice(0, 10)), [letter.status]));
  setText("letterOutput", (state.collections.letters || [])[0]?.bodyUz || "");
}

function renderDepartmentsPage() {
  const departments = state.collections.departments || [];
  renderCardGrid("departmentsList", departments, (department) => {
    const tasks = (state.collections.assignments || []).filter((item) => item.departmentId === department.id);
    const overdue = tasks.filter(isOverdue).length;
    return card(department.head || "Руководитель отдела", department.name, `Задач: ${tasks.length} · просрочено: ${overdue} · исполнительность ${department.responseRate || 0}%`, [overdue ? "Есть риск" : "Стабильно"]);
  });
}

function renderEmployeesPage() {
  renderCardGrid("employeesList", state.collections.employees, (employee) => card(employee.role || "Сотрудник", employee.name, `${departmentName(employee.departmentId)} · ответ ${employee.responseScore || 0}%`, [employee.responseScore >= 80 ? "Сильный ответ" : "Контроль"]));
}

function renderAuditPage() {
  const audit = state.collections.audit || [];
  setHtml(
    "auditList",
    audit
      .slice()
      .reverse()
      .map(
        (item) => `
          <div class="audit-row">
            <time>${formatDateTime(item.at)}</time>
            <strong>${escapeHtml(translateAudit(item.action))}</strong>
            <span>${escapeHtml(actorName(item.actor))}</span>
            <p>${escapeHtml(item.detail || item.entityType || "")}</p>
          </div>
        `
      )
      .join("") || emptyState("Журнал аудита пока пуст.")
  );
}

function renderGoogleStatus() {
  const google = state.google || {};
  const integrations = [
    ["Google Calendar", google.calendar],
    ["Gmail", google.gmail],
    ["Google Docs", google.docs],
    ["Google Sheets", google.sheets],
    ["Google Drive", google.drive],
  ];
  setHtml(
    "googleStatus",
    integrations
      .map(([name, value]) => `<span>${escapeHtml(name)}: <b>${value ? "подключено" : "mock-режим"}</b></span>`)
      .join("")
  );
}

function renderNavigationBadges() {
  const metrics = getMetrics();
  setBadge("navAssignments", metrics.activeAssignments);
  setBadge("navReports", metrics.pendingReports);
  setBadge("navLetters", metrics.draftLetters);
  setBadge("navComplaints", metrics.openComplaints);
  setBadge("navRisks", metrics.highRisks);
  setBadge("navApprovals", (state.collections.approvals || []).filter((item) => item.status !== "Утверждено").length);
  setText("notificationCount", metrics.overdueAssignments + metrics.highRisks + metrics.openComplaints);
}

function getMetrics() {
  const assignments = state.collections.assignments || [];
  const reports = state.collections.reports || [];
  const letters = state.collections.letters || [];
  const complaints = state.collections.complaints || [];
  const risks = state.collections.risks || [];
  const activeAssignments = assignments.filter((item) => !isDone(item.status)).length;
  const overdueAssignments = assignments.filter(isOverdue).length;
  const pendingReports = reports.filter((item) => item.status !== "Готов").length;
  const draftLetters = letters.filter((item) => item.status !== "Готово к отправке").length;
  const lettersToSend = letters.filter((item) => item.status === "Готово к отправке").length;
  const openComplaints = complaints.filter((item) => item.status !== "Закрыто").length;
  const urgentComplaints = complaints.filter((item) => item.urgency === "Высокая").length;
  const highRisks = risks.filter((item) => item.level === "Высокий" && item.status !== "Закрыт").length;
  return { activeAssignments, overdueAssignments, pendingReports, draftLetters, lettersToSend, openComplaints, urgentComplaints, highRisks, meetingsToday: meetingsToday().length };
}

function filteredAssignments(forceFilter) {
  const assignments = state.collections.assignments || [];
  const filter = forceFilter || state.activeFilter;
  const today = todayISO();
  return assignments.filter((item) => {
    const haystack = [item.title, item.description, item.source, departmentName(item.departmentId), employeeName(item.ownerId), item.status, item.priority, item.riskLevel].join(" ").toLowerCase();
    if (state.search && !haystack.includes(state.search)) return false;
    if (filter === "today") return item.dueDate === today;
    if (filter === "overdue") return isOverdue(item);
    if (filter === "risk") return item.riskLevel === "Высокий" || item.priority === "Высокий";
    return true;
  });
}

function meetingsToday() {
  const today = todayISO();
  return (state.collections.meetings || []).filter((item) => item.date === today);
}

function showView(view) {
  state.activeView = view;
  $$(".view").forEach((section) => section.classList.toggle("active", section.dataset.view === view));
  $$("#nav [data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleAction(action) {
  if (action === "daily-briefing") {
    await runAssistant("Подготовь краткий ежедневный брифинг для директора");
    return;
  }

  if (action === "department-request") {
    try {
      toast("Создаю запрос в отдел...");
      const department = (state.collections.departments || []).find((item) => item.id !== "D-000") || {};
      await api("/api/workflows/department-request", {
        method: "POST",
        body: JSON.stringify({
          departmentId: department.id,
          departmentName: department.name || "Отдел",
          topic: "Расчёт бюджета по проекту",
          needed: "Предоставить расчёт бюджета, риски и срок готовности.",
          dueDate: todayISO(2),
          priority: "Высокий",
        }),
      });
      await loadAll();
      toast("Запрос, задача, письмо и напоминание созданы.");
    } catch (error) {
      toast(`Не удалось создать запрос: ${error.message}`);
    }
    return;
  }

  if (action === "new-letter") {
    await runAssistant("Подготовь письмо в Министерство о согласовании отчёта по критическому сырью на узбекском латинском");
    showView("letters");
    return;
  }

  if (action === "new-meeting") {
    showView("meetings");
    toast("Открыл модуль встреч. Здесь будут повестка, протокол и задачи.");
    return;
  }

  if (action === "new-document") {
    showView("documents");
    toast("Открыл документы и Google Workspace.");
    return;
  }

  showView("assignments");
  toast("Открыл контроль поручений.");
}

async function runAssistant(prompt) {
  addChat("user", prompt);
  try {
    let result;
    const lower = prompt.toLowerCase();
    if (lower.includes("пись") || lower.includes("министер") || lower.includes("uzbek")) {
      result = await api("/api/ai/letter", {
        method: "POST",
        body: JSON.stringify({
          instruction: prompt,
          recipient: "Vazirlik",
          subject: "Hisobotni kelishish yuzasidan",
        }),
      });
      const text = result.bodyUz || result.text || JSON.stringify(result, null, 2);
      setText("letterPreview", `${text}\n\n[AI черновик]`);
      setText("letterOutput", text);
      addChat("assistant", text);
      return;
    }

    if (lower.includes("риск")) {
      result = await api("/api/ai/risks", { method: "POST", body: JSON.stringify({ prompt }) });
      addChat("assistant", result.recommendation || result.text || stringifyResult(result));
      return;
    }

    if (lower.includes("просроч")) {
      const overdue = filteredAssignments("overdue");
      addChat("assistant", overdue.length ? overdue.map((item) => `${item.title} - ${employeeName(item.ownerId)}, ${daysOverdue(item.dueDate)} дн.`).join("\n") : "Просроченных поручений нет.");
      return;
    }

    result = await api("/api/workflows/daily-briefing", { method: "POST", body: JSON.stringify({ prompt }) });
    addChat("assistant", result.directorText || result.text || stringifyResult(result));
  } catch (error) {
    addChat("assistant", `Команда не выполнена: ${error.message}`);
  }
}

async function summarizeReport(reportId) {
  try {
    const result = await api("/api/ai/reportSummary", { method: "POST", body: JSON.stringify({ reportId }) });
    setText("reportOutput", result.summaryUz || stringifyResult(result));
    toast("Executive summary сформирован.");
  } catch (error) {
    toast(`Не удалось сформировать отчёт: ${error.message}`);
  }
}

function addChat(role, text) {
  const html = `<div class="message ${role}"><strong>${role === "user" ? "Вы" : "AI-команда"}</strong><pre>${escapeHtml(text)}</pre></div>`;
  ["chat", "aiPageChat"].forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.insertAdjacentHTML("beforeend", html);
    node.scrollTop = node.scrollHeight;
  });
}

function seedAssistantMessage() {
  const node = $("#chat");
  if (!node || node.children.length) return;
  addChat("assistant", "Готов анализировать поручения, отчёты, риски и готовить официальные письма на узбекском латинском.");
}

function renderCardGrid(id, items, render) {
  const list = Array.isArray(items) ? items : [];
  setHtml(id, list.map(render).join("") || emptyState("Пока нет данных."));
}

function card(label, title, meta, chips = []) {
  return `
    <article class="card">
      <span>${escapeHtml(label || "")}</span>
      <strong>${escapeHtml(title || "")}</strong>
      <p>${escapeHtml(meta || "")}</p>
      <div>${chips.filter(Boolean).map((item) => badge(item, statusTone(item) || priorityTone(item) || riskTone(item))).join("")}</div>
    </article>
  `;
}

function queueRow(title, subtitle, status, tone) {
  return `
    <div class="queue-row">
      <div><strong>${escapeHtml(title || "")}</strong><span>${escapeHtml(subtitle || "")}</span></div>
      ${badge(status || "Новая", tone || statusTone(status))}
    </div>
  `;
}

function buildMeetingPreview(meeting) {
  if (!meeting) return "";
  return [
    "BAYONNOMA",
    "",
    `Mavzu: ${meeting.title}`,
    `Vaqt: ${formatDate(meeting.date)} ${meeting.time || ""}`,
    "",
    "Kun tartibi:",
    ...(meeting.agenda || []).map((item, index) => `${index + 1}. ${item}`),
    "",
    "Natija: uchrashuv yakunida mas'ullar, muddatlar va keyingi qadamlar aniqlashtiriladi.",
  ].join("\n");
}

function buildReportPreview(report) {
  if (!report) return "";
  return [
    "RAHBARIYAT UCHUN QISQA XULOSA",
    "",
    `Hisobot: ${report.title}`,
    `Holat: ${report.status}`,
    `Tayyorlik darajasi: ${report.completeness || 0}%`,
    "",
    `To'ldirilishi kerak: ${(report.missing || []).join(", ") || "yo'q"}.`,
  ].join("\n");
}

function targetTitle(item) {
  if (!item) return "";
  if (item.targetType === "letter") return (state.collections.letters || []).find((letter) => letter.id === item.targetId)?.subject || "Письмо";
  if (item.targetType === "report") return (state.collections.reports || []).find((report) => report.id === item.targetId)?.title || "Отчёт";
  return item.targetId || "Документ";
}

function personWithAvatar(name, seed = "") {
  return `<span class="person"><i>${initials(name || seed)}</i>${escapeHtml(shortName(name || "Ответственный"))}</span>`;
}

function meetingAvatars(meeting) {
  const participants = meeting.participants || [];
  const names = participants.map(departmentName).slice(0, 3);
  return `${names.map((name) => `<i title="${escapeHtml(name)}">${initials(name)}</i>`).join("")}${participants.length > 3 ? `<b>+${participants.length - 3}</b>` : ""}`;
}

function documentIcon(type = "") {
  const value = type.toLowerCase();
  if (value.includes("sheet") || value.includes("excel")) return "▦";
  if (value.includes("pdf")) return "▧";
  return "▣";
}

function departmentName(id) {
  return (state.collections.departments || []).find((item) => item.id === id)?.name || id || "";
}

function employeeName(id) {
  return (state.collections.employees || []).find((item) => item.id === id)?.name || id || "";
}

function actorName(id) {
  if (!id) return "Система";
  return (state.collections.employees || []).find((item) => item.id === id)?.name || (id === "U-001" ? "Ассистент ГД" : id);
}

function initials(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "•";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function shortName(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return value;
  return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
}

function sortByExecutivePriority(a, b) {
  const score = (item) => (isOverdue(item) ? 100 : 0) + (item.riskLevel === "Высокий" ? 30 : 0) + (item.priority === "Высокий" ? 20 : 0) - daysUntil(item.dueDate);
  return score(b) - score(a);
}

function isDone(status = "") {
  return doneStatuses.has(status);
}

function isOverdue(item) {
  return item?.dueDate && item.dueDate < todayISO() && !isDone(item.status);
}

function daysUntil(value) {
  if (!value) return 999;
  return Math.ceil((new Date(`${value}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000);
}

function daysOverdue(value) {
  return Math.max(1, Math.abs(daysUntil(value)));
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

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function setDatePill() {
  const value = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(new Date());
  setText("datePill", value);
}

function nextMeetingText() {
  const meeting = meetingsToday().sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))[0];
  return meeting?.time ? `${meeting.time} следующая` : "Нет встреч";
}

function statusTone(value = "") {
  if (["Готово", "Закрыто", "Утверждено", "Готово к отправке", "Активна"].includes(value)) return "ok";
  if (["Просрочена", "Заблокирована", "Требует правок"].includes(value)) return "danger";
  if (["На проверке", "На согласовании", "Ждёт ответ", "Черновик", "В работе", "Новая"].includes(value)) return "info";
  return "muted";
}

function priorityTone(value = "") {
  if (value === "Высокий" || value === "Высокая") return "danger";
  if (value === "Средний" || value === "Средняя") return "warn";
  return "ok";
}

function riskTone(value = "") {
  if (value === "Высокий" || value === "Высокая") return "danger";
  if (value === "Средний" || value === "Средняя") return "warn";
  return "ok";
}

function badge(text, tone = "muted") {
  return `<span class="badge ${tone}">${escapeHtml(text || "")}</span>`;
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function translateAudit(action = "") {
  const map = {
    "seed.created": "Создана стартовая база",
    "ai.briefing": "AI подготовил брифинг",
    "ai.letter": "AI создал черновик письма",
    "ai.risks": "AI проанализировал риски",
  };
  return map[action] || action || "Действие";
}

function toCamel(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function stringifyResult(value) {
  return JSON.stringify(value, null, 2);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value == null ? "" : String(value);
}

function setBadge(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value > 0 ? String(value) : "";
}

function setHtml(id, value) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = value || "";
}

function toast(message) {
  const node = $("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), 2800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
