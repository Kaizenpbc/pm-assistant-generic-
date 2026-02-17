# PM Assistant Generic — Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  Vite 7.3 · React 18 · TypeScript · Tailwind · Port 5174       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │  Pages   │  │Components│  │  Stores   │  │  Services    │  │
│  │  (13)    │→ │  (45)    │→ │ Zustand(3)│→ │  Axios API   │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────┬───────┘  │
│       │              │              │                │          │
│  ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐    ┌─────┴──────┐  │
│  │ Router  │   │ TanStack  │  │localStorage│  │ WebSocket  │  │
│  │ v7.9    │   │ Query v5  │  │ persist  │    │ hook       │  │
│  └─────────┘   └───────────┘  └─────────┘    └─────┬──────┘  │
└──────────────────────────────────────────────────────┼──────────┘
                    HTTP (cookies)                     │ WS
                         │                             │
┌────────────────────────┼─────────────────────────────┼──────────┐
│                   BACKEND (Fastify v5)               │          │
│  TypeScript · Port 3001                              │          │
│                                                      │          │
│  ┌─────────────────── MIDDLEWARE PIPELINE ──────────────────┐   │
│  │ WebSocket → Logger → Security → Validation → Helmet →   │   │
│  │ CORS → Cookie → Rate Limit (100/min) → camelCase hook   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────── ROUTES (27 modules) ─────────────────┐  │
│  │ /api/v1/auth     /api/v1/projects    /api/v1/schedules   │  │
│  │ /api/v1/users    /api/v1/ai-chat     /api/v1/alerts      │  │
│  │ /api/v1/predictions  /api/v1/ai-reports  /api/v1/learning│  │
│  │ /api/v1/intelligence /api/v1/resources   /api/v1/exports │  │
│  │ /api/v1/portfolio    /api/v1/workflows   /api/v1/audit   │  │
│  │ /api/v1/monte-carlo  /api/v1/evm-forecast                │  │
│  │ /api/v1/auto-reschedule  /api/v1/resource-optimizer      │  │
│  │ /api/v1/meeting-intelligence  /api/v1/lessons-learned    │  │
│  │ /api/v1/nl-query  /api/v1/templates  /api/v1/task-pri..  │  │
│  │ /api/v1/ws (WebSocket)                                    │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│  ┌──────────── SERVICES (40 files) ─────────────────────────┐  │
│  │                                                           │  │
│  │  ┌─ IN-MEMORY (20) ──────────────────────────────────┐   │  │
│  │  │ UserService (1 admin user)                         │   │  │
│  │  │ ProjectService (3 seed projects)                   │   │  │
│  │  │ ScheduleService (tasks, comments, activities)      │   │  │
│  │  │ ResourceService (5 seed resources)                 │   │  │
│  │  │ TemplateService (10 built-in templates)            │   │  │
│  │  │ WorkflowService, AuditService, BaselineService     │   │  │
│  │  │ AutoRescheduleService, LessonsLearnedService       │   │  │
│  │  │ MeetingIntelligenceService, ProjectMemberService   │   │  │
│  │  │ MonteCarloService, CriticalPathService (compute)   │   │  │
│  │  │ SCurveService, TaskPrioritizationService (compute) │   │  │
│  │  │ ResourceOptimizerService, WebSocketService         │   │  │
│  │  │ anomalyDetectionService, whatIfScenarioService     │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌─ DATABASE-BACKED (5) ─────────────────────────────┐   │  │
│  │  │ aiLearningService (ai_feedback, ai_accuracy)       │   │  │
│  │  │ aiUsageLogger (ai_usage_log)                       │   │  │
│  │  │ aiReportService                                    │   │  │
│  │  │ crossProjectIntelligenceService                    │   │  │
│  │  │ predictiveIntelligence (EVM metrics)               │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌─ EXTERNAL API (2) ────────────────────────────────┐   │  │
│  │  │ claudeService → Anthropic Claude API               │   │  │
│  │  │ weatherProviders → OpenWeatherMap/WeatherAPI/Mock  │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌─ AI ORCHESTRATION (8) ────────────────────────────┐   │  │
│  │  │ aiChatService (conversation memory, in-memory Map) │   │  │
│  │  │ aiContextBuilder (aggregates project data for AI)  │   │  │
│  │  │ aiActionExecutor (executes Claude tool calls)      │   │  │
│  │  │ aiToolDefinitions (tool schemas for Claude)        │   │  │
│  │  │ aiSchedulingClaude, aiProjectCreator               │   │  │
│  │  │ aiTaskBreakdown, NLQueryService                    │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────── SCHEMAS (12 Zod files) ─────────────────────┐  │
│  │ aiSchemas, autoRescheduleSchemas, evmForecastSchemas     │  │
│  │ lessonsLearnedSchemas, meetingSchemas, monteCarloSchemas  │  │
│  │ nlQuerySchemas, phase5Schemas, predictiveSchemas          │  │
│  │ resourceOptimizerSchemas, taskPrioritizationSchemas       │  │
│  │ templateSchemas                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────── DATA LAYER ─────────────────────────────────┐  │
│  │ DatabaseService (singleton, mysql2 pool, 10 connections)  │  │
│  │ • OPTIONAL — app works in offline mode without DB         │  │
│  │ • Used by only 5 services (AI logging/analytics)          │  │
│  │ • No migrations, no ORM, raw SQL                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │ (optional)
                    ┌─────┴──────┐
                    │  MySQL DB  │
                    │  3 tables  │
                    │ ai_feedback│
                    │ ai_accuracy│
                    │ ai_usage   │
                    └────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend framework** | React | 18.2.0 |
