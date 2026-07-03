# PM Assistant — Architecture Audit

**Audit date:** March 7, 2026  
**Scope:** pm-assistant-generic codebase (backend, frontend, config, deployment)  
**Audience:** Product owner, dev team  
**Method:** Codebase exploration per Architecture Review Agent spec (`.claude/agents/architecture-reviewer.md`)

---

## 1. High-Level Summary

**pm-assistant-generic** is a single-repo, full-stack PM application: Fastify (v5) API plus React (Vite) SPA, MySQL/MariaDB, optional Claude (Anthropic) and OpenAI (embeddings). One Node process serves the API, serves static client in production, runs an in-process agent scheduler and cron-style overdue scanner, and uses an in-memory rate limiter. There is no separate data-access layer: services call `databaseService.query()` and build SQL in service code. Auth is JWT (HttpOnly cookies) plus API keys with scopes (read/write/admin); API key rate limiting is per-key and in-memory. There are 50+ route modules under `/api/v1/*`, MCP at `/mcp`, and a separate MCP server process for Claude. The app is built for a single-instance, single-tenant deployment (e.g. TMD Hosting with Passenger + LiteSpeed).

---

## 2. Detailed Critique

### 2.1 Functional Design

- **Layering:** Routes → services → `databaseService` is clear. Routes do validation (Zod where used), call a service, and return. No repository/DAO layer: services own SQL and mapping (e.g. `ProjectService` with `rowToProject`). That’s consistent but pushes all DB coupling and SQL into services; any future multi-write or cross-service transaction is harder.
- **Separation of concerns:** Good split between routes (HTTP, auth, scopes) and services (business logic). Some routes (e.g. `waitlist`) bypass auth and call `databaseService` directly — fine for a tiny module but a different pattern from the rest.
- **API design:** REST under `/api/v1/` with stable prefixes. Inconsistent use of Zod in routes (e.g. projects use Zod, many others rely on Swagger schema or ad hoc parsing). OpenAPI/Swagger is registered; that’s good for discoverability and MCP.
- **Data flow:** Request → plugins (security, CORS, cookie, API key resolution, rate limit for API keys) → route → auth/scope → service → DB or Claude. Webhook/event side effects (e.g. `webhookService.dispatch`) are invoked from services; no shared event bus.

**Gaps:** No global request ID propagation in logs (only header set). No formal DTO layer; responses are often raw service/DB shapes with a global camelCase hook.

### 2.2 Non-Functional Requirements

- **Scalability:** Single process, single DB pool (e.g. 10 connections). Horizontal scaling would require moving rate limiting and any in-memory state (e.g. agent scheduler, rate limiter) to a shared store (e.g. Redis); not designed for multi-instance.
- **Performance:** Pool size is fixed. No evidence of query timeouts or statement timeouts. Some routes (e.g. projects list) use a hard `LIMIT 1000`; no cursor/offset pagination contract. Large payloads (e.g. schedules with many tasks) could grow unbounded without pagination.
- **Availability:** DB failure leads to “offline mode” (startup still succeeds); many endpoints will fail at query time. No circuit breaker around Anthropic; failures surface as 500s. Health check returns 503 when DB is down — good.
- **Maintainability:** Many small route files and a large service set. No shared “repository” or query helpers, so SQL and column names are repeated. Agent capabilities are registered at startup (`agentCapabilities`); adding a new capability is clear but requires code changes.
- **Observability:** Request logging (onRequest) and response logging with duration and status code (onResponse, added July 2026). Global error handler logs and writes to `auditService`. No metrics (e.g. request rate, latency percentiles, AI token usage) or tracing. Log level is configurable; production defaults to `info`.

### 2.3 Security & Compliance

