# PM Assistant — Architecture Audit

**Audit date:** July 3, 2026 (revision 2; original March 7, 2026)
**Scope:** pm-assistant-generic codebase (backend, frontend, config, deployment)
**Audience:** Product owner, dev team
**Method:** Codebase exploration per Architecture Review Agent spec
**Codebase Stats:** 235 server TypeScript files, 63 route modules, 56+ service classes

---

## 1. High-Level Summary

**pm-assistant-generic** is a production-deployed, single-tenant PM application running on TMD Hosting (LiteSpeed + Passenger). It serves a React SPA via Fastify v5, backed by MySQL/MariaDB, with optional Claude AI integration via Anthropic SDK. The app runs as a single Node.js process that hosts:

- **API server** with 63 REST route modules under `/api/v1/*` and `/mcp`
- **In-process cron schedulers** via node-cron (agent workflows, overdue scanners, digest emails, report delivery, recurring tasks)
- **In-memory state** (rate limiter, metrics, AI agent circuit breakers)
- **Static file serving** in production via `@fastify/static` + SPA fallback

**Architecture Pattern:**
- **Layering:** Routes -> Services -> Repositories (3 repos) / Direct DB -> MySQL
- **Auth:** JWT (HttpOnly cookies) + API keys (Bearer tokens) with scopes
- **Security:** Helmet CSP, CORS allowlist, per-IP/per-key rate limiting (in-memory), Zod validation on 23/63 routes
- **AI:** Claude SDK with per-user monthly token budgets, structured prompts, tool loop support, streaming
- **Observability:** Winston logger with request ID propagation via AsyncLocalStorage, MetricsService for counters/latency percentiles, response logging with duration
- **Data Access:** 3 BaseRepository subclasses (Project, User, Schedule) + 53 services with inline SQL

**Deployment Model:**
Single-instance design. No Redis, no load balancer, no container orchestration. LiteSpeed serves static assets; Passenger proxies `/api/*` and `/mcp` to the Node process.

---

## 2. Detailed Critique

### 2.1 Functional Design

**Strengths:**
- Clear layering: routes handle HTTP/auth/validation -> services orchestrate business logic -> repositories/DB access
- Consistent use of `auditLedgerService.append()` and `policyEngineService.evaluate()` in create/update/delete paths
- Repository layer for 3 core entities (Project, User, Schedule) with shared `BaseRepository` for findById, findAll, queryPaginated, buildUpdate
- Workflow triggers (`dagWorkflowService.evaluateProjectChange`) fired from services as fire-and-forget
- Pagination enforced on major list endpoints (projects, schedules, tasks, templates, sprints) via `paginationSchema` (limit 1-200, default 50)

**Gaps:**
- **Inconsistent data access pattern:** Only 3 entities have repositories. Remaining 53 services call `databaseService.query()` with inline SQL and hand-rolled rowMapper functions.
- ~~**No transaction boundaries:**~~ **Resolved (July 2026).** `databaseService.transaction()` + `queryOn()` now wraps 7 multi-table service methods.
- **Zod validation coverage partial:** 23/63 routes use Zod schemas. Others rely on Swagger schema or ad-hoc parsing.
- ~~**Fire-and-forget side effects everywhere:**~~ **Mitigated (July 2026).** `DeadLetterService` captures failed side effects (audit logs, webhooks) with retry support. All `.catch(() => {})` calls replaced with DLQ capture. Admin endpoints for monitoring (`/api/v1/admin/dead-letter`).
- **Inconsistent error responses:** Some routes return `{ error, message }`, others `{ statusCode, error, message, timestamp, path }`.

### 2.2 Non-Functional Requirements