| **Frontend router** | React Router | 7.9.1 |
| **State management** | Zustand | 4.4.7 |
| **Server state** | TanStack React Query | 5.8.4 |
| **HTTP client** | Axios | 1.6.0 |
| **CSS** | Tailwind CSS | 3.4.17 |
| **Icons** | Lucide React | 0.544.0 |
| **XSS protection** | DOMPurify | 3.3.1 |
| **Build tool** | Vite | 7.3.1 |
| **Backend framework** | Fastify | 5.6+ |
| **Language** | TypeScript | 5.2.2 |
| **Database driver** | mysql2 | 3.15+ |
| **Validation** | Zod | 4.1+ |
| **Auth** | jsonwebtoken + bcryptjs | 9.0 / 3.0 |
| **AI** | Anthropic Claude SDK | 0.74+ |
| **Test framework** | Vitest | 3.2.4 |

## Key Numbers

| Metric | Count |
|--------|-------|
| Backend route modules | 27 |
| Backend services | 40 (20 in-memory, 5 DB, 2 external, 8 AI, 5 compute) |
| Frontend pages | 13 |
| Frontend components | 45 |
| Zustand stores | 3 (auth, aiChat, ui) |
| API endpoints | 100+ |
| Zod schemas | 12 |
| Test files | 4 (62 tests) |
| Total backend TS files | ~82 |

## Data Flow

```
User → React Page → Component → Zustand Store / TanStack Query
  → Axios (cookie auth) → Fastify Route (Zod validation)
  → Service (business logic) → In-memory array OR MySQL OR Claude API
  → Response (snake→camelCase) → React Query cache → UI update

WebSocket: Server broadcast → Client hook → Query invalidation → Auto-refetch
```

## Authentication Flow

```
Login: POST /auth/login → bcrypt verify → JWT sign → Set httpOnly cookies
  ↓
Request: Cookie sent automatically → authMiddleware extracts userId
  ↓
401: Axios interceptor → POST /auth/refresh → New access token → Retry
  ↓
Failure: Redirect to /login, clear localStorage
```

**Token details:**
- Access token: JWT, 15 min expiry, stored in httpOnly cookie
- Refresh token: JWT, 7 day expiry, stored in httpOnly cookie
- Roles: admin, executive, manager, member

## Middleware Pipeline (order of execution)

1. **@fastify/websocket** — WebSocket upgrade support
2. **requestLogger** — Winston request logging (method, URL, IP, user-agent)
3. **securityMiddleware** — Security headers, CORS origin, cache-control
4. **securityValidationMiddleware** — Request size (10MB max), content-type, X-Request-ID
5. **@fastify/helmet** — CSP, HSTS, X-Frame-Options, hidePoweredBy
6. **@fastify/cors** — Origin validation, credentials: true
7. **@fastify/cookie** — httpOnly, secure (prod), sameSite: lax
8. **@fastify/rate-limit** — 100 req/min per user/IP, localhost allowlisted
9. **preSerialization** — snake_case → camelCase conversion
10. **authMiddleware** — Per-route, JWT verification from cookie

## Service Layer Classification

