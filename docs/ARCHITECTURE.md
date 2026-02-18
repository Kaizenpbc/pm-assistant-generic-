# Application Architecture

## Overview

PM Assistant is an AI-powered project management platform built as a full-stack TypeScript monorepo. It combines traditional PM tooling (Gantt charts, critical path analysis, resource management) with an AI co-pilot that can take actions on behalf of the user via Claude tool use.

```
pm-assistant-generic/
  src/
    server/          Fastify 5 REST API + WebSocket server
    client/          React 18 SPA (Vite + Tailwind)
    shared/          TypeScript types shared by both sides
  docs/              Architecture & security documentation
  vitest.config.ts   Test configuration
  package.json       Root (server) dependencies
```

---

## System Diagram

```
                          Browser
                            |
                            | HTTPS + HTTP-only cookies
                            v
  +-----------------------------------------------------+
  |               React 18 SPA (Vite)                    |
  |                                                      |
  |  Pages:  PMDashboard, ExecutiveDashboard,            |
  |          ProjectDetail, MonteCarlo, Reports,         |
  |          Query, Workflow, Portfolio, Lessons,         |
  |          MeetingMinutes, ScenarioModeling             |
  |                                                      |
  |  State: Zustand (authStore, aiChatStore, uiStore)    |
  |  Data:  TanStack React Query (server-state cache)    |
  |  HTTP:  Axios with CSRF + auto-refresh interceptors  |
  |  WS:    useWebSocket hook (exponential backoff)      |
  +-----------------------------------------------------+
          |  REST /api/v1/*          |  WS /api/v1/ws
          v                          v
  +-----------------------------------------------------+
  |               Fastify 5 Server                       |
  |                                                      |
  |  Plugins: Helmet, CORS, Cookie, CSRF, Rate-limit,   |
  |           WebSocket, Swagger (dev only)               |
  |                                                      |
  |  Middleware:  requestLogger -> securityMiddleware ->  |
  |              CSRF enforcement -> authMiddleware ->    |
  |              securityValidation -> route handler      |
  |                                                      |
  |  Routes:  27 route modules (see API section)         |
  |  Services: 38 service classes (see Services section) |
  |  Validation: Zod schemas on every input              |
  +-----------------------------------------------------+
          |                          |
          v                          v
  +----------------+     +---------------------+
  |  MySQL 8       |     |  Claude API          |
  |  (mysql2 pool) |     |  (Anthropic SDK)     |
  |  21 tables     |     |  Tool-loop execution |
  +----------------+     +---------------------+
                                     |
                          +---------------------+
                          |  Weather APIs       |
                          |  (OpenWeatherMap,   |
                          |   WeatherAPI,       |
                          |   AccuWeather)      |
                          +---------------------+
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | ES2022 target |
| Server framework | Fastify | 5.6.0 |
| Frontend framework | React | 18.2.0 |
| Language | TypeScript | 5.2+ (strict mode) |
| Database | MySQL | 8.0+ (utf8mb4) |
| AI | Anthropic Claude | SDK 0.74+ |
| Build (server) | tsc (CommonJS) | |
| Build (client) | Vite | 7.3.1 |
| Styling | Tailwind CSS | 3.4+ |
| State management | Zustand | 4.4.7 |
| Server state | TanStack React Query | 5.8.4 |
| HTTP client | Axios | 1.13.5 |
| Validation | Zod | 4.1.12 |
| Auth | JWT (jsonwebtoken) + bcryptjs | |
| Testing | Vitest | 3.2.4 |
| Icons | Lucide React | |
| XSS protection | DOMPurify | 3.3.1 |

---

## Server Architecture

### Startup Sequence

```
index.ts
  1. Load env (dotenv)
  2. Validate config (Zod schema with security refinements)
  3. Test DB connection (warn-only if offline)
  4. registerPlugins(fastify)     -- security, CORS, cookies, CSRF, rate-limit
  5. registerRoutes(fastify)      -- 27 route modules under /api/v1/
  6. fastify.listen()
  7. Register SIGINT/SIGTERM handlers (10s drain timeout)
