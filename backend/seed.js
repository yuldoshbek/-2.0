function todayISO(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const modules = [
  ["dashboard", "Главная панель управления", "Ежедневная картина дня: задачи, встречи, отчёты, письма, жалобы, риски и брифинг директору."],
  ["assignments", "Модуль поручений", "Поручения директора, встреч, писем, отчётов и звонков с ответственными, сроками и статусами."],
  ["employeeTasks", "Модуль задач сотрудников", "Личные и командные задачи сотрудников, статусы, файлы, комментарии и автоматический сбор статуса."],
  ["meetings", "Модуль встреч", "Создание встреч, повестка, участники, документы, заметки, протоколы, решения и задачи."],
  ["meetingMinutes", "Генератор протоколов встреч", "Из заметок или транскрипта выделяет темы, решения, задачи, риски и готовит протокол на узбекском латинском."],
  ["reports", "Модуль отчётов", "Сбор, импорт, проверка, AI-анализ, выжимка и экспорт отчётов."],
  ["reportBuilder", "Генератор отчётов", "Конструктор отчётов из блоков, таблиц, рисков, задач, выводов и приложений."],
  ["employeeReportForms", "Модуль отчётов от сотрудников", "Формы для ежедневных, еженедельных и порученческих отчётов сотрудников."],
  ["letters", "Модуль писем", "Официальные письма на узбекском латинском из русской инструкции."],
  ["complaints", "Модуль жалоб и обратной связи", "Регистрация, обработка, аналитика и отчёты по жалобам и обращениям."],
  ["documents", "Модуль документов", "Документы, версии, статусы, теги и связи с задачами, встречами, письмами и отчётами."],
  ["googleWorkspace", "Google Workspace интеграции", "Gmail, Calendar, Docs, Sheets и Drive через единый слой интеграции."],
  ["aiAssistant", "AI-ассистент", "Письма, протоколы, отчёты, риски, переводы, вопросы отделам, брифинги и поиск по базе знаний."],
  ["departmentControl", "Модуль контроля отделов", "Показатели отделов, просрочки, отчёты, жалобы, риски и рейтинг исполнительности."],
  ["decisions", "Модуль решений", "Реестр решений: кто решил, когда, источник, задачи, дедлайны и статус исполнения."],
  ["risks", "Модуль рисков", "Риски, вероятность, влияние, ответственные, план действий, связь с задачами и отчётами."],
  ["reminders", "Модуль напоминаний", "Системные, email и будущие Telegram-напоминания по срокам, встречам, отчётам и письмам."],
  ["knowledgeBase", "База знаний", "Регламенты, шаблоны, формулировки, старые письма, протоколы, отчёты и AI-поиск."],
  ["audit", "Модуль аудита", "История действий пользователей, AI-генераций, изменений документов и статусов."],
  ["approvals", "Модуль согласований", "Проверка и утверждение документов, писем и отчётов до отправки."],
  ["dailyBriefing", "Центр ежедневного брифинга", "Утренняя готовая картина дня и текст для доклада директору."],
  ["responsibilityMap", "Карта ответственности", "Кто за что отвечает, активные задачи, нагрузка, просрочки и связи с проектами."],
  ["departmentRequests", "Генератор запросов в отделы", "Создаёт задачу, письмо, форму ответа, напоминание и контроль дедлайна для отдела."],
  ["delayAnalysis", "Анализ задержек", "Причины просрочек, повторяемость, влияние на процесс, рекомендации и отчёт директору."],
  ["meetingPrep", "Центр подготовки к совещанию", "Собирает документы, прошлые решения, задачи, риски, жалобы, отчёты и вопросы к участникам."],
].map(([id, title, description], index) => ({
  id,
  number: index + 1,
  title,
  description,
  status: "active",
}));

function createSeedData() {
  return {
    meta: {
      product: "Executive Control Center",
      internalName: "TMK Executive OS",
      formula: "Поручение → задача → ответственный → срок → контроль → отчёт → решение",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      languagePolicy: "Russian input, official Uzbek Latin output for external communication.",
    },
    modules,
    users: [
      { id: "U-001", name: "Ассистент генерального директора", role: "executive_assistant", departmentId: "D-000" },
      { id: "U-002", name: "Генеральный директор", role: "director", departmentId: "D-000" },
    ],
    departments: [
      { id: "D-000", name: "Руководство", head: "Генеральный директор", responseRate: 100, workload: 3 },
      { id: "D-001", name: "Геология", head: "Руководитель геологического отдела", responseRate: 86, workload: 7 },
      { id: "D-002", name: "Финансы", head: "Руководитель финансового отдела", responseRate: 78, workload: 9 },
      { id: "D-003", name: "Юридический", head: "Руководитель юридического отдела", responseRate: 64, workload: 8 },
      { id: "D-004", name: "Канцелярия", head: "Руководитель канцелярии", responseRate: 91, workload: 5 },
      { id: "D-005", name: "Проектный офис", head: "Руководитель проектного офиса", responseRate: 82, workload: 6 },
      { id: "D-006", name: "HR", head: "Руководитель HR", responseRate: 74, workload: 4 },
    ],
    employees: [
      { id: "E-001", name: "Ответственный по геологии", departmentId: "D-001", role: "Специалист", responseScore: 86 },
      { id: "E-002", name: "Ответственный по бюджету", departmentId: "D-002", role: "Финансовый аналитик", responseScore: 79 },
      { id: "E-003", name: "Ответственный юрист", departmentId: "D-003", role: "Юрист", responseScore: 61 },
      { id: "E-004", name: "Канцелярия", departmentId: "D-004", role: "Документооборот", responseScore: 92 },
      { id: "E-005", name: "Координатор проекта", departmentId: "D-005", role: "Проектный менеджер", responseScore: 84 },
    ],
    assignments: [
      {
        id: "A-001",
        title: "Подготовить данные по критическому сырью",
        description: "Передать актуальные геологические данные для итогового отчёта.",
        source: "Встреча",
        ownerId: "E-001",
        departmentId: "D-001",
        dueDate: todayISO(2),
        priority: "Высокий",
        riskLevel: "Средний",
        status: "В работе",
        comments: ["Нужна сверка с последней таблицей запасов."],
        related: { meetingIds: ["M-001"], reportIds: ["R-001"], documentIds: ["DOC-001"] },
        history: [{ at: new Date().toISOString(), action: "created", by: "U-001" }],
      },
      {
        id: "A-002",
        title: "Рассчитать бюджет по направлению",
        description: "Подготовить бюджетную оценку и указать допущения.",
        source: "Поручение директора",
        ownerId: "E-002",
        departmentId: "D-002",
        dueDate: todayISO(0),
        priority: "Высокий",
        riskLevel: "Средний",
        status: "На проверке",
        comments: ["Ожидается версия для руководительской выжимки."],
        related: { meetingIds: ["M-001"], reportIds: ["R-002"], documentIds: ["DOC-002"] },
        history: [{ at: new Date().toISOString(), action: "created", by: "U-001" }],
      },
      {
        id: "A-003",
        title: "Проверить регуляторные риски",
        description: "Выявить ограничения, разрешения и согласования.",
        source: "Протокол встречи",
        ownerId: "E-003",
        departmentId: "D-003",
        dueDate: todayISO(-1),
        priority: "Высокий",
        riskLevel: "Высокий",
        status: "В работе",
        comments: ["Нет подтверждения от ответственного."],
        related: { meetingIds: ["M-001"], reportIds: ["R-001"], riskIds: ["K-001"] },
        history: [{ at: new Date().toISOString(), action: "created", by: "U-001" }],
      },
    ],
    employeeTasks: [
      { id: "ET-001", title: "Обновить таблицу запасов", employeeId: "E-001", departmentId: "D-001", status: "В работе", priority: "Высокий", dueDate: todayISO(1), files: [] },
      { id: "ET-002", title: "Подготовить финансовые допущения", employeeId: "E-002", departmentId: "D-002", status: "Ждёт ответа", priority: "Средний", dueDate: todayISO(0), files: [] },
      { id: "ET-003", title: "Дать заключение по лицензиям", employeeId: "E-003", departmentId: "D-003", status: "Просрочена", priority: "Высокий", dueDate: todayISO(-1), files: [] },
    ],
    meetings: [
      {
        id: "M-001",
        title: "Подготовка отчёта по критическому сырью",
        date: todayISO(0),
        time: "10:30",
        participants: ["D-001", "D-002", "D-003"],
        agenda: ["Данные геологии", "Бюджет", "Регуляторные риски"],
        notes: "Сегодня была встреча с геологическим отделом, финансовым отделом и юридическим отделом. Обсудили подготовку отчёта по критическому сырью. Геология должна дать данные до 25 мая. Финансы должны рассчитать бюджет. Юристы должны проверить регуляторные риски.",
        documentIds: ["DOC-001", "DOC-002"],
        status: "Протокол готов",
      },
    ],
    meetingMinutes: [],
    reports: [
      { id: "R-001", title: "Отчёт по критическому сырью", type: "Отчёт для директора", ownerDepartmentId: "D-005", status: "На проверке", completeness: 82, missing: ["юридические риски"], summary: "" },
      { id: "R-002", title: "Бюджет направления", type: "Финансовый отчёт", ownerDepartmentId: "D-002", status: "На проверке", completeness: 76, missing: ["обоснование допущений"], summary: "" },
      { id: "R-003", title: "Еженедельный статус поручений", type: "Отчёт по поручениям", ownerDepartmentId: "D-000", status: "Готов", completeness: 94, missing: [], summary: "" },
    ],
    reportTemplates: [
      { id: "RT-001", title: "Ежедневный отчёт", blocks: ["Что сделано", "Риски", "Просрочки", "План на завтра"] },
      { id: "RT-002", title: "Отчёт для директора", blocks: ["Executive summary", "Ключевые решения", "Риски", "Нужны действия"] },
      { id: "RT-003", title: "Официальный отчёт для внешней организации", blocks: ["Введение", "Основная часть", "Данные", "Заключение"] },
    ],
    employeeReportForms: [
      {
        id: "ERF-001",
        title: "Ежедневный отчёт сотрудника",
        departmentId: "D-005",
        deadline: todayISO(0),
        questions: ["Что сделано сегодня?", "Какие задачи в работе?", "Какие есть проблемы?", "Что нужно от руководства?", "План на завтра"],
        status: "Активна",
        responses: [],
      },
    ],
    letters: [
      {
        id: "L-001",
        recipient: "Министерство горнодобывающей промышленности и геологии",
        subject: "Kritik xomashyo yo‘nalishi bo‘yicha hisobotni kelishish yuzasidan",
        instruction: "Подготовь письмо в Министерство, что нам нужно согласовать отчёт по направлению критического сырья.",
        bodyUz: "Hurmatli Tog‘-kon sanoati va geologiya vazirligi vakillari!\n\nSizga shuni ma’lum qilamizki, tashkilotimiz tomonidan kritik xomashyo yo‘nalishi bo‘yicha hisobotni tayyorlash va kelishish masalasi bo‘yicha ishlar olib borilmoqda.\n\nIltimos, uchrashuv uchun Sizga qulay bo‘lgan sana va vaqt haqida ma’lumot berishingizni so‘raymiz.\n\nHurmat bilan,\nBosh direktor yordamchisi",
        status: "Черновик",
        createdAt: new Date().toISOString(),
      },
    ],
    complaints: [
      { id: "C-001", source: "Внутреннее обращение", submitter: "Сотрудник", title: "Задержка ответа по документу", category: "Задержка ответа", departmentId: "D-003", urgency: "Высокая", status: "В работе", dueDate: todayISO(1), description: "Нет ответа по юридическому заключению.", comments: [] },
    ],
    documents: [
      { id: "DOC-001", title: "Черновик отчёта по критическому сырью", type: "Google Docs", status: "На проверке", tags: ["критическое сырьё", "отчёт"], linked: { reportIds: ["R-001"], meetingIds: ["M-001"] }, versions: [{ version: 1, at: new Date().toISOString(), note: "Исходный черновик" }] },
      { id: "DOC-002", title: "Таблица бюджета", type: "Google Sheets", status: "Черновик", tags: ["бюджет"], linked: { reportIds: ["R-002"], meetingIds: ["M-001"] }, versions: [{ version: 1, at: new Date().toISOString(), note: "Первичная таблица" }] },
    ],
    decisions: [
      { id: "DEC-001", date: todayISO(0), source: "Встреча M-001", decidedBy: "Генеральный директор", description: "Продолжить подготовку отчёта по критическому сырью с отдельной проверкой юридических рисков.", assignmentIds: ["A-001", "A-002", "A-003"], status: "В исполнении", dueDate: todayISO(2) },
    ],
    risks: [
      { id: "K-001", title: "Регуляторные ограничения не подтверждены", source: "Встреча", level: "Высокий", probability: 70, impact: 85, ownerId: "E-003", actionPlan: "Получить юридическое заключение до отправки отчёта.", status: "Открыт", dueDate: todayISO(1), linked: { assignmentIds: ["A-003"], reportIds: ["R-001"] } },
      { id: "K-002", title: "Бюджетные допущения неполные", source: "Отчёт", level: "Средний", probability: 55, impact: 60, ownerId: "E-002", actionPlan: "Добавить пояснения и сценарии.", status: "Открыт", dueDate: todayISO(0), linked: { assignmentIds: ["A-002"], reportIds: ["R-002"] } },
    ],
    reminders: [
      { id: "REM-001", title: "Напомнить юридическому отделу", targetType: "assignment", targetId: "A-003", channel: "system", dueAt: `${todayISO(0)}T16:00:00`, status: "Запланировано" },
      { id: "REM-002", title: "Собрать ежедневные отчёты", targetType: "employeeReportForm", targetId: "ERF-001", channel: "system", dueAt: `${todayISO(0)}T17:30:00`, status: "Запланировано" },
    ],
    knowledgeBase: [
      { id: "KB-001", title: "Официальное обращение в министерство", category: "Шаблоны писем", tags: ["uzbek latin", "official"], content: "Hurmatli ... Sizga shuni ma’lum qilamizki ..." },
      { id: "KB-002", title: "Структура протокола встречи", category: "Регламенты", tags: ["протокол", "встреча"], content: "Тема, участники, повестка, решения, задачи, сроки, ответственные." },
    ],
    approvals: [
      { id: "APR-001", targetType: "letter", targetId: "L-001", reviewer: "Генеральный директор", status: "Черновик", comments: [], history: [] },
      { id: "APR-002", targetType: "report", targetId: "R-001", reviewer: "Генеральный директор", status: "На проверке", comments: ["Проверить юридический блок."], history: [] },
    ],
    workspaceLinks: [
      { id: "W-001", module: "googleWorkspace", title: "Календарь встреч", provider: "Google Calendar", status: "mock", lastSyncAt: null },
      { id: "W-002", module: "googleWorkspace", title: "Черновики писем", provider: "Gmail", status: "mock", lastSyncAt: null },
      { id: "W-003", module: "googleWorkspace", title: "Документы и отчёты", provider: "Google Drive", status: "mock", lastSyncAt: null },
    ],
    audit: [
      { id: "AUD-001", at: new Date().toISOString(), actor: "U-001", action: "seed.created", entityType: "system", entityId: "ECC", detail: "Создана стартовая база проекта." },
    ],
  };
}

module.exports = {
  createSeedData,
  todayISO,
};
