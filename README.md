# Executive Control Center / TMK Executive OS

Полноценный локальный full-stack проект для ассистента генерального директора.

Система собирает рабочий контур в одну цепочку:

```text
Поручение → задача → ответственный → срок → контроль → отчёт → решение
```

И вторую рабочую цепочку:

```text
Встреча → протокол → задачи → сотрудники → напоминания → выполнение → отчёт директору
```

## Что внутри

- `server.js` — единый Node.js сервер.
- `backend/` — API, JSON-хранилище, seed-данные, AI-сервис, Google Workspace-адаптер, экспорт.
- `public/` — frontend, который работает через backend API.
- `data/database.json` — локальная база создаётся автоматически при первом запуске.
- `.env.example` — настройки AI, Google Workspace и порта.

## Запуск

```powershell
npm start
```

Открыть:

```text
http://127.0.0.1:4173
```

Проверка синтаксиса:

```powershell
npm run check
```

## Основные API

```text
GET  /api/health
GET  /api/bootstrap
GET  /api/dashboard
GET  /api/modules

GET/POST/PATCH/DELETE /api/assignments
GET/POST/PATCH/DELETE /api/employee-tasks
GET/POST/PATCH/DELETE /api/meetings
GET/POST/PATCH/DELETE /api/reports
GET/POST/PATCH/DELETE /api/letters
GET/POST/PATCH/DELETE /api/complaints
GET/POST/PATCH/DELETE /api/documents
GET/POST/PATCH/DELETE /api/decisions
GET/POST/PATCH/DELETE /api/risks
GET/POST/PATCH/DELETE /api/reminders
GET/POST/PATCH/DELETE /api/approvals
GET/POST/PATCH/DELETE /api/audit
```

## AI и workflow endpoints

```text
POST /api/ai/letter
POST /api/ai/minutes
POST /api/ai/reportSummary
POST /api/ai/briefing
POST /api/ai/risks
POST /api/ai/departmentRequest
POST /api/ai/delayAnalysis
POST /api/ai/meetingPrep

POST /api/workflows/meeting-minutes
POST /api/workflows/department-request
POST /api/workflows/daily-briefing
POST /api/workflows/delay-analysis
POST /api/workflows/meeting-prep
```

По умолчанию AI работает в `mock`-режиме, чтобы проект запускался без внешних ключей. Для подключения OpenAI:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

## Google Workspace

Сейчас Google Workspace подключён через адаптер в `mock`-режиме:

```text
GET  /api/google/status
POST /api/google/draft-email
POST /api/google/calendar-event
POST /api/google/google-doc
POST /api/google/google-sheet
POST /api/google/drive-search
```

Для реального режима нужно добавить OAuth credentials в `.env` и заменить mock-вызовы в `backend/services/googleWorkspace.js` на реальные Google API вызовы.

## Все модули системы

1. Главная панель управления
2. Модуль поручений
3. Модуль задач сотрудников
4. Модуль встреч
5. Генератор протоколов встреч
6. Модуль отчётов
7. Генератор отчётов
8. Модуль отчётов от сотрудников
9. Модуль писем
10. Модуль жалоб и обратной связи
11. Модуль документов
12. Google Workspace интеграции
13. AI-ассистент
14. Модуль контроля отделов
15. Модуль решений
16. Модуль рисков
17. Модуль напоминаний
18. База знаний
19. Модуль аудита
20. Модуль согласований
21. Центр ежедневного брифинга
22. Карта ответственности
23. Генератор запросов в отделы
24. Анализ задержек
25. Центр подготовки к совещанию

## Экспорт

```text
POST /api/export/html
POST /api/export/json
POST /api/export/csv
```

CSV открывается в Excel. HTML можно печатать в PDF из браузера. Реальный DOCX/PDF-экспорт лучше подключить отдельным сервисом после выбора корпоративного формата документов.