```

### Request Pipeline

Every request flows through this hook chain:

```
onRequest:   requestLogger -> securityMiddleware -> CSRF enforcement
preHandler:  securityValidationMiddleware -> authMiddleware
handler:     Zod parse(params/body) -> verifyProjectAccess() -> business logic
preSerialization: snake_case -> camelCase normalization
onSend:      Permissions-Policy header injection
errorHandler: audit log + sanitized response (generic 500s in production)
```

### Configuration

All settings validated at startup via Zod with security refinements:

| Category | Key Settings |
|----------|-------------|
| Server | `PORT`, `HOST`, `NODE_ENV`, `CORS_ORIGIN`, `LOG_LEVEL` |
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Auth | `JWT_SECRET` (32+ chars), `JWT_REFRESH_SECRET`, `COOKIE_SECRET` (all must differ) |
| AI | `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_TEMPERATURE`, `AI_MAX_TOKENS`, `AI_ENABLED` |
| AI Limits | `AI_DAILY_TOKEN_BUDGET`, `AI_PER_REQUEST_MAX_TOKENS`, `AI_MAX_REQUESTS_PER_USER_PER_HOUR` |
| Weather | `WEATHER_API_PROVIDER`, `WEATHER_API_KEY`, `WEATHER_CACHE_MINUTES` |

Production enforcements: DB_PASSWORD cannot be the default, JWT secrets must be unique, health endpoints stripped of operational data.

---

## API Routes

All routes prefixed with `/api/v1/`. Every route (except auth and health) requires JWT authentication.

### Core CRUD

| Prefix | Module | Description |
|--------|--------|-------------|
| `/auth` | `auth.ts` | Login, register, logout, refresh (per-route rate limits) |
| `/projects` | `projects.ts` | Project CRUD, user-scoped |
| `/projects/:projectId/members` | `projectMembers.ts` | Project-level RBAC (owner/manager/editor/viewer) |
| `/schedules` | `schedules.ts` | Schedules, tasks, comments, baselines, critical path |
| `/users` | `users.ts` | Current user profile (`GET /me`) |
| `/resources` | `resources.ts` | Resource pool, assignments, workload computation |
| `/templates` | `templates.ts` | Project template CRUD + apply |
| `/workflows` | `workflows.ts` | Workflow rule CRUD + execution |

### AI Features

| Prefix | Module | Description |
|--------|--------|-------------|
| `/ai-chat` | `aiChat.ts` | Conversational AI with tool-loop execution |
| `/ai-scheduling` | `aiScheduling.ts` | AI-powered schedule analysis and task breakdown |
| `/ai-reports` | `aiReports.ts` | AI-generated status reports |
| `/nl-query` | `nlQuery.ts` | Natural language project queries |
| `/meeting-intelligence` | `meetingIntelligence.ts` | Meeting transcript analysis + action item extraction |
| `/task-prioritization` | `taskPrioritization.ts` | AI-ranked task priorities |
| `/resource-optimizer` | `resourceOptimizer.ts` | AI-powered resource balancing |
| `/auto-reschedule` | `autoReschedule.ts` | Automatic reschedule proposals |

### Analytics

| Prefix | Module | Description |
|--------|--------|-------------|
| `/predictions` | `predictions.ts` | Predictive completion dates and risk scores |
| `/intelligence` | `intelligence.ts` | Cross-project trends, anomalies, insights |
| `/monte-carlo` | `monteCarlo.ts` | Monte Carlo risk simulation (10,000+ iterations) |
| `/evm-forecast` | `evmForecast.ts` | Earned Value Management forecasting |
| `/portfolio` | `portfolio.ts` | Portfolio-level dashboard data |
| `/learning` | `learning.ts` | AI feedback and accuracy tracking |
| `/lessons-learned` | `lessonsLearned.ts` | Lessons learned knowledge base |

### Infrastructure

| Prefix | Module | Description |
|--------|--------|-------------|
| `/alerts` | `alerts.ts` | Proactive alert management |
| `/audit` | `auditTrail.ts` | Audit log retrieval |
| `/exports` | `exports.ts` | PDF, XLSX, CSV document export |
| `/ws` | `websocket.ts` | WebSocket upgrade for real-time updates |
| `/health` | (plugins.ts) | Liveness, readiness, metrics (metrics disabled in prod) |
| `/csrf-token` | (plugins.ts) | CSRF token endpoint for SPA clients |

---

## Services Layer

### Core Data Services

| Service | Responsibility |
|---------|---------------|
| `ProjectService` | Project CRUD with user-scoped queries (`findById(id, userId)`) |
| `ScheduleService` | Schedule + task + comment + activity management |
| `ResourceService` | Resource pool, assignments, weekly workload computation |
| `UserService` | User accounts, authentication helpers |
| `ProjectMemberService` | Project-level role assignments |
| `TemplateService` | Project template storage and application |
| `WorkflowService` | Rule storage + trigger evaluation + execution logging |
| `BaselineService` | Schedule snapshot capture and comparison |

### AI Services

| Service | Responsibility |
|---------|---------------|
| `claudeService` | Core LLM wrapper: completion, tool-loop, prompt templates, token tracking |
| `aiChatService` | Conversation lifecycle, context injection, streaming support |
| `aiToolDefinitions` | Anthropic tool schemas (20+ operations: create/update/delete tasks, projects, etc.) |
| `aiActionExecutor` | Executes tool calls from Claude against real services (11 methods, all ownership-checked) |
| `aiContextBuilder` | Assembles project/schedule/user context for AI prompts |
| `aiProjectCreator` | Creates full projects from natural language descriptions |
| `aiTaskBreakdown` | Deterministic task decomposition |
| `aiTaskBreakdownClaude` | Claude-powered task decomposition |
| `aiSchedulingClaude` | AI-driven schedule optimization and analysis |
| `aiReportService` | Generates status reports, risk assessments, budget forecasts |
| `aiLearningService` | Tracks feedback and accuracy; generates insights |
| `aiUsageLogger` | Logs every AI call (tokens, latency, cost) for billing and rate limiting |

### Analytics Services

| Service | Responsibility |
|---------|---------------|
| `CriticalPathService` | CPM analysis: early/late start/finish, total/free float |
| `MonteCarloService` | PERT-distributed simulation, confidence intervals, sensitivity analysis |
| `EVMForecastService` | PV, EV, AC, CPI, SPI, ETC, EAC calculations |
| `SCurveService` | S-curve progress analysis |
| `predictiveIntelligence` | ML-based completion predictions and risk scoring |
| `anomalyDetectionService` | Detects schedule anomalies across projects |
| `crossProjectIntelligenceService` | Portfolio trends and pattern detection |
| `whatIfScenarioService` | What-if scenario modeling |

### Specialized Services

| Service | Responsibility |
|---------|---------------|
| `AutoRescheduleService` | Proposes date changes when tasks slip |
| `ResourceOptimizerService` | Balances workload across resources |
| `TaskPrioritizationService` | Ranks tasks by impact and urgency |
| `MeetingIntelligenceService` | Analyzes transcripts, extracts action items (resource-scoped) |
| `LessonsLearnedService` | Lessons database with pattern detection (user-scoped) |
| `NLQueryService` | Interprets natural language queries, returns structured results |
| `proactiveAlertService` | Generates warnings for overdue tasks, budget thresholds, etc. |

### Infrastructure Services

| Service | Responsibility |
|---------|---------------|
| `WebSocketService` | Connection management (1000 global / 10 per-user cap), user-scoped broadcast |
| `auditService` | Event logging with 10,000-entry memory cap |
| `dataProviders/` | Weather API abstraction (OpenWeatherMap, WeatherAPI, AccuWeather, mock) |

---

## AI Tool-Loop Architecture

The AI co-pilot can take real actions on the user's project data:

```
1. User sends message  ->  POST /api/v1/ai-chat/send
2. AIChatService builds context:
   - Project metadata (name, status, budget, dates)
   - Schedule and task state
   - Resource assignments
   - Recent activity
