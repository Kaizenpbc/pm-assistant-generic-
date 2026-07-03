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
- **No transaction boundaries:** `databaseService.transaction()` exists but is unused. Multi-table writes (e.g. project + schedule + tasks) are sequential queries without ACID guarantees.
- **Zod validation coverage partial:** 23/63 routes use Zod schemas. Others rely on Swagger schema or ad-hoc parsing.
- **Fire-and-forget side effects everywhere:** Audit logging, workflow triggers, WebSocket broadcasts, webhook dispatches are all `.catch(() => {})`. No visibility into failures or retry logic.
- **Inconsistent error responses:** Some routes return `{ error, message }`, others `{ statusCode, error, message, timestamp, path }`.

### 2.2 Non-Functional Requirements

- **Scalability:** Hard single-instance ceiling. In-memory rate limiter, metrics, agent circuit breakers, and in-process cron jobs mean horizontal scaling requires migrating to shared state (Redis).
- **Performance:** DB pool fixed at 10 connections (hard-coded). No query timeouts or connection timeouts configured. EmbeddingService loads entire table into memory for similarity search (pending MariaDB 11.6 vector columns). Agent scheduler runs serially per project.
- **Availability:** DB failure leads to "offline mode" (startup succeeds but routes fail). No circuit breaker for user-facing AI routes (only agent workflows have circuit breakers via DegradationHandler).
- **Maintainability:** 56+ service classes, most with inline SQL and hand-rolled mappers. Changing DB schema requires updating SQL strings across many files.
- **Observability:** Good -- request ID propagated via AsyncLocalStorage, Winston logger includes requestId, MetricsService tracks request count/latency/AI tokens/DB queries, admin-only `/api/v1/metrics` endpoint. Missing: no distributed tracing, no log aggregation, no alerting on metrics.

### 2.3 Security & Compliance

**Strengths:**
- JWT (15m access, 7d refresh) in HttpOnly cookies with unique secrets enforced
- API key scopes (read/write/admin) with per-key rate limits
- Per-IP rate limiting on auth and waitlist routes
- Zod validation on 23/63 routes; Helmet CSP configured
- API key hashed with bcrypt; passwords via bcrypt

**Gaps:**
- JWT users have no scope enforcement (only API keys are scope-limited)
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
- No cost alerts (user gets hard-blocked at budget limit, no proactive warning)
- No fallback model if Claude fails (429, 503, timeout)
- Token budget not enforced for all AI calls (some service-level calls don't pass userId)
- No prompt injection mitigation (user inputs interpolated directly into prompts)
- Pricing table hardcoded in claudeService

### 2.5 Cost & Operational Complexity

- **Manual deployment:** Build locally, SCP to server, restart via cloudlinux-selector. No CI/CD, no automated rollback.
- **Migrations one-way:** No rollback runner, no dry-run mode.
- **Cron jobs in-process:** 5 cron jobs (agent scan, overdue scan, recurrence, digest, reports). If Node process crashes, all stop.
- **No log rotation configured in code:** Relies on OS/hosting.

---

## 3. Architectural Risks

| Risk | Severity | Description |
|------|----------|-------------|
| No transaction boundaries for multi-table writes | **High** | Project creation, task import, bulk updates are sequential queries without ACID guarantees. Partial failure leaves orphaned or inconsistent data. `databaseService.transaction()` exists but is unused. |
| Single-instance design with in-memory state | **High** | Rate limiter, metrics, circuit breakers, cron jobs all in-process. Horizontal scaling impossible without migrating to Redis. |
| EmbeddingService full table scan | **High** | Loads all embeddings into memory for similarity search. Works for <1000 rows, breaks at scale. Pending MariaDB 11.6 upgrade. |
| No AI circuit breaker for user-facing routes | **Medium** | Agent workflows have per-agent circuit breakers, but AI chat/reports/scheduling have no fallback. Claude 503/429 causes hard failures. |
| Fire-and-forget side effects with no retry | **Medium** | Audit logs, webhooks, workflow triggers, WebSocket broadcasts all `.catch(() => {})`. Failures are silent. |
| No query/connection timeouts | **Medium** | Slow queries can block the connection pool indefinitely. No statement timeout configured. |
| Partial Zod validation coverage (23/63 routes) | **Medium** | Risk of missed validation, injection attacks, or malformed inputs causing crashes. |
| Partial repository adoption (3/56+ entities) | **Medium** | Schema changes still require updating SQL strings across many service files. |
| Agent scheduler serial execution | **Medium** | Scans one project at a time. For 1000 projects, scan could take minutes. |
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
| 1 | Add transaction boundaries for multi-table writes | Ensures ACID guarantees for project creation, task import, bulk updates | High | Low |
| 2 | Add query/connection timeouts to DB pool | Prevents slow queries from blocking connection pool indefinitely | Medium | Low |
| 3 | Add AI cost alerts (80% threshold warning) | Proactive notification before hard budget block | Medium | Low |
| 4 | Add circuit breaker for user-facing AI routes | Fails fast on Claude outages, returns degraded response | High | Medium |
| 5 | Extend Zod validation to remaining 40 routes | Consistent input validation, reduced injection risk | Medium | Medium |
| 6 | Implement dead-letter queue for fire-and-forget side effects | Captures failed audit logs, webhooks for retry | Medium | Medium |
| 7 | Parallelize agent scheduler execution | Reduces scan time from O(n) to O(n/parallelism) | Medium | Medium |
| 8 | Add structured log export/aggregation | Enables search, alerting, long-term retention | Low | Low |
| 9 | Migrate rate limiter and metrics to Redis | Enables horizontal scaling | High | High |
| 10 | Extend repository pattern to all core entities | Centralizes SQL, enables caching/read replicas | High | High |
| 11 | Move cron jobs to external scheduler | Prevents duplicate execution in multi-instance | Medium | Medium |
| 12 | Add scope enforcement for JWT users | Fine-grained permissions, least-privilege access | Low | Medium |

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

**New: Now (quick wins)**
- Add transaction boundaries for multi-table writes (Low difficulty, high impact)
- Add query/connection timeouts to DB pool (Low difficulty, medium impact)
- Add AI cost alerts at 80% threshold (Low difficulty, medium impact)

**New: Next (medium-term)**
- Add circuit breaker for user-facing AI routes (Medium difficulty, high impact)
- Extend Zod validation to remaining 40 routes (Medium difficulty, medium impact)
- Implement dead-letter queue for fire-and-forget side effects (Medium difficulty, medium impact)
- Parallelize agent scheduler execution (Medium difficulty, medium impact)

**New: Later (strategic)**
- Migrate rate limiter and metrics to Redis (High difficulty, high impact)
- Extend repository pattern to all core entities (High difficulty, high impact)
- Move cron jobs to external scheduler (Medium difficulty, medium impact)
- Add scope enforcement for JWT users (Medium difficulty, low impact)

---

*End of audit.*