- **Auth/authz:** JWT in HttpOnly cookie + optional API key (Bearer). `requireScope` only applies to API keys; JWT users are treated as full access by role (no fine-grained scope in code). Waitlist admin uses `WAITLIST_ADMIN_KEY` query param — weak (query params get logged); should be header or dedicated auth.
- **Input validation:** Zod used in several routes; others rely on Swagger or manual checks. Security middleware enforces JSON for non-empty body and 10MB body limit; good. No centralized sanitization for logging (e.g. masking PII in error payloads).
- **Secrets:** Config validated with Zod; JWT/refresh/cookie secrets must differ. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, Stripe keys are env-based — no secret manager integration.
- **CORS:** Configured with allowlist (config origin, localhost, Claude domains for MCP). Credentials allowed. Sensible for a known front-end and MCP.
- **Rate limiting:** Per-key (API keys) and per-IP (auth, waitlist) rate limiting, both in-memory. Auth routes (login, register, forgot-password, reset-password, verify-email) and waitlist routes (join, count) are rate limited (added July 2026).
- **Data protection:** Passwords via bcrypt; tokens in cookies with secure/sameSite. No explicit discussion of encryption at rest for DB or uploads.

### 2.4 AI/LLM Integration

- **Usage:** Claude via `claudeService.ts` (Anthropic SDK): single client, created when `AI_ENABLED` and key present. Used by AI chat, NL query, meeting intelligence, lessons learned, task prioritization, reports, agent workflows, etc.
- **Prompts:** `PromptTemplate` class and `promptTemplates` in `claudeService`; versioned templates, no external store. Tool definitions live in `aiToolDefinitions.ts` and `NLQueryService`.
- **Token limits:** `AI_MAX_TOKENS` (default 4096); request timeout 30s in code. No per-user or per-tenant token budget; cost control is env/feature flags only.
- **Fallback:** API errors are mapped to user-facing messages; no fallback model or degraded “no AI” response path documented in the flow.
- **Streaming:** AI chat supports SSE streaming; `streamMessage` yields chunks. Good for UX; ensure no sensitive data in streamed chunks (same as non-stream path).

### 2.5 Cost & Operational Complexity

- **Hosting:** Single Node app behind LiteSpeed/Passenger; static from LiteSpeed, API from Node. Fits TMD-style hosting; no Kubernetes or multi-region.
- **Database:** Migrations are versioned SQL files; no programmatic migration runner inspected. Connection pool and single DB — backup/restore and failover are environment-specific.
- **Dependencies:** Fastify ecosystem, Anthropic, OpenAI (embeddings), Stripe, Resend, mysql2, etc. Moderate footprint; no heavy queue or cache.
- **Deployment:** Build server + client; SCP + Passenger restart per docs. No container or CI/CD pipeline in repo; manual deploy.

---

## 3. Architectural Risks

| Risk | Severity | Description |
|------|----------|-------------|
| ~~No rate limiting on auth and public endpoints~~ | ~~High~~ | **Mitigated (July 2026).** Per-IP rate limits added to all auth and waitlist endpoints. |
| ~~Waitlist admin key in query string~~ | ~~High~~ | **Mitigated (July 2026).** Moved to `X-Admin-Key` header. |
| Single process / in-memory rate limiter | **Medium** | Multi-instance deployment would need a shared rate limiter (e.g. Redis). Current design assumes one Node process. |
| No per-user or per-tenant AI budget | **Medium** | Heavy AI usage can spike cost; no caps or quotas per user/tenant. |
| Services own all SQL | **Medium** | Harder to add caching, read replicas, or change DB without touching many services. |
| Unbounded list endpoints | **Medium** | Some list APIs (e.g. projects) use a fixed limit (1000) with no cursor; large tenants could hit performance and payload size issues. |
| JWT users have no scope checks | **Low** | Only API keys are scope-limited; JWT users get full access by role. May be intentional but limits least-privilege options. |
| No structured metrics/tracing | **Low** | Harder to diagnose production latency and AI cost without metrics and tracing. |

---

## 4. Recommended Improvements

| Recommendation | Rationale | Impact | Difficulty |
|----------------|-----------|--------|------------|
| Add rate limiting for auth and public routes | Prevents brute-force and DoS on login, register, forgot-password, waitlist. | Security and availability | Low |
| Move waitlist admin auth to header or JWT | Avoids secret in URL (logs, referrers, cache). | Security, compliance | Low |
| Add request duration and status to access logs | Enables latency and error rate analysis. | Observability | Low |
| Document and enforce pagination for list APIs | Use cursor or page/size and a max page size. | Performance, predictability | Medium |
| Introduce a thin repository layer for core entities | One place for SQL and mapping; easier to add caching or read replicas later. | Maintainability, scalability | High |
| Add per-user or per-tenant AI token/cost budget (config or DB) | Caps cost and abuse. | Cost control, fairness | Medium |
| Add a shared Redis (or similar) for rate limiting and optional job lock | Enables multi-instance and consistent rate limits. | Scalability, consistency | High |

