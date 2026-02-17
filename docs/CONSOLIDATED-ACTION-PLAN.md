# Consolidated Architecture Action Plan
**PM Assistant Generic**
**Sources:** Internal code review (Claude Code) + External architecture review
**Date:** February 2025

---

## Executive Summary

Two independent architecture reviews reached the same conclusion: the application is a **well-built prototype** with strong middleware, clean layering, and solid AI orchestration — but it is **not production-ready**. The #1 blocker is that 20 of 25 core services store all domain data in static in-memory arrays, meaning every server restart causes total data loss.

This plan merges findings from both reviews into a single prioritized roadmap.

---

## Phase 1 — STABILIZE (Immediate / This Sprint)

> **Goal:** Fix security bugs and silent failures. All items are Low effort.

| # | Item | Source | Severity | What To Do |
|---|------|--------|----------|------------|
| 1.1 | Wire MySQL pool to Fastify instance | Internal | **High** | `(this.fastify as any).mysql` is always `undefined`. AI usage/feedback/accuracy logging silently fails. Add a Fastify plugin that decorates the instance with the DB pool from `connection.ts`. |
| 1.2 | Add RBAC to AIActionExecutor | Internal | **High** | `aiActionExecutor.ts` receives `userRole` in context but never checks it. Any authenticated user can delete any project/task via AI chat. Add role checks before mutating operations. |
| 1.3 | Remove hardcoded admin credentials | Internal | **High** | `UserService.ts` line 28 has a bcrypt hash for `admin123` in source code. Move seed user creation to `db:seed` script with env-based password. |
| 1.4 | Fix rate limiting behind reverse proxy | Internal | **High** | `allowList: ['127.0.0.1']` in `plugins.ts` disables rate limiting behind nginx/Docker. Remove the allowList entry, configure `trustProxy` properly. |
| 1.5 | Authenticate WebSocket connections | Internal | **Low** | `routes/websocket.ts` has no `authMiddleware`. Parse JWT from upgrade request cookie, reject unauthenticated connections. |
| 1.6 | Fix hardcoded streaming URL | Internal | **Low** | `api.ts` line 188 uses `http://localhost:3001` instead of `VITE_API_BASE_URL`. |
| 1.7 | Remove duplicate CORS handling | Internal | **Medium** | Both `@fastify/cors` plugin and `securityMiddleware.ts` set CORS headers. Remove manual CORS from `securityMiddleware` — let the plugin handle it. |
| 1.8 | Add CSRF protection | External | **High** | Cookie-based auth without CSRF tokens is vulnerable. Add `@fastify/csrf-protection` or implement double-submit cookie pattern. |

---

## Phase 2 — PERSIST (Next Sprint)

> **Goal:** Move from in-memory to persistent storage. This is the critical architectural shift.

| # | Item | Source | Severity | What To Do |
|---|------|--------|----------|------------|
| 2.1 | Add migration framework | Both | **Medium** | `db:migrate` script exists but no migration files. Adopt `knex` or `umzug` for schema management. Create initial migration for all domain tables. |
| 2.2 | Create Repository layer | Internal | **High** | Introduce `src/server/repositories/` with one repo per domain entity (ProjectRepo, ScheduleRepo, UserRepo, TaskRepo, ResourceRepo, etc.). Each repo wraps `databaseService.query()` with parameterized SQL. |
| 2.3 | Persist core domain data to MySQL | Both | **High** | Migrate the 17 in-memory `private static` services to use repositories. Tables needed: `users`, `projects`, `schedules`, `tasks`, `resources`, `resource_assignments`, `project_members`, `workflows`, `workflow_executions`, `templates`, `baselines`, `audit_events`, `lessons_learned`, `meeting_analyses`, `reschedule_proposals`, `comments`, `activities`. |
| 2.4 | Create seed script | Both | **Medium** | Move hardcoded seed data (3 projects, 5 resources, 10 templates, 1 admin user) into `db:seed` script. Generate admin password from env var. |
| 2.5 | Parameterize all SQL queries | External | **High** | Ensure every `databaseService.query()` call uses `?` placeholders. No string concatenation for SQL. |

---

## Phase 3 — HARDEN (Sprint +2)

