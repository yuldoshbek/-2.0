function createGoogleWorkspaceService(config) {
  const mock = config.googleMode !== "live";

  return {
    async status() {
      return {
        mode: mock ? "mock" : "live",
        tools: [
          { id: "calendar", title: "Google Calendar", available: true, mode: mock ? "mock" : "oauth" },
          { id: "gmail", title: "Gmail", available: true, mode: mock ? "mock" : "oauth" },
          { id: "docs", title: "Google Docs", available: true, mode: mock ? "mock" : "oauth" },
          { id: "sheets", title: "Google Sheets", available: true, mode: mock ? "mock" : "oauth" },
          { id: "drive", title: "Google Drive", available: true, mode: mock ? "mock" : "oauth" },
        ],
      };
    },

    async createDraftEmail(payload) {
      return mockResult("gmail.draft.created", {
        to: payload.to || "",
        subject: payload.subject || "",
        body: payload.body || "",
        draftUrl: "mock://gmail/drafts/DRAFT-001",
      });
    },

    async createCalendarEvent(payload) {
      return mockResult("calendar.event.created", {
        title: payload.title,
        date: payload.date,
        participants: payload.participants || [],
        eventUrl: "mock://calendar/events/EVT-001",
      });
    },

    async createGoogleDoc(payload) {
      return mockResult("docs.document.created", {
        title: payload.title,
        content: payload.content,
        documentUrl: "mock://docs/DOC-001",
      });
    },

    async createGoogleSheet(payload) {
      return mockResult("sheets.spreadsheet.created", {
        title: payload.title,
        rows: payload.rows || [],
        spreadsheetUrl: "mock://sheets/SHEET-001",
      });
    },

    async searchDrive(payload) {
      return mockResult("drive.search.completed", {
        query: payload.query || "",
        files: [
          { title: "Черновик отчёта по критическому сырью", type: "Google Docs", url: "mock://drive/report" },
          { title: "Таблица бюджета", type: "Google Sheets", url: "mock://drive/budget" },
        ],
      });
    },
  };
}

function mockResult(action, data) {
  return {
    mode: "mock",
    action,
    ok: true,
    data,
    note: "Реальная отправка отключена. Подключите OAuth-ключи и GOOGLE_MODE=live.",
  };
}

module.exports = {
  createGoogleWorkspaceService,
};