---

## 5. Revised Architecture Diagram (ASCII)

Target state: same process layout, but with explicit rate limiting on all public/auth endpoints, optional Redis for rate limiting and agent lock, and clearer observability. No change to “one Fastify app + one DB + Claude + Stripe” core.

```
                    +-----------+
                    | LiteSpeed |  (static: HTML, CSS, JS)
                    +-----+-----+
                          |
              +-----------+-----------+
              |                       |
        /api/*, /mcp             static files
              |
     +--------v--------+
     |  Passenger (Node) |
     +--------+---------+
              |
     +--------v---------+
     |   Fastify Server  |
     |  - Rate limit     |  <- Global rate limit for /auth, /waitlist (new)
     |  - Auth (JWT+Key) |
     |  - Routes (v1)    |
     +--------+---------+
              |
    +---------+---------+----------+
    |         |         |          |
    v         v         v          v
  MySQL   Claude    Stripe    (Redis)   <- Optional: rate limit + agent lock
 (pool)   (AI)   (Billing)   (future)
```

**Changes from current:** Explicit “Rate limit” for unauthenticated and auth routes; optional Redis for multi-instance rate limiting and agent lock.

---

## 6. Phased Roadmap

**Now (critical / quick wins)** -- ALL DONE (July 2026)
- ~~Add rate limiting for `/api/v1/auth/*` (login, register, forgot-password, reset-password) and `/api/v1/waitlist` (POST and GET count).~~ Done: per-IP rate limits on all auth and waitlist endpoints.
- ~~Switch waitlist admin to a header or a dedicated admin JWT; remove `key` from query string.~~ Done: moved to `X-Admin-Key` header.
- ~~Add request duration and status code to the request logger (or to the response hook).~~ Done: `responseLogger` onResponse hook logs method, url, statusCode, durationMs, ip.

**Next (this/next sprint)** -- ALL DONE (July 2026)
- ~~Define pagination for list endpoints and enforce a max page size.~~ Done: shared `paginationSchema.ts` (limit 1-200, default 50, offset). Applied to projects, schedule tasks, sprints, and templates. Uses `PaginatedResponse<T>` wrapper.
- ~~Add optional per-user AI token/cost budget and check it in `claudeService`.~~ Done: migration 030 creates `ai_usage_log` table + `users.ai_monthly_token_budget` column. `AIBudgetService` checks monthly usage. `claudeService.complete/stream/completeToolLoop` enforce budget when `userId` provided. `GET /api/v1/ai/budget` returns usage. Fixed `aiUsageLogger` to use `databaseService`.
- ~~Add Zod validation for all request bodies and critical query params.~~ Done: Added Zod schemas to 9 route files (users, bulk, sprints, timeEntries, aiChat, apiKeys, webhooks, intakeForms, goals). Coverage now 24/61 route files (39%).

**Later (strategic)**
- ~~Introduce a small repository layer for 2–3 core entities (e.g. projects, users) and move SQL there; keep services as orchestrators.~~ Done (July 2026): `BaseRepository` + `ProjectRepository`, `UserRepository`, `ScheduleRepository`. Services delegate data access to repositories and keep business logic (audit logging, policy checks, workflow triggers).
- If multi-instance is required: introduce Redis (or similar) for rate limiting and for agent/scheduler locking; move rate limiter and optional job state there.
- ~~Add structured metrics (e.g. request count, latency histogram, AI token usage) and optional tracing (e.g. request ID through logs and services).~~ Done (July 2026): `MetricsService` (in-memory counters, latency percentiles, AI token usage, DB query count). `AsyncLocalStorage`-based request context propagates request ID through all async operations. Winston logger includes `requestId` in all log entries. `GET /api/v1/metrics` (admin-only) returns metrics snapshot.

---

*End of audit.*
