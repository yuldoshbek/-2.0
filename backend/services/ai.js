const { officialDepartmentRequest, officialUzbekLetter, translateSimple } = require("./language");

async function runAiTask(task, payload, context) {
  if (context.config.aiProvider === "openai" && context.config.openaiApiKey) {
    const live = await tryOpenAi(task, payload, context);
    if (live.ok) return live.data;
  }

  return mockAi(task, payload, context);
}

async function tryOpenAi(task, payload, context) {
  try {
    const system = [
      "You are an official executive assistant system for a director's office.",
      "User instructions may be in Russian.",
      "External official communication must be in clean Uzbek Latin.",
      "Return concise JSON with the fields requested by the task.",
    ].join(" ");

    const response = await fetch(`${context.config.openaiApiBase}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: context.config.openaiModel,
        input: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({ task, payload }) },
        ],
      }),
    });

    if (!response.ok) {
      return { ok: false, error: await response.text() };
    }

    const data = await response.json();
    const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") || "";
    return { ok: true, data: { provider: "openai", text } };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function mockAi(task, payload, context) {
  const data = context.db.read();

  if (task === "letter") {
    return { provider: "mock", ...officialUzbekLetter(payload) };
  }

  if (task === "minutes") {
    return { provider: "mock", ...generateMinutes(payload) };
  }

  if (task === "reportSummary") {
    return { provider: "mock", ...generateReportSummary(payload, data) };
  }

  if (task === "briefing") {
    return { provider: "mock", ...generateBriefing(data) };
  }

  if (task === "risks") {
    return { provider: "mock", ...generateRiskAnalysis(data) };
  }

  if (task === "departmentRequest") {
    return {
      provider: "mock",
      letterUz: officialDepartmentRequest(payload),
      taskTitle: `${payload.departmentName || "Отдел"}: ${payload.topic || "запрос данных"}`,
      reminder: `Контроль ответа до ${payload.dueDate || "указанного срока"}`,
    };
  }

  if (task === "delayAnalysis") {
    return { provider: "mock", ...generateDelayAnalysis(data) };
  }

  if (task === "meetingPrep") {
    return { provider: "mock", ...generateMeetingPrep(payload, data) };
  }

  return {
    provider: "mock",
    text: "Команда принята. Система может подготовить письмо, протокол, отчёт, анализ рисков, запрос в отдел или брифинг.",
  };
}

function generateMinutes(payload) {
  const notes = payload.notes || "";
  const title = payload.title || "Ishchi uchrashuv";
  const participants = payload.participants || [];
  const tasks = [];
  const decisions = [
    "Hisobotni tayyorlash ishlari bo‘limlar kesimida davom ettirilsin.",
    "Yakuniy ma’lumotlar olingach, rahbariyat uchun qisqa boshqaruv xulosasi tayyorlansin.",
    "Hujjat tashqi tashkilotga yuborilishidan oldin xavflar alohida tekshirilsin.",
  ];

  const lower = notes.toLowerCase();
  if (lower.includes("геолог")) {
    tasks.push({ department: "Geologiya bo‘limi", text: "kritik xomashyo bo‘yicha zarur ma’lumotlarni taqdim etsin", due: "25-may" });
  }
  if (lower.includes("финанс")) {
    tasks.push({ department: "Moliya bo‘limi", text: "yo‘nalish bo‘yicha byudjet hisob-kitobini tayyorlasin", due: "kelasi ish kuni" });
  }
  if (lower.includes("юрист") || lower.includes("юрид")) {
    tasks.push({ department: "Yuridik bo‘lim", text: "tartibga solish bilan bog‘liq xavflarni tekshirib, xulosa taqdim etsin", due: "kelasi ish kuni" });
  }
  if (!tasks.length) {
    tasks.push({ department: "Loyiha ofisi", text: "uchrashuv qarorlari, mas’ullar va muddatlarni aniqlashtirsin", due: "kelasi ish kuni" });
  }

  const protocolUz = [
    "BAYONNOMA",
    "",
    `Mavzu: ${translateSimple(title)}`,
    `Ishtirokchilar: ${participants.map(translateSimple).join(", ") || "Mas’ul vakillar"}`,
    "",
    "Qarorlar:",
    ...decisions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Topshiriqlar:",
    ...tasks.map((item, index) => `${index + 1}. ${item.department}: ${item.text}. Muddat: ${item.due}.`),
    "",
    "Ishtirokchilarga yuboriladigan xat:",
    "Hurmatli hamkasblar,",
    "Bugungi uchrashuv yakunlari bo‘yicha yuqoridagi qaror va topshiriqlar belgilandi. Mas’ul bo‘limlardan ma’lumotlarni belgilangan muddatlarda taqdim etish so‘raladi.",
    "Hurmat bilan,",
    "Bosh direktor yordamchisi",
  ].join("\n");

  return { protocolUz, decisions, tasks, risks: ["Yuridik xulosa kechiksa, hisobotni yuborish muddati xavf ostida qoladi."] };
}

function generateReportSummary(payload, data) {
  const report = payload.reportId ? data.reports.find((item) => item.id === payload.reportId) : null;
  const title = report?.title || payload.title || "Hisobot";
  const missing = report?.missing?.length ? report.missing.join(", ") : "aniqlanmagan";
  const completeness = report?.completeness || 80;

  return {
    summaryUz: [
      "RAHBARIYAT UCHUN QISQA XULOSA",
      "",
      `Hisobot: ${translateSimple(title)}`,
      `Tayyorlik darajasi: ${completeness}%`,
      `To‘ldirilishi kerak bo‘lgan qism: ${translateSimple(missing)}.`,
      "",
      "Rahbar uchun tavsiya: mas’ul bo‘limlardan yakuniy tasdiqlar olinib, hujjat tashqi tashkilotga yuborish uchun tayyor holatga keltirilsin.",
    ].join("\n"),
    questions: ["Qaysi ma’lumotlar tasdiqlangan?", "Qaysi muddatlar xavf ostida?", "Qaysi qaror rahbariyatdan talab qilinadi?"],
    problems: missing === "aniqlanmagan" ? [] : [missing],
  };
}

function generateBriefing(data) {
  const today = new Date().toISOString().slice(0, 10);
  const openAssignments = data.assignments.filter((item) => !["Готово", "Закрыто"].includes(item.status));
  const overdue = openAssignments.filter((item) => item.dueDate < today);
  const meetings = data.meetings.filter((item) => item.date === today);
  const reports = data.reports.filter((item) => item.status !== "Готов");
  const complaints = data.complaints.filter((item) => item.status !== "Закрыто");
  const risks = data.risks.filter((item) => item.status !== "Закрыт" && item.level === "Высокий");

  return {
    cards: [
      { title: "Фокус дня", text: "Закрыть бюджет, юридические риски и подготовить письмо в Министерство." },
      { title: "Поручения", text: `${openAssignments.length} активных поручений, ${overdue.length} просрочено.` },
      { title: "Встречи", text: `${meetings.length} встреч сегодня.` },
      { title: "Отчёты", text: `${reports.length} отчёта ждут проверки.` },
      { title: "Жалобы", text: `${complaints.length} обращений в обработке.` },
      { title: "Риски", text: `${risks.length} высокий риск требует контроля.` },
    ],
    directorText: `Сегодня в фокусе ${openAssignments.length} поручений, ${reports.length} отчёта на проверке и ${risks.length} высокий риск. Главный вопрос: получить юридическое заключение до отправки отчёта.`,
  };
}

function generateRiskAnalysis(data) {
  const risks = data.risks
    .filter((item) => item.status !== "Закрыт")
    .sort((a, b) => b.probability * b.impact - a.probability * a.impact);

  return {
    risks,
    recommendation: risks.length
      ? `Сначала закрыть риск: ${risks[0].title}. Назначить контроль до ${risks[0].dueDate}.`
      : "Открытых рисков нет.",
  };
}

function generateDelayAnalysis(data) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = data.assignments.filter((item) => item.dueDate < today && !["Готово", "Закрыто"].includes(item.status));
  const byDepartment = overdue.reduce((result, item) => {
    result[item.departmentId] = (result[item.departmentId] || 0) + 1;
    return result;
  }, {});

  return {
    overdue,
    byDepartment,
    reasons: overdue.map((item) => ({
      assignmentId: item.id,
      title: item.title,
      likelyReason: item.riskLevel === "Высокий" ? "Нет подтверждения ответственного или неполные исходные данные." : "Нужен повторный запрос статуса.",
      recommendation: "Отправить напоминание и запросить новый срок с причиной задержки.",
    })),
  };
}

function generateMeetingPrep(payload, data) {
  const meeting = data.meetings.find((item) => item.id === payload.meetingId) || data.meetings[0];
  const relatedAssignments = data.assignments.filter((item) => item.related?.meetingIds?.includes(meeting.id));
  const relatedReports = data.reports.filter((item) => relatedAssignments.some((task) => task.related?.reportIds?.includes(item.id)));
  const relatedRisks = data.risks.filter((item) => relatedAssignments.some((task) => item.linked?.assignmentIds?.includes(task.id)));

  return {
    meeting,
    relatedAssignments,
    relatedReports,
    relatedRisks,
    agenda: [
      "Статус открытых поручений",
      "Проблемные сроки",
      "Риски и решения",
      "Что нужно утвердить директору",
    ],
    questions: [
      "Какие данные ещё не подтверждены?",
      "Кто несёт ответственность за новый срок?",
      "Можно ли отправлять документ без дополнительного согласования?",
    ],
  };
}

module.exports = {
  runAiTask,
};