- **Scalability:** Hard single-instance ceiling. In-memory rate limiter, metrics, agent circuit breakers, and in-process cron jobs mean horizontal scaling requires migrating to shared state (Redis).
- **Performance:** DB pool fixed at 10 connections with env-configurable timeouts (`connectTimeout`, `idleTimeout`, `queueLimit`). EmbeddingService loads entire table into memory for similarity search (pending MariaDB 11.6 vector columns). ~~Agent scheduler runs serially per project.~~ **Resolved (July 2026).** `parallelLimit()` runs up to 3 projects concurrently.
- **Availability:** DB failure leads to "offline mode" (startup succeeds but routes fail). ~~No circuit breaker for user-facing AI routes~~ **Resolved (July 2026).** `AICircuitBreaker` in `claudeService.ts` trips after 5 transient failures, 60s cooldown, returns 503.
- **Maintainability:** 56+ service classes, most with inline SQL and hand-rolled mappers. Changing DB schema requires updating SQL strings across many files. ~~Several "god-object" files are oversized and unmaintainable~~ **Mitigated (July 2026).** All four oversized files split: `ReasoningEngine.ts` → `reasoning/` (14 files), `AgentSchedulerService.ts` → `scheduling/` (5 files), `DagWorkflowService.ts` → `dagWorkflow/` (4 files), `LessonsLearnedService.ts` → `lessonsLearned/` (5 files). Thin orchestrator classes remain with unchanged public APIs.
- **Observability:** Good -- request ID propagated via AsyncLocalStorage, Winston logger includes requestId, MetricsService tracks request count/latency/AI tokens/DB queries, admin-only `/api/v1/metrics` endpoint. Daily-rotated JSON logs with admin query/download endpoints. Missing: no distributed tracing, no external alerting on metrics.

### 2.6 Database Migrations

- **~~Duplicate migration numbers:~~** **Mitigated (July 2026).** Known historical duplicates (002, 003) preserved in an allowlist. `migrationRunner.ts` now detects and fails fast on any NEW duplicate numeric prefixes. Apply order is deterministic: (number, then filename). CI test guards against future duplicates.
- **No rollback runner:** Migrations are one-way SQL files. No reverse migration generator, no dry-run mode.

### 2.3 Security & Compliance

**Strengths:**
- JWT (15m access, 7d refresh) in HttpOnly cookies with unique secrets enforced
- API key scopes (read/write/admin) with per-key rate limits
- Per-IP rate limiting on auth and waitlist routes
- Zod validation on 23/63 routes; Helmet CSP configured
- API key hashed with bcrypt; passwords via bcrypt

**Gaps:**
- ~~JWT users have no scope enforcement~~ **Resolved (July 2026).** `requireScope()` now maps JWT roles to scopes: admin→all, manager/pm/scrum_master→read+write, member/executive/finance→read.
- No PII masking in logs
- File uploads: no MIME type validation or content inspection (only size limit)
- No rate limit on verification email resends
- CORS allows localhost (any port) in development

### 2.4 AI/LLM Integration

**Strengths:**
- Per-user token budgets via `AIBudgetService` enforced in `claudeService.complete/stream/completeToolLoop`
- Structured prompt management with versioned templates
- Tool loop support (multi-turn, up to 5 iterations)
- SSE streaming for AI chat
- JSON schema validation with retry for structured output
- Usage tracked in MetricsService and persisted to `ai_usage_log` table