3. claudeService.completeToolLoop():
   a. Send context + tools to Claude API
   b. Claude responds with tool_use blocks
   c. AIActionExecutor runs each tool:
      - create_task, update_task, delete_task
      - create_project, update_project
      - reschedule_task, bulk_update_tasks
      - generate_report, analyze_schedule
      - ... (20+ tools total)
   d. Every tool call goes through verifyProjectAccess()
   e. Results fed back to Claude
   f. Claude generates final natural-language response
4. Response + action results returned to frontend
5. AI usage logged (tokens, latency, cost estimate)
6. WebSocket broadcast notifies other clients of changes
```

Token budgets enforced per-user: daily budget (default 500K tokens), per-request cap (default 4096), hourly request limit (default 60).

---

## Database Schema

MySQL 8.0+ with InnoDB and utf8mb4 collation. 21 tables organized by domain:

### Core Tables

```
users                    User accounts (UUID PK, role enum, is_active)
projects                 Projects (created_by FK -> users, project_type enum)
project_members          Project RBAC (project_id + user_id, role enum)
schedules                Schedules (project_id FK, status enum)
tasks                    Work items (schedule_id FK, dependency chain, progress %)
task_comments            Threaded discussion per task
task_activities          Audit trail per task (field-level change tracking)
```

### Resource Tables

```
resources                Resource pool (capacity hours, skills JSON)
resource_assignments     Task <-> resource allocation (hours/week, date range)
```

### Advanced Feature Tables

```
baselines                Schedule snapshots (tasks JSON blob)
reschedule_proposals     AI-proposed date changes (status: pending/accepted/rejected)
workflow_rules           Automation triggers + actions (JSON)
workflow_executions      Execution log with status
templates                Reusable project templates (phases JSON)
lessons_learned          Knowledge base (category, impact, tags)
meeting_analyses         Transcript analysis results (JSON)
```

### AI Tables

```
ai_conversations         Chat history (messages JSON, token count)
ai_usage_log             API call tracking (tokens, latency, cost)
ai_feedback              User feedback on AI suggestions (accepted/modified/rejected)
ai_accuracy_tracking     Prediction vs. actual variance tracking
```

### System

```
_migrations              Migration version tracking
```

Key design decisions:
- UUIDs (VARCHAR(36)) for all primary keys
- Foreign keys with CASCADE deletes where appropriate
- JSON columns for flexible structured data (phases, skills, messages)
- Indexed columns for all frequent query patterns
- Soft-delete via status enums rather than hard deletion

---

## Client Architecture

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| `LoginPage` | `/login` | Authentication (login + register) |
| `DashboardRouter` | `/` | Dispatches to PM or Executive dashboard by role |
| `PMDashboard` | `/dashboard/pm` | Project list, task summary, alerts |
| `ExecutiveDashboard` | `/dashboard/exec` | Portfolio KPIs, budget tracking, trends |
| `ProjectDetailPage` | `/projects/:id` | Full project context with schedule views |
| `MonteCarloPage` | `/monte-carlo` | Risk simulation with histogram and tornado diagram |
| `ScenarioModelingPage` | `/scenarios` | What-if analysis with scenario comparison |
| `QueryPage` | `/query` | Natural language project queries |
| `ReportsPage` | `/reports` | AI-generated reports |
| `WorkflowPage` | `/workflows` | Automation rule management |
| `PortfolioPage` | `/portfolio` | Cross-project analytics |
| `MeetingMinutesPage` | `/meetings` | Transcript upload and AI analysis |
| `LessonsLearnedPage` | `/lessons` | Knowledge base management |

### Component Library

```
components/
  layout/         AppLayout, Sidebar, TopBar
  ai/             AIChatPanel (expandable action results + context attribution),
                  AIChatContext, QuickActions, TaskPrioritizationPanel (factor breakdown)
  schedule/       GanttChart, CalendarView, KanbanBoard, TableView, TaskFormModal,
                  TaskActivityPanel, AutoReschedulePanel (progress bars + CP flags), DelayIndicator
  dashboard/      AISummaryBanner, PredictionCards (expandable score breakdown + trends)
  evm/            EVMForecastDashboard, EVMTrendChart, ForecastComparisonChart, SCurveChart
  resources/      CapacityChart, WorkloadHeatmap, ResourceForecastPanel, RebalanceSuggestions
  montecarlo/     MonteCarloHistogram, TornadoDiagram, CriticalityIndex
  query/          QueryInput, BarChart, LineChart, PieChart, DynamicChart
  lessons/        PatternCard, MitigationSuggestions
  meeting/        MeetingResultPanel
  templates/      TemplatePicker, TemplatePreview, TemplateCustomizeForm,
                  TemplateCard, SaveAsTemplateModal
  notifications/  NotificationBell (metrics + suggested action buttons), AlertActionButton