### In-Memory Services (data lost on restart)

| Service | Seed Data |
|---------|-----------|
| UserService | 1 admin user (admin/admin123) |
| ProjectService | 3 seed projects |
| ScheduleService | Tasks, comments, activities |
| ResourceService | 5 seed resources |
| TemplateService | 10 built-in templates |
| WorkflowService | Workflow rules + executions |
| AuditService | Event log |
| BaselineService | Schedule baselines |
| AutoRescheduleService | Reschedule proposals |
| LessonsLearnedService | Lessons + patterns |
| MeetingIntelligenceService | Meeting analyses |
| ProjectMemberService | Team membership |
| WebSocketService | Active WS connections |

### Compute-Only Services (no state)

| Service | Purpose |
|---------|---------|
| MonteCarloService | Schedule/cost simulation |
| CriticalPathService | CPM calculation |
| SCurveService | Progress curve generation |
| TaskPrioritizationService | Multi-factor prioritization |
| ResourceOptimizerService | Allocation optimization |
| anomalyDetectionService | Outlier detection |
| whatIfScenarioService | Scenario modeling |

### Database-Backed Services (MySQL)

| Service | Tables Used |
|---------|-------------|
| aiLearningService | ai_feedback, ai_accuracy_tracking |
| aiUsageLogger | ai_usage_log |
| aiReportService | Report storage |
| crossProjectIntelligenceService | Cross-project queries |
| predictiveIntelligence | EVM metrics |

### External API Services

| Service | External Dependency |
|---------|---------------------|
| claudeService | Anthropic Claude API (claude-sonnet-4-5-20250929) |
| weatherProviders | OpenWeatherMap / WeatherAPI / AccuWeather / Mock |

### AI Orchestration Services

| Service | Purpose |
|---------|---------|
| aiChatService | Conversation memory (in-memory Map) |
| aiContextBuilder | Aggregates project data into AI prompts |
| aiActionExecutor | Executes Claude tool calls |
| aiToolDefinitions | Tool schemas for function calling |
| aiSchedulingClaude | Schedule generation via Claude |
| aiProjectCreator | Project creation via Claude |
| aiTaskBreakdown | Task decomposition via Claude |
| NLQueryService | Natural language query with tool loop |

## Frontend Architecture

### Pages (13)

| Page | Route | Purpose |
|------|-------|---------|
| LoginPage | /login | Username/password auth |
| DashboardRouter | /dashboard | Role-based dashboard (executive vs PM) |
| ExecutiveDashboard | /dashboard (admin/exec) | High-level portfolio view |
| PMDashboard | /dashboard (manager/member) | Project list + AI summary |
| ProjectDetailPage | /project/:id | Individual project detail |
| ReportsPage | /reports | AI-generated reports |
| ScenarioModelingPage | /scenarios | What-if analysis |
| PortfolioPage | /portfolio | Cross-project analytics |
| WorkflowPage | /workflows | Workflow automation |
| MonteCarloPage | /monte-carlo | Risk simulation |
| MeetingMinutesPage | /meetings | Meeting transcript → tasks |
| LessonsLearnedPage | /lessons | Knowledge base |
| QueryPage | /query | Natural language data query |

### Zustand Stores (3)

| Store | State | Persisted |
|-------|-------|-----------|
| authStore | user, isAuthenticated, isLoading, error | user, isAuthenticated → localStorage |
| aiChatStore | messages, isLoading, conversationId, error | No |
| uiStore | sidebarCollapsed, aiPanelOpen, aiPanelContext, notifications | sidebarCollapsed, aiPanelOpen → localStorage |

### Component Groups (45 total)

| Group | Count | Purpose |
|-------|-------|---------|
| Layout | 3 | AppLayout, Sidebar, TopBar |
| AI | 4 | AIChatPanel, AIChatContext, QuickActions, TaskPrioritization |
| Dashboard | 2 | AISummaryBanner, PredictionCards |
| Schedule | 8 | GanttChart, KanbanBoard, CalendarView, TableView, TaskForm, etc. |
| EVM | 4 | EVMForecastDashboard, EVMTrendChart, ForecastComparison, SCurve |
| Resources | 4 | CapacityChart, WorkloadHeatmap, ResourceForecast, Rebalance |
| Monte Carlo | 3 | Histogram, TornadoDiagram, CriticalityIndex |
| Lessons | 2 | PatternCard, MitigationSuggestions |
| Query | 4 | QueryInput, BarChart, LineChart, PieChart |
| Templates | 5 | TemplatePicker, TemplateCard, Preview, Customize, SaveAs |
| Notifications | 2 | NotificationBell, AlertActionButton |
| Meeting | 1 | MeetingResultPanel |