> **Goal:** Type safety, cost control, pagination, observability foundations.

| # | Item | Source | Severity | What To Do |
|---|------|--------|----------|------------|
| 3.1 | Create shared types package | Both | **Medium** | Create `src/shared/types.ts` with domain models (User, Project, Schedule, Task, etc.). Configure both tsconfigs to resolve the shared path. |
| 3.2 | Add per-user AI budget limits | Internal | **Medium** | Track cumulative token usage per user. Enforce configurable daily/monthly limits in `aiChatService`. Return 429 when budget exceeded. |
| 3.3 | Add pagination to all list endpoints | Both | **Medium** | Add `limit`/`offset` (or cursor-based) pagination to service methods, routes, and frontend queries. No unbounded `findAll()`. |
| 3.4 | Add Zod validation to AI tool inputs | Internal | **Medium** | `AIActionExecutor` takes `Record<string, any>` from Claude's tool calls with no validation. Add Zod schemas for each tool's expected input. |
| 3.5 | Consolidate logging to pino | Internal | **Low** | Remove `winston` dependency. Use `fastify.log` (pino) everywhere. |
| 3.6 | Standardize ID generation | Internal | **Low** | Replace remaining `Math.random().toString(36)` with `crypto.randomUUID()` in all services. |
| 3.7 | Move esbuild to devDependencies | Internal | **Low** | `package.json` change — build tool shouldn't be a production dep. |
| 3.8 | Separate prompts from claudeService | Internal | **Low** | Create `src/server/prompts/` directory. Move prompt templates out of `claudeService.ts`. |
| 3.9 | Add password complexity + account lockout | External | **Medium** | Enforce minimum password requirements. Lock account after N failed login attempts. |

---

## Phase 4 — SCALE (Multi-Sprint / Strategic)

> **Goal:** Infrastructure for horizontal scaling, observability, and advanced AI.

| # | Item | Source | Effort | What To Do |
|---|------|--------|--------|------------|
| 4.1 | Add Redis | External | **High** | Use Redis for: session/rate-limit state (enables multi-instance), compute caching (Monte Carlo, CPM results), AI conversation memory persistence. |
| 4.2 | Type-safe API client | Internal | **High** | Generate typed client from Swagger spec, or adopt tRPC/zodios. Replace the 900-line untyped `api.ts`. |
| 4.3 | APM + metrics + tracing | Both | **Medium** | Add Prometheus metrics endpoint, request tracing (OpenTelemetry), health check that probes subsystems (DB, AI, Redis). |
| 4.4 | Compute worker processes | External | **Medium** | Move Monte Carlo simulation, CPM, S-Curve generation to background workers via a job queue (BullMQ + Redis). |
| 4.5 | AI streaming through WebSocket | Internal | **Medium** | Route Claude streamed responses through authenticated WebSocket instead of raw `fetch`. |
| 4.6 | Vector store for AI memory | External | **Medium** | Add semantic memory/RAG capability for AI features. Store project context embeddings for retrieval. |
| 4.7 | Multi-model AI routing | External | **Low/Med** | Abstract Claude dependency behind a model router. Support fallback to other models. Reduce vendor lock-in. |
| 4.8 | Graceful shutdown with drain | Internal | **Low** | Add request drain timeout before `process.exit` in SIGINT/SIGTERM handlers. |

---

## Phase 5 — ENTERPRISE (Long-Term)

> **Goal:** Multi-tenant, compliance, and enterprise features.

| # | Item | Source | Effort | What To Do |
|---|------|--------|--------|------------|
| 5.1 | Multi-tenant support | External | **High** | Tenant isolation at DB level (row-level or schema-per-tenant). |
| 5.2 | Distributed rate limiting | External | **Medium** | Move rate limiting to Redis (works across instances). |
| 5.3 | Full audit persistence + compliance | External | **Medium** | Persist all audit events to database. Add compliance logging, data retention policies. |
| 5.4 | Secrets rotation | External | **Medium** | Implement JWT secret rotation without invalidating active sessions. |
| 5.5 | AI evaluation pipeline | External | **Medium** | Automated testing of AI outputs for quality, safety, and accuracy. |
| 5.6 | AI guardrails for prompt injection | External | **Medium** | Beyond DOMPurify — add input/output filtering for LLM interactions. |