```

### State Management

Three Zustand stores:

| Store | Purpose | Persistence |
|-------|---------|------------|
| `authStore` | User session, isAuthenticated, login/logout | localStorage |
| `aiChatStore` | Chat messages, streaming state, conversation ID, action results with context | In-memory |
| `uiStore` | Sidebar toggle, modal states, notifications with suggested actions | In-memory |

TanStack React Query handles all server-state caching with automatic invalidation via WebSocket events.

### API Client (`services/api.ts`)

Axios instance with:
- CSRF token fetch on init (with retry + backoff)
- Request interceptor: attaches CSRF token to mutations, awaits `csrfReady` promise
- Response interceptor: auto-refreshes on 401, queues concurrent requests during refresh
- All API methods typed and exposed as `apiService.*`

---

## Real-Time Updates (WebSocket)

```
Client                          Server
  |                               |
  |-- WS upgrade (/api/v1/ws) -->|
  |   (JWT cookie auth)          |
  |                               |-- Validate JWT
  |                               |-- Add to clients Map
  |<-- { type: "connected" } ----|
  |                               |
  |   ... task updated ...        |
  |                               |-- broadcastToUser(userId, {
  |<-- { type: "task_updated",   |      type, payload
  |      payload: {...} } -------|    })
  |                               |
  |-- React Query invalidate     |
  |-- UI re-renders              |