## Configuration (Zod-validated at startup)

| Variable | Type | Default | Required |
|----------|------|---------|----------|
| NODE_ENV | development / production / test | development | No |
| PORT | 1000-65535 | 3001 | No |
| HOST | string | localhost | No |
| DB_HOST | string | localhost | No |
| DB_PORT | 1-65535 | 3306 | No |
| DB_USER | string | root | No |
| DB_PASSWORD | string | rootpassword | No |
| DB_NAME | string | pm_assistant_generic | No |
| JWT_SECRET | string (min 32) | — | **Yes** |
| JWT_REFRESH_SECRET | string (min 32) | — | **Yes** |
| COOKIE_SECRET | string (min 32) | — | **Yes** |
| CORS_ORIGIN | URL | http://localhost:5173 | No |
| LOG_LEVEL | winston level | debug | No |
| ANTHROPIC_API_KEY | string | '' | No |
| AI_MODEL | string | claude-sonnet-4-5-20250929 | No |
| AI_TEMPERATURE | 0-1 | 0.3 | No |
| AI_MAX_TOKENS | 100-8192 | 4096 | No |
| AI_ENABLED | boolean | false | No |
| WEATHER_API_PROVIDER | openweathermap / weatherapi / accuweather / mock | mock | No |
| WEATHER_API_KEY | string | '' | No |
| WEATHER_CACHE_MINUTES | 1-1440 | 30 | No |

**Validation rule:** JWT_SECRET, JWT_REFRESH_SECRET, and COOKIE_SECRET must all be different.

## Persistence Model

| What | Where | Survives Restart? |
|------|-------|-------------------|
| AI feedback/accuracy/usage logs | MySQL | Yes |
| Frontend auth state | localStorage | Yes (browser) |
| Users, projects, schedules, tasks | Static arrays in services | **No** |
| Resources, templates, workflows | Static arrays in services | **No** |
| AI conversations | In-memory Map | **No** |
| Audit trail | In-memory array | **No** |
| Baselines, lessons, meetings | In-memory arrays | **No** |

## Security Posture

### Implemented
- JWT-based authentication (access + refresh tokens in httpOnly cookies)
- Role-based access control (admin, executive, manager, member)
- Auth middleware on all API routes (105+ endpoints)
- CORS origin validation (no wildcard)
- Content Security Policy (Helmet)
- HSTS in production (31536000s)
- Rate limiting (100 req/min per user/IP)
- Request size validation (10MB max)
- Content-type enforcement
- Error message sanitization in production
- Audit logging
- Request ID tracing (X-Request-ID)
- XSS protection (DOMPurify on frontend)
- Secure request IDs (crypto.randomUUID)

### Not Implemented
- CSRF token handling
- Per-endpoint rate limiting
- SQL injection prevention (parameterized queries needed when DB is used)
- Password complexity requirements
- Account lockout after failed attempts
- API key rotation
- Distributed rate limiting (multi-instance)

## Testing

| Test File | Tests | Coverage |
|-----------|-------|----------|
| authMiddleware.test.ts | 9 | Token validation, expiry, wrong secret, public endpoints |
| routeAuth.test.ts | 38 | 401 on 19 protected route groups |
| securityMiddleware.test.ts | 12 | Headers, CORS, cache-control, request ID, content validation |
| rateLimiting.test.ts | 3 | Rate-limit headers, blocking, localhost allowList |
| **Total** | **62** | Auth + security layer |

## Known Gaps

1. **No data persistence** — 20 of 25 core services use static in-memory arrays
2. **No shared types** — Frontend and backend define types independently
3. **No database migrations** — No schema management system
4. **No ORM** — Raw SQL for the 5 DB-backed services
5. **No React error boundaries** — Unhandled component errors crash the app
6. **No request cancellation** — Missing AbortController on route changes
7. **No APM/metrics** — No Prometheus, DataDog, or distributed tracing
8. **No CSRF protection** — Cookie-based auth without CSRF tokens
9. **Single-instance only** — In-memory state doesn't support horizontal scaling