---

## Risk Matrix (Combined)

| Risk | Severity | Source | Phase to Address |
|------|----------|--------|-----------------|
| All domain data in-memory (lost on restart) | **HIGH** | Both | Phase 2 |
| No CSRF protection (cookie auth vulnerable) | **HIGH** | External | Phase 1 |
| No RBAC on AI tool execution | **HIGH** | Internal | Phase 1 |
| MySQL pool never wired (AI logging fails) | **HIGH** | Internal | Phase 1 |
| Hardcoded admin credentials in source | **HIGH** | Internal | Phase 1 |
| Rate limiting bypassed behind proxy | **HIGH** | Internal | Phase 1 |
| Raw SQL without parameterization | **HIGH** | External | Phase 2 |
| No horizontal scaling possible | **HIGH** | Both | Phase 2 + 4 |
| No shared types (FE/BE drift) | **MEDIUM** | Both | Phase 3 |
| No APM/metrics/observability | **MEDIUM** | Both | Phase 4 |
| No database migrations | **MEDIUM** | Both | Phase 2 |
| No pagination on list endpoints | **MEDIUM** | Both | Phase 3 |
| No per-user AI cost limits | **MEDIUM** | Internal | Phase 3 |
| AI conversation memory in RAM | **MEDIUM** | External | Phase 4 |
| Duplicate CORS handling | **MEDIUM** | Internal | Phase 1 |
| No compute task queueing | **LOW/MED** | External | Phase 4 |
| Tight coupling to Claude (vendor lock-in) | **LOW/MED** | External | Phase 4 |
| WebSocket unauthenticated | **LOW** | Internal | Phase 1 |
| Hardcoded streaming URL | **LOW** | Internal | Phase 1 |
| Two logging libraries (pino + winston) | **LOW** | Internal | Phase 3 |
| esbuild as production dependency | **LOW** | Internal | Phase 3 |
| No graceful shutdown drain | **LOW** | Internal | Phase 4 |

---

## Effort Estimates

| Phase | Items | Effort | Timeline |
|-------|-------|--------|----------|
| Phase 1 — Stabilize | 8 items | ~2-3 days | This sprint |
| Phase 2 — Persist | 5 items | ~2-3 weeks | Next sprint |
| Phase 3 — Harden | 9 items | ~1-2 weeks | Sprint +2 |
| Phase 4 — Scale | 8 items | ~4-6 weeks | Multi-sprint |
| Phase 5 — Enterprise | 6 items | ~8-12 weeks | Long-term |

---

## Current vs Target Architecture

### Current
```
React SPA → Axios → Fastify → Services (static arrays in RAM) → MySQL (optional, AI only)
                                    ↓
                              Claude API (tool loop)
```

### Target (Phase 4 complete)
```
React SPA → Typed API Client → Fastify (CSRF + Auth + RBAC)
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
              Core Services   AI Orchestration  Compute Workers
              (stateless)     (model-agnostic)  (BullMQ + Redis)
                    ↓               ↓               ↓
              Repositories    Vector Store      Redis Queue
              (parameterized SQL)                    ↓
                    ↓                          Observability
                  MySQL                        (Prometheus/OTel)
              (all domain data + migrations)
```

---

## Files Referenced

### Critical files to modify in Phase 1:
- `src/server/plugins.ts` — rate limit allowList, MySQL decoration
- `src/server/services/aiActionExecutor.ts` — RBAC checks
- `src/server/services/UserService.ts` — remove hardcoded credentials
- `src/server/routes/websocket.ts` — add authMiddleware
- `src/server/middleware/securityMiddleware.ts` — remove CORS duplication
- `src/client/src/services/api.ts` — fix streaming URL

### New files/directories needed in Phase 2:
- `src/server/repositories/` — ProjectRepo, ScheduleRepo, UserRepo, TaskRepo, etc.
- `src/server/database/migrations/` — SQL migration files
- `src/server/database/seeds/` — Seed data scripts

### New files/directories needed in Phase 3:
- `src/shared/types.ts` — Domain models shared between FE/BE
- `src/server/prompts/` — AI prompt templates