```

Connection limits: 1,000 global, 10 per user. Client uses exponential backoff (1s to 30s, max 10 retries).

---

## Build & Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Concurrent server (nodemon) + client (Vite HMR) |
| `npm run build` | Full production build (tsc + vite build) |
| `npm start` | Start production server |
| `npm test` | Run Vitest test suite |
| `npm run type-check` | TypeScript checking (no emit) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Populate demo data |
| `npm run lint` | ESLint |

### Dev Server

- Backend: `localhost:3001` (nodemon + tsx)
- Frontend: `localhost:5174` (Vite HMR)
- Vite proxies `/api/*` to backend

### Testing

Vitest test suite covering:
- `authMiddleware.test.ts` — JWT validation, algorithm pinning, error handling
- `routeAuth.test.ts` — Route-level auth enforcement on all endpoints
- `securityMiddleware.test.ts` — Security headers, request validation
- `rateLimiting.test.ts` — Rate limit enforcement per route

---

## Shared Types

`src/shared/types.ts` is the single source of truth for domain models. Both server and client import from this file. Key conventions:

- String-literal unions for enums (serialize as JSON naturally)
- ISO-8601 strings for dates
- No runtime dependencies (importable by both sides)
- DTOs separate from entities (`CreateProjectInput` vs `Project`)

Type categories: enums, core entities, DTOs, response wrappers, analytics types, AI types.

---

## Error Handling

| Layer | Strategy |
|-------|----------|
| Validation | Zod parse errors -> 400 with field-level messages |
| Auth | Missing/invalid token -> 401; access denied -> 403 |
| Not found | Missing resource -> 404 |
| Rate limit | Exceeded -> 429 with retry-after |
| Server | Caught -> 500 with audit log; production: generic message only |
| Uncaught | `uncaughtException` / `unhandledRejection` -> log + process.exit(1) |

Error response format:
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "...",
  "timestamp": "2026-02-17T...",
  "path": "/api/v1/..."
}
```

Query parameters stripped from error paths to prevent sensitive data leakage.

---

## AI Transparency Layer

A core UX principle: every AI-generated insight exposes its full reasoning, not just a summary. This pattern is implemented across all AI-facing components:

### Component Transparency Features

| Component | What It Shows | Expandable Detail |
|-----------|--------------|-------------------|
| `AIChatPanel` | Action success/failure badges | Tool name, parameters, full result data, error details |
| `PredictionCards` | Overall health score (0–100) | Per-dimension breakdown (schedule, budget, risk, weather), trend arrow, recommendation |
| `NotificationBell` | Alert title + severity badge | Embedded metrics, task context, one-click suggested action buttons |
| `TaskPrioritizationPanel` | Rank + score bar | Priority factors with impact level, AI explanation |
| `AutoReschedulePanel` | Delay list + proposals | Actual vs expected progress bars, critical path badges, impact explanation |

### Data Flow

```
Backend Service                       Frontend Component
─────────────────────────────────────────────────────────
predictiveIntelligence                PredictionCards
  → breakdown: { schedule, budget,     → ScoreBar per dimension
     risk, weather }                   → TrendIcon (improving/stable/declining)
  → trend, recommendation             → DashboardSummaryBanner

aiChatService                         AIChatPanel
  → ActionResult[] {                   → ActionResultCard (expandable)
     toolName, success, summary,       → Context attribution footer
     data, error }
  → context { type, projectId }

proactiveAlertService                 NotificationBell
  → suggestedAction {                  → AlertActionButton (executes tool)
     toolName, params, label }         → Severity badge + task context
  → description (metrics embedded)

TaskPrioritizationService             TaskPrioritizationPanel
  → factors[] { factor, impact,        → Impact-colored dot per factor
     description }                     → Score bar with color thresholds
  → explanation                        → AI explanation panel

AutoRescheduleService                 AutoReschedulePanel
  → delay { currentProgress,           → Dual-layer progress bar
     expectedProgress, isCriticalPath }→ Critical path badge
  → estimatedImpact {                  → Impact explanation panel
     criticalPathImpact }
```

### Design Principles

1. **Summary first** — every card shows a one-line summary visible without interaction
2. **Click to expand** — detailed reasoning available on demand, never forced
3. **Color semantics** — red/orange/yellow/green consistently map to critical/high/medium/low across all components
4. **Actionable insights** — where the AI suggests an action, a button executes it in one click
5. **Context attribution** — AI responses indicate what data scope informed the answer

---

## Security

See [SECURITY-ARCHITECTURE.md](./SECURITY-ARCHITECTURE.md) for the full security architecture including:
- Authentication flow (JWT + cookie + timing-safe login)
- Authorization (ownership model + project RBAC)
- CSRF protection (signed double-cookie pattern)
- Input validation (Zod schemas with `.max()` bounds on every field)
- Rate limiting (global + per-route)
- Memory safety (10,000-entry caps on all in-memory arrays)
- Security headers (CSP, HSTS, Permissions-Policy, etc.)
- Production vs development hardening
- WebSocket security

---

## Deployment

### Prerequisites

- Node.js (ES2022+ compatible)
- MySQL 8.0+
- Environment variables (see `env.example`)

### Production Checklist

1. Set all 3 secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`) to unique 32+ char values
2. Set `DB_PASSWORD` (default rejected in production)
3. Set `CORS_ORIGIN` to production domain
4. Set `NODE_ENV=production`
5. Set `ANTHROPIC_API_KEY` and `AI_ENABLED=true` for AI features
6. Run `npm run db:migrate`
7. Run `npm run build`
8. Run `npm start`

### Production Behavior

| Feature | Production | Development |
|---------|-----------|-------------|
| Error messages | Generic "Internal Server Error" | Full details |
| Swagger docs | Disabled | `/documentation` |
| Health metrics | 404 | Full memory/CPU data |
| CSP | Enforced | Report-only |
| HSTS | Enabled (preload) | Disabled |
| Cookie secure | `true` | `false` |
| CORS | Exact origin only | `localhost:*` |

### Graceful Shutdown

On SIGINT/SIGTERM:
1. Stop accepting connections
2. Drain in-flight requests (10s timeout)
3. Close DB pool via Fastify onClose hook
4. Exit