**Gaps:**
- ~~No cost alerts~~ **Resolved (July 2026).** 80% threshold warning with daily dedup via notifications table.
- No fallback model if Claude fails (429, 503, timeout)
- Token budget not enforced for all AI calls (some service-level calls don't pass userId)
- No prompt injection mitigation (user inputs interpolated directly into prompts)
- Pricing table hardcoded in claudeService

### 2.5 Cost & Operational Complexity

- **Manual deployment:** Build locally, SCP to server, restart via cloudlinux-selector. No CI/CD, no automated rollback.
- **Migrations one-way:** No rollback runner, no dry-run mode.
- **Cron jobs in-process:** 5 cron jobs (agent scan, overdue scan, recurrence, digest, reports). If Node process crashes, all stop.
- ~~**No log rotation configured in code:**~~ **Resolved (July 2026).** Daily-rotated JSON logs via `winston-daily-rotate-file` (14d retention, 20MB max, gzip). Admin query/download endpoints.

---

## 3. Architectural Risks

| Risk | Severity | Description |
|------|----------|-------------|
| ~~Duplicate migration numbers (002, 003)~~ | ~~High~~ | **Mitigated (July 2026).** Migration runner hardened with duplicate-number guard (known allowlist for historical 002/003), deterministic sort by (number, filename), CI test guard. |
| ~~God-object service files (95 KB, 49 KB, 38 KB, 33 KB)~~ | ~~High~~ | **Resolved (July 2026).** All four oversized files split: `ReasoningEngine.ts` → `reasoning/` (14 files), `AgentSchedulerService.ts` → `scheduling/` (5 files), `DagWorkflowService.ts` → `dagWorkflow/` (4 files), `LessonsLearnedService.ts` → `lessonsLearned/` (5 files). All classes remain thin orchestrators with unchanged public APIs. |
| ~~No transaction boundaries for multi-table writes~~ | ~~High~~ | **Resolved (July 2026).** 7 multi-table methods now wrapped in `databaseService.transaction()` with `queryOn()` helper. |
| Single-instance design with in-memory state | **High** | Rate limiter, metrics, circuit breakers, cron jobs all in-process. Horizontal scaling impossible without migrating to Redis. |
| EmbeddingService full table scan | **High** | Loads all embeddings into memory for similarity search. Works for <1000 rows, breaks at scale. Pending MariaDB 11.6 upgrade. |
| ~~No AI circuit breaker for user-facing routes~~ | ~~Medium~~ | **Resolved (July 2026).** `AICircuitBreaker` in `claudeService.ts` — trips after 5 transient failures, 60s cooldown, returns 503. |
| ~~Fire-and-forget side effects with no retry~~ | ~~Medium~~ | **Resolved (July 2026).** `DeadLetterService` captures failed side effects with retry. Admin monitoring endpoints added. |
| ~~No query/connection timeouts~~ | ~~Medium~~ | **Resolved (July 2026).** Pool configured with `connectTimeout`, `idleTimeout`, `queueLimit` (env-configurable). |
| Partial Zod validation coverage (23/63 routes) | **Medium** | Risk of missed validation, injection attacks, or malformed inputs causing crashes. (Future improvement — tracked as item 7.) |
| Partial repository adoption (3/56+ entities) | **Medium** | Schema changes still require updating SQL strings across many service files. |
| ~~Agent scheduler serial execution~~ | ~~Medium~~ | **Resolved (July 2026).** `parallelLimit()` runs up to 3 projects concurrently in `scanOrchestrator.ts`. |
| ~~No rate limiting on auth endpoints~~ | ~~High~~ | **Mitigated (July 2026).** Per-IP rate limits on all auth and waitlist endpoints. |
| ~~Waitlist admin key in query string~~ | ~~High~~ | **Mitigated (July 2026).** Moved to `X-Admin-Key` header. |
| ~~No per-user AI budget~~ | ~~Medium~~ | **Mitigated (July 2026).** Per-user monthly token budget via AIBudgetService. |
| ~~Services own all SQL~~ | ~~Medium~~ | **Partially mitigated (July 2026).** Repository layer for 3 core entities. 53 services still have inline SQL. |
| ~~Unbounded list endpoints~~ | ~~Medium~~ | **Mitigated (July 2026).** Pagination on major list endpoints. |
| ~~No structured metrics/tracing~~ | ~~Low~~ | **Mitigated (July 2026).** MetricsService + AsyncLocalStorage request context + requestId in logs. |

---

## 4. Recommended Improvements

| # | Recommendation | Rationale | Impact | Difficulty |
|---|----------------|-----------|--------|------------|
| ~~1~~ | ~~Fix duplicate migration numbers + harden runner~~ | **Done (July 2026).** Migration runner hardened, CI test added. | ~~High~~ | ~~Low~~ |
| ~~2~~ | ~~Break up god-object agent files~~ | **Done (July 2026).** ReasoningEngine → 14 files in `reasoning/`. AgentSchedulerService → 5 files in `scheduling/`. | ~~High~~ | ~~Medium~~ |
| ~~3~~ | ~~Add transaction boundaries for multi-table writes~~ | **Done (July 2026).** `queryOn()` helper + `transaction()` wraps 7 multi-table methods (ScheduleService, SprintService, ApprovalWorkflowService, IntegrationService). | ~~High~~ | ~~Low~~ |
| ~~4~~ | ~~Add query/connection timeouts to DB pool~~ | **Done (July 2026).** `connectTimeout: 5s`, `idleTimeout: 30s`, `queueLimit: 50` — env-configurable via `DB_CONNECT_TIMEOUT`, `DB_IDLE_TIMEOUT`, `DB_QUEUE_LIMIT`. | ~~Medium~~ | ~~Low~~ |
| ~~5~~ | ~~Add AI cost alerts (80% threshold warning)~~ | **Done (July 2026).** `checkBudget()` fires daily deduped `ai_budget_warning` notification at 80% usage. | ~~Medium~~ | ~~Low~~ |
| ~~6~~ | ~~Add circuit breaker for user-facing AI routes~~ | **Done (July 2026).** `AICircuitBreaker` in `claudeService.ts` — trips after 5 transient failures, 60s cooldown, returns 503 to clients. Exposed in `/agent/health` endpoint. | ~~High~~ | ~~Medium~~ |
| 7 | Extend Zod validation to remaining 40 routes | Consistent input validation, reduced injection risk | Medium | Medium |
| ~~8~~ | ~~Implement dead-letter queue for fire-and-forget side effects~~ | **Done (July 2026).** `DeadLetterService` with `capture()`/`processRetries()`/`getStats()`. All `.catch(() => {})` in 5 services replaced with DLQ capture. Admin endpoints: `GET /api/v1/admin/dead-letter`, `GET /dead-letter/failed`. Migration `031_dead_letter_queue.sql`. | ~~Medium~~ | ~~Medium~~ |
| ~~9~~ | ~~Parallelize agent scheduler execution~~ | **Done (July 2026).** `parallelLimit()` runs up to 3 projects concurrently in `scanOrchestrator.ts`. Portfolio agents still run after all projects complete. | ~~Medium~~ | ~~Medium~~ |
| ~~10~~ | ~~Add structured log export/aggregation~~ | **Done (July 2026).** Daily-rotated JSON logs (14d retention, 20MB max, gzip), admin endpoints: `GET /api/v1/admin/logs` (query by level/search/date), `/logs/files` (list), `/logs/download/:filename`. | ~~Low~~ | ~~Low~~ |
| 11 | Migrate rate limiter and metrics to Redis | Enables horizontal scaling. **Blocked:** Redis not available on TMD Hosting shared plan. | High | High |
| 12 | Extend repository pattern to all core entities | Centralizes SQL, enables caching/read replicas. **Blocked:** Redis not available on TMD Hosting shared plan. | High | High |
| 13 | Move cron jobs to external scheduler | Prevents duplicate execution in multi-instance. **Blocked:** No external job runner on TMD Hosting. | Medium | Medium |
| ~~14~~ | ~~Add scope enforcement for JWT users~~ | **Done (July 2026).** `requireScope()` now maps JWT roles to scopes: admin→all, manager/pm/scrum_master→read+write, member/executive/finance→read. Unknown roles default to read-only. | ~~Low~~ | ~~Medium~~ |
| ~~15~~ | ~~Break up DagWorkflowService (38 KB) and LessonsLearnedService (33 KB)~~ | **Done (July 2026).** `DagWorkflowService.ts` → `dagWorkflow/` (4 files: types, rowMappers, engine, templateResolver + index). `LessonsLearnedService.ts` → `lessonsLearned/` (5 files: prompts, seeder, extractor, patternDetector, mitigationAdvisor + index). Original files are thin re-export shims. | ~~Medium~~ | ~~Medium~~ |

---

## 5. Revised Architecture Diagram (ASCII)

**Current State:**

```
                    +-----------+
                    | LiteSpeed |  (static: HTML, CSS, JS)
                    +-----+-----+
                          |
              +-----------+-----------+
              |                       |
        /api/*, /mcp             static files
              |
     +--------v---------+
     |  Passenger (Node)  |
     |  - Fastify Server  |
     |  - Rate limit (mem)|  <-- Single-instance bottleneck
     |  - Metrics (mem)   |
     |  - Request context |
     |  - 5 cron jobs     |
     +--------+-----------+
              |
    +---------+---------+----------+
    |         |         |          |
    v         v         v          v
  MySQL   Claude    Stripe    OpenAI
 (pool 10) (AI)   (Billing) (Embeddings)
```

**Target State (with improvements):**

```
                    +-----------+
                    | LiteSpeed |  (static: HTML, CSS, JS)
                    +-----+-----+
                          |
     +--------------------v--------------------+
     |  Passenger (Node, multi-instance)       |
     |  - Fastify (load balanced)              |
     |  - Shared rate limiter (Redis)          |
     |  - Shared metrics (Redis)               |
     |  - Circuit breakers (AI)                |
     +--------+--------------------------------+
              |
    +---------+---------+----------+---------+
    |         |         |          |         |
    v         v         v          v         v
  MySQL   Claude    Stripe    OpenAI     Redis
 (pool)    (AI)   (Billing) (Embedding)  (state)
         (circuit            (circuit)
          breaker)            breaker)
```

---

## 6. Phased Roadmap

**Now (critical / quick wins)** -- ALL DONE (July 2026)
- ~~Add rate limiting for `/api/v1/auth/*` and `/api/v1/waitlist`.~~ Done.
- ~~Switch waitlist admin to `X-Admin-Key` header.~~ Done.
- ~~Add request duration and status code to response logger.~~ Done.

**Next (this/next sprint)** -- ALL DONE (July 2026)
- ~~Pagination for list endpoints with max page size.~~ Done.
- ~~Per-user AI token budget enforcement.~~ Done.
- ~~Zod validation expansion.~~ Done (23/63 routes, 39%).

**Later (strategic)** -- PARTIALLY DONE (July 2026)
- ~~Repository layer for core entities.~~ Done: 3 entities (Project, User, Schedule).
- ~~Structured metrics and request ID tracing.~~ Done: MetricsService + AsyncLocalStorage.
- Redis for rate limiting and agent lock -- TODO.

**New: P0 (do first)** — ALL DONE (July 2026)
- ~~Fix duplicate migration numbers (002, 003) + harden runner.~~ Done. Known allowlist for 002/003, duplicate-number guard, CI test.
- ~~Break up ReasoningEngine (95 KB) and AgentSchedulerService (49 KB).~~ Done. ReasoningEngine → `reasoning/` (14 files, all <13 KB). AgentSchedulerService → `scheduling/` (5 files, all <16 KB).

**New: Now (quick wins)** — All done (July 2026)
- ~~Add transaction boundaries for multi-table writes (Low difficulty, high impact)~~
- ~~Add query/connection timeouts to DB pool (Low difficulty, medium impact)~~
- ~~Add AI cost alerts at 80% threshold (Low difficulty, medium impact)~~

**New: Next (medium-term)** — MOSTLY DONE (July 2026)
- ~~Add circuit breaker for user-facing AI routes (Medium difficulty, high impact)~~ Done.
- Extend Zod validation to remaining 40 routes (Medium difficulty, medium impact) — TODO.
- ~~Implement dead-letter queue for fire-and-forget side effects (Medium difficulty, medium impact)~~ Done.
- ~~Parallelize agent scheduler execution (Medium difficulty, medium impact)~~ Done.
- ~~Break up DagWorkflowService (38 KB) and LessonsLearnedService (33 KB)~~ Done.
- ~~Add scope enforcement for JWT users~~ Done.

**New: Later (strategic)** — INFRASTRUCTURE-BLOCKED
- Migrate rate limiter and metrics to Redis — **Blocked:** Redis not available on TMD Hosting shared plan.
- Extend repository pattern to all core entities — **Blocked:** Depends on Redis for caching layer.
- Move cron jobs to external scheduler — **Blocked:** No external job runner on TMD Hosting.

---

*End of audit.*
