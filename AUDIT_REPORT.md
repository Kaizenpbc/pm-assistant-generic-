# Complete System Code Audit Report

**Date:** 2026-07-12
**Scope:** Full codebase (~120K lines, 946 files, including MCP server)
**Methodology:** 12-pass automated analysis covering security, auth, dead code, error handling, performance, type safety, API contracts, frontend, tests, config, dependencies, and architecture.

---

## Executive Summary

The PM Assistant codebase has a strong foundation — parameterized queries in most places, proper auth middleware coverage, structured logging, and a well-designed multi-tenant architecture. However, this audit identified **137 findings** across 12 categories, including:

### Top 10 Critical Findings

| # | Severity | Category | Finding | File |
|---|---|---|---|---|
| 1 | CRITICAL | SQL Injection | Unsanitized `sort`/`sortDir` in ORDER BY clause | `RiskRepository.ts:237` |
| 2 | CRITICAL | Performance | Recursive N+1 in `findAllDownstreamTasks` (N queries per task update) | `ScheduleService.ts:393` |
| 3 | CRITICAL | Performance | Unbounded `SELECT * FROM tasks` in overdue scan (96x/day) | `cronManager.ts:222` |
| 4 | CRITICAL | Performance | All embeddings loaded into heap on cache miss (12-120MB spike) | `EmbeddingService.ts:143` |
| 5 | CRITICAL | API Contract | `GET /sprints/:id` returns 200 with null instead of 404 | `sprints.ts` |
| 6 | HIGH | Auth | Any user can create `admin`-scoped API keys (privilege escalation) | `apiKeys.ts:10` |
| 7 | HIGH | Security | Meeting transcript passed to Claude without sanitization | `MeetingIntelligenceService.ts:121` |
| 8 | HIGH | Security | Timing-unsafe string comparison for waitlist admin key | `waitlist.ts:58` |
| 9 | HIGH | Performance | Connection pool exhaustion risk in multi-tenant mode (10 conns) | `connection.ts:74` |
| 10 | HIGH | Type Safety | `JSON.parse` without try/catch in ApiKeyService crashes auth | `ApiKeyService.ts:48` |

### Severity Distribution

| Severity | Count |
|---|---|
| Critical | 8 |
| High | 45 |
| Medium | 55 |
| Low | 29 |

---

## Pass 1: Security Audit

### Critical

| # | Finding | File:Line | Fix |
|---|---|---|---|
| S1 | Unsanitized `sort`/`sortDir` in ORDER BY — direct SQL injection | `RiskRepository.ts:237-242` | Allowlist sort columns and directions |

### High

| # | Finding | File:Line | Fix |
|---|---|---|---|
| S2 | `orderBy` parameter interpolated raw in AuditLedgerRepository | `AuditLedgerRepository.ts:71` | Validate is 'ASC' or 'DESC' |
| S3 | `BaseRepository.queryPaginated` accepts caller-supplied `orderBy` string | `BaseRepository.ts:59` | Document restriction or accept typed enum |
| S4 | Timing-unsafe string comparison for waitlist admin key | `waitlist.ts:58` | Use `crypto.timingSafeEqual` + rate limit |
| S5 | Meeting transcript passed to Claude without `sanitizeForPrompt()` | `MeetingIntelligenceService.ts:121` | Wrap in XML `<user-data>` tags |
| S6 | What-if scenario description injected raw into userMessage | `whatIfScenarioService.ts:230` | Apply `sanitizeForPrompt()` |

### Medium

| # | Finding | File:Line | Fix |
|---|---|---|---|
| S7 | `WorkflowRepository` LIMIT from caller without numeric cast | `WorkflowRepository.ts:163` | Use parameterized `?` with bounded int |
| S8 | `EmbeddingRepository` LIMIT can be NaN | `EmbeddingRepository.ts:31` | Add `\|\| 100` fallback |
| S9 | EmailService interpolates unsanitized user data into HTML | `EmailService.ts:106-131` | HTML-encode all values |
| S10 | CORS permits all localhost origins on any port | `plugins.ts:225` | Restrict to dev port or `NODE_ENV=development` only |
| S11 | AutoRescheduleService passes unsanitized task names to AI | `AutoRescheduleService.ts:182` | Apply `sanitizeForPrompt()` |

### Low

| # | Finding | File:Line | Fix |
|---|---|---|---|
| S12 | Log date query param passed to `path.resolve` without validation | `logs.ts:29` | Regex validate YYYY-MM-DD format |
| S13 | File attachment `entityType`/`entityId` in path.join | `FileAttachmentService.ts:41` | Sanitize with regex allowlist |
| S14 | Alert webhook URL not SSRF-checked | `AlertService.ts:172` | Apply `isPrivateUrl()` |
| S15 | Stored mimeType reflected as Content-Type | `fileAttachments.ts:62` | Validate against safe allowlist |

---

## Pass 2: Authentication & Authorization

### High

| # | Finding | File:Line | Fix |
|---|---|---|---|
| A1 | Any authenticated user can create `admin`-scoped API keys | `apiKeys.ts:10` | Enforce scopes <= user's role scopes |

### Medium

| # | Finding | File:Line | Fix |
|---|---|---|---|
| A2 | Deactivated users remain authenticated via existing JWTs | `auth.ts` middleware | Check `isActive` on each request (cached) |
| A3 | Audit trail readable by any user for any project | `auditTrail.ts:26` | Add `requireProjectAccess('viewer')` |
| A4 | Project membership mutations lack project access check | `projectMembers.ts` | Add `requireProjectAccess('manager')` |
| A5 | RAID/Risk routes have no project membership enforcement | `risks.ts` | Add project access guards |
| A6 | Agent activity log readable for any project | `agentActivityLog.ts:13` | Add `requireProjectAccess('viewer')` |

### Low

| # | Finding | File:Line | Fix |
|---|---|---|---|
| A7 | Logout does not invalidate tokens server-side | `auth.ts:352` | Redis blacklist for refresh tokens |
| A8 | Refresh token: no `isActive` check, no rotation | `auth.ts:374` | Add check + implement rotation |
| A9 | Portal link update has no ownership check | `portal.ts:119` | Verify ownership before mutation |
| A10 | `PUT /me/accessibility` gated at read scope (should be write) | `users.ts:125` | Change to `requireScope('write')` |
| A11 | Adding RAID comments gated at read scope | `risks.ts:228` | Change to `requireScope('write')` |
| A12 | API key usage stats has no ownership filter | `apiKeys.ts:72` | Filter by userId |
| A13 | Alert routes expose all-projects data to any user | `alerts.ts:21` | Filter by user's accessible projects |
| A14 | Kill switch audit always records actor as 'unknown' | `killSwitch.ts:37` | Fix: `request.user?.userId` |
| A15 | Admin role check is inline function call — fragile pattern | `admin/*.ts` | Convert to preHandler middleware |

---

## Pass 3: Dead Code & Unused Exports

### Unused npm Dependencies (remove from package.json)

| Package | Type | Impact |
|---|---|---|
| `pino` + `pino-pretty` | Unused (Fastify bundles its own) | Medium |
| `esbuild` | Unused (Vite bundles internally) | Large binary |
| `vite` (root) | Duplicate of client dep | Medium |
| `@fastify/rate-limit` | Unused (custom rate limiter exists) | Medium |
| `@rollup/rollup-win32-x64-msvc` | Platform artifact, wrong section | Medium |
| `@types/ioredis` | Redundant (ioredis v5 ships types) | Small |
| `@types/node-cron` | Redundant (node-cron ships types) | Small |

### Dead/Orphan Files

| File | Lines | Reason |
|---|---|---|
| `src/server/services/auditService.ts` | ~100 | Superseded by AuditLedgerService |
| `src/client/src/components/accessibility/ReadingLevelBadge.tsx` | ~31 | Never imported |
| `src/client/src/components/lessons/MitigationSuggestions.tsx` | ~60 | Never imported |
| `src/client/src/components/notifications/AlertActionButton.tsx` | ? | Never imported |

### Dead Exports (~180 lines removable)

- `src/server/dto/responses.ts`: `toScheduleDTO`, `toTaskDTO`, `toResourceDTO`, `toUserDTO`, `ErrorResponse` (~110 lines)
- `src/server/utils/caseConverter.ts`: `snakeToCamel` (internal-only use)
- `src/server/utils/constants.ts`: `MS_PER_HOUR`
- `src/server/services/aiUsageLogger.ts`: `calculateCost` (internal-only)
- `src/server/services/RecurrenceService.ts`: `parseRecurrenceRule`, `getNextOccurrence` (internal-only)
- `package.json` scripts: `db:migrate`, `db:seed` (reference non-existent files)

---

## Pass 4: Error Handling & Resilience

### Critical

| # | Finding | File:Line | Fix |
|---|---|---|---|
| E1 | `alertRoutes` GET handlers — no try/catch, DB errors bubble unlogged | `alerts.ts:27-57` | Add try/catch |

### High

| # | Finding | File:Line | Fix |
|---|---|---|---|
| E2 | `agentHealthRoutes` — bare Promise.all, no try/catch | `agentHealth.ts:17-48` | Add try/catch or Promise.allSettled |
| E3 | `briefingRoutes` — no try/catch | `briefing.ts:9` | Add try/catch |
| E4 | `agentMemoryRoutes` — all 4 handlers missing try/catch | `memory.ts:15-127` | Add try/catch |
| E5 | `bulk.ts` — partial-success in transaction returns rolled-back IDs | `bulk.ts:75-106` | Use allSettled outside transaction |

### Medium

| # | Finding | File:Line | Fix |
|---|---|---|---|
| E6 | `killSwitch.ts` — wrong userId path (`request.userId` vs `request.user?.userId`) | `killSwitch.ts:37,54,71` | Fix property path |
| E7 | `unhandledRejection` handler does not exit process | `index.ts:94-96` | Add `process.exit(1)` |
| E8 | `operations.ts` silent catch blocks hide DB failures | `operations.ts:187,216` | Log at warn level |
| E9 | `proposals.ts`, `autonomy.ts` GET handlers — no try/catch | Multiple | Add try/catch |
| E10 | `throw error` in catch blocks bypasses app-level logging | `proposals.ts:75,101,159` | Log + return 500 |

---

## Pass 5: Performance & Database

### Critical

| # | Finding | File:Line | Impact | Fix |
|---|---|---|---|---|
| P1 | Recursive N+1 in `findAllDownstreamTasks` | `ScheduleService.ts:393` | N queries per task update | Replace with recursive CTE |
| P2 | Unbounded `SELECT * FROM tasks` in overdue scan | `cronManager.ts:222` | Full table 96x/day | Add LIMIT + column projection |
| P3 | All embeddings loaded into heap on cache miss | `EmbeddingService.ts:143` | 12-120MB spike | Invalidate only affected doc type |

### High

| # | Finding | File:Line | Impact | Fix |
|---|---|---|---|---|
| P4 | Triple N+1 per recurrence template | `RecurrenceService.ts:80` | 550+ queries/day | Batch lookups |
| P5 | Per-task `findTaskById` in overdue loop | `cronManager.ts:236` | N lookups/scan | Use already-fetched data |
| P6 | 1 connection per query() in multi-tenant mode | `connection.ts:74` | Pool exhaustion | Increase pool / batch queries |
| P7 | Raw `getConnection()` exposed without release guarantee | `ActionProposalRepository.ts:204` | Connection leak | Wrap in try/finally or transaction() |
| P8 | `findAll()` loads entire project table for admins | `aiContextBuilder.ts:133` | Unbounded memory | Limit to active projects |
| P9 | No index on `agent_autonomy_config.disabled_at` | Migration 003 | Full scan per check | Add index |
| P10 | No index on `tasks.recurrence_parent_id` | Missing | Full scan in recurrence | Add index |

### Medium

| # | Finding | File:Line | Fix |
|---|---|---|---|
| P11 | Sequential per-project health snapshots | `healthSnapshotJob.ts:25` | Use parallelLimit |
| P12 | Per-user 3x queries in digest loop | `DigestService.ts:15` | Batch with IN clause |
| P13 | `workflow_definitions.is_enabled` not indexed, queried per task change | `WorkflowRepository.ts:51` | Add index + cache |
| P14 | `cascadeReschedule` — 1 UPDATE per downstream task | `ScheduleService.ts:843` | Batch updates |

---

## Pass 6: Type Safety

### Summary: 881 total `any` usages across 231 files

### Critical (Runtime Crash Risk)

| # | Finding | File:Line | Fix |
|---|---|---|---|
| T1 | `JSON.parse(row.scopes)` without try/catch — crashes auth | `ApiKeyService.ts:48,78` | Wrap in try/catch |
| T2 | `JSON.parse(row.proposal_data)` without try/catch | `AutoRescheduleService.ts:25` | Wrap in try/catch |
| T3 | `JSON.parse(row.new_value)` without try/catch | `ActionProposalService.ts:128` | Wrap in try/catch |
| T4 | Non-null Map lookups on dependency IDs that may not exist | `CriticalPathService.ts:46`, `MonteCarloService.ts:97` | Add guard |

### High

| # | Finding | File:Line | Fix |
|---|---|---|---|
| T5 | `IntegrationService` — 10x `config as any` casts | `IntegrationService.ts:68-143` | Discriminated union |
| T6 | `JSON.parse(entry.payload)` in DeadLetterService (crashes retry) | `DeadLetterService.ts:46,91` | Wrap in try/catch |
| T7 | `JSON.parse(row.events)` in WebhookRepository | `WebhookRepository.ts:21` | Wrap in try/catch |
| T8 | Top 10 files with most `any`: ProjectDetailPage(46), ReportBuilder(20), ScheduleService(15), KPIDrillIn(17) | Various | Type properly |

### Medium

| # | Finding | File:Line | Fix |
|---|---|---|---|
| T9 | All `rowToX(row: any)` mapper functions (50+ sites) | Various | Change to `Record<string, unknown>` |
| T10 | `const result: any` for DML results | Various | Use `ResultSetHeader` type |
| T11 | Client has no shared API types — each page re-invents interfaces | `src/client/src/pages/*` | Create `types/api.ts` |
| T12 | Agent confidence factors type mismatch (11 double-casts) | Agent files | Align types |

---

## Pass 7: API Contract Consistency

### Critical

| # | Finding | File:Line | Fix |
|---|---|---|---|
| C1 | `GET /sprints/:id` returns 200 with null instead of 404 | `sprints.ts` | Add null check + 404 |

### High (22 findings — grouped)

| Category | Count | Examples | Fix |
|---|---|---|---|
| Missing 201 on POST endpoints | 9 | sprints, workflows, change-requests, intake, integrations, webhooks, apiKeys, report-templates | Add `reply.status(201)` |
| Missing 404 on GET endpoints | 5 | sprints (x3), intake forms (x2), integrations | Add null check |
| Missing pagination | 3 | risks, notifications, admin/users | Add `parsePagination()` |
| Missing Zod validation on POST | 3 | sprints tasks, rag search, custom fields | Add Zod schemas |
| Response shape inconsistency | 2 | `PATCH /projects/:id/status` raw (no DTO), admin routes expose snake_case | Apply DTOs |

### Medium (22 findings — key ones)

- 3 different response wrapper patterns (`{ data }`, `{ resource }`, raw object)
- 12 DELETE endpoints returning inconsistent shapes
- Zod validation error format varies across routes
- 6 additional unbounded GET list endpoints
- Briefing route has no try/catch and no wrapper

---

## Pass 8: Frontend Code Quality

### Critical

| # | Finding | File | Fix |
|---|---|---|---|
| F1 | `GanttChart.tsx` — 3,634 lines, 22 useEffects | `GanttChart.tsx` | Decompose into 5+ sub-components |
| F2 | `ProjectDetailPage.tsx` — 4,093 lines with inline sub-components | `ProjectDetailPage.tsx` | Extract modals and tab content |

### High

| # | Finding | File:Line | Fix |
|---|---|---|---|
| F3 | `SettingsPage handleSave` is a no-op — no API call made | `SettingsPage.tsx:136` | Wire to actual API mutation |
| F4 | Single top-level ErrorBoundary for entire app | `App.tsx:95` | Add per-route boundaries |
| F5 | `<div onClick>` accordion with no keyboard support | `GoalsPage.tsx:280` | Add role, tabIndex, onKeyDown |
| F6 | Multiple `setTimeout` without cleanup (memory leak) | Various | Use useRef + cleanup |

### Medium

| # | Finding | File:Line | Fix |
|---|---|---|---|
| F7 | Raw `fetch()` calls bypassing apiService | `WaitlistAdminPage.tsx:20` | Use useMutation |
| F8 | Second independent WebSocket connection, no reconnect | `NotificationBell.tsx:183` | Share from useWebSocket hook |
| F9 | `'kovarti.com'` hardcoded domain in source | `App.tsx:13` | Use env var |
| F10 | `import * as XLSX` (~250KB gzipped) loaded statically | `ProjectDetailPage.tsx:67` | Dynamic import |
| F11 | No skip-navigation link for accessibility | `AppLayout.tsx` | Add sr-only skip link |
| F12 | Hardcoded SVG chart dimensions (not responsive) | Multiple chart components | Use viewBox/ResizeObserver |

---

## Pass 9: Test Coverage Gaps

### Overall Coverage Estimate: 30-40%

| Layer | Coverage |
|---|---|
| Middleware | ~85% |
| Agent services | ~65% |
| Core services | ~50% |
| MCP permissions | ~90% |
| Utils | ~80% |
| Database repositories (46 repos) | ~5% |
| Auth routes | 0% |
| claudeService | 0% |
| StripeService | 0% |
| EmailService | 0% |
| Frontend (all React) | 0% |
| Multi-tenant isolation | 0% |
| Route integration tests | 0% |

### Critical Untested Paths

1. **Authentication flow** — login, register, token refresh, password reset
2. **StripeService** — webhook signature verification, subscription management
3. **claudeService** — budget enforcement, fallback model, timeout behavior
4. **Multi-tenant isolation** — no test verifies data doesn't leak between tenants
5. **Route middleware wiring** — no integration test confirms routes register auth correctly

---

## Pass 10-11: Configuration & Dependencies

### Critical

| # | Finding | Fix |
|---|---|---|
| CD1 | No `.env.example` at repository root — 55+ env vars undocumented | Create `.env.example` |

### High

| # | Finding | Fix |
|---|---|---|
| CD2 | `pino` + `winston` both installed — duplicate logging stacks | Remove one |
| CD3 | `AI_MONTHLY_BUDGET` (operations.ts) vs `AI_MONTHLY_TOKEN_BUDGET` (config.ts) — different names, different units | Fix var name in operations.ts |
| CD4 | `esbuild`, `vite`, `@rollup/rollup-win32-x64-msvc` in dependencies instead of devDependencies | Move to devDependencies |

### Medium

| # | Finding | Fix |
|---|---|---|
| CD5 | MCP server reads DB_PASSWORD directly with no validation | Add config validation |
| CD6 | DB connection pool size (10) hardcoded — not configurable | Add `DB_POOL_SIZE` env var |
| CD7 | 4 infrastructure cron schedules hardcoded | Make configurable |
| CD8 | `zod` v3 in mcp-server vs v4 in main | Align versions |
| CD9 | `xlsx@0.18.5` in client — unmaintained, ~1.4MB | Evaluate alternatives |

---

## Pass 12: Architecture & Patterns

### Critical

| # | Finding | Fix |
|---|---|---|
| AR1 | `predictiveIntelligence.ts` pure math functions imported by 7 consumers | Extract to utility module |
| AR2 | No `TaskRepository` — 16 direct DB calls in ScheduleService | Create TaskRepository |

### High

| # | Finding | Fix |
|---|---|---|
| AR3 | Admin routes duplicate `requireAdmin()` inline in 5 files | Extract shared middleware |
| AR4 | `ADMIN_ONLY_TOOLS` defined but never referenced in permissions.ts | Remove or wire up |
| AR5 | Migration gap 048/049 | Document in migrationRunner.ts |
| AR6 | `AgentMemoryService` bypasses repository layer (4 direct DB calls) | Create AgentMemoryRepository |

### Medium

| # | Finding | Fix |
|---|---|---|
| AR7 | `get-evm-forecast` double-listed in MCP permissions | Remove from one list |
| AR8 | `Task` type imported from ScheduleService creates coupling | Extract to shared types |
| AR9 | `aiTaskBreakdown.ts` abstraction has one implementation | Collapse files |
| AR10 | `crossProjectIntelligenceService.ts` functionally duplicates the agent | Document or remove |

---

## Prioritized Fix Roadmap

### Batch 1: Critical Security & Data (fix immediately)

| # | Fix | Effort | Files |
|---|---|---|---|
| 1 | Allowlist sort columns in RiskRepository ORDER BY | S | `RiskRepository.ts` |
| 2 | Restrict API key scope creation to user's own role scopes | S | `apiKeys.ts` |
| 3 | Apply `sanitizeForPrompt()` to meeting transcript and what-if scenario | S | `MeetingIntelligenceService.ts`, `whatIfScenarioService.ts` |
| 4 | Wrap `JSON.parse` in try/catch in ApiKeyService, AutoReschedule, ActionProposal, DeadLetter | S | 4 files |
| 5 | Use `crypto.timingSafeEqual` for waitlist admin key | S | `waitlist.ts` |
| 6 | Fix `killSwitch.ts` userId: `request.user?.userId` | S | `killSwitch.ts` |

### Batch 2: High-Priority Performance & Auth (fix this week)

| # | Fix | Effort | Files |
|---|---|---|---|
| 7 | Replace recursive `findAllDownstreamTasks` with CTE query | M | `ScheduleService.ts` |
| 8 | Add LIMIT + column projection to overdue scan | S | `cronManager.ts` |
| 9 | Fix embedding cache invalidation (only affected doc type) | S | `EmbeddingService.ts` |
| 10 | Add `requireProjectAccess` to audit trail, RAID, agent log routes | S | 4 route files |
| 11 | Add `isActive` check to auth middleware (Redis-cached) | M | `auth.ts`, `RedisService.ts` |
| 12 | Add missing indexes (recurrence_parent_id, disabled_at, is_enabled) | S | New migration |
| 13 | Add null checks + 404 responses to sprint, intake, integration GETs | S | 4 route files |
| 14 | Change 9 POST endpoints to return 201 | S | 9 route files |
| 15 | Add try/catch to ~10 route handlers missing it | S | 6 route files |

### Batch 3: Medium-Priority Cleanup (fix this sprint)

| # | Fix | Effort | Files |
|---|---|---|---|
| 16 | Create `.env.example` with all 55+ env vars documented | M | New file |
| 17 | Remove unused npm deps (pino, esbuild, vite root, @fastify/rate-limit) | S | `package.json` |
| 18 | Move build tools to devDependencies | S | `package.json` |
| 19 | Fix `AI_MONTHLY_BUDGET` var name in operations.ts | S | `operations.ts` |
| 20 | HTML-encode values in EmailService templates | S | `EmailService.ts` |
| 21 | Fix SettingsPage no-op save button | S | `SettingsPage.tsx` |
| 22 | Add Zod schemas to unvalidated POST endpoints | M | 4 route files |
| 23 | Restrict localhost CORS to dev port only | S | `plugins.ts` |
| 24 | Batch recurrence queries (eliminate triple N+1) | M | `RecurrenceService.ts` |
| 25 | Add `process.exit(1)` to unhandledRejection handler | S | `index.ts` |

### Batch 4: Technical Debt (plan into roadmap)

| # | Fix | Effort | Files |
|---|---|---|---|
| 26 | Remove duplicate logging stack (pino vs winston) | M | `package.json`, `plugins.ts`, `logger.ts` |
| 27 | Extract TaskRepository from ScheduleService | L | New file + `ScheduleService.ts` |
| 28 | Decompose GanttChart.tsx (3634 lines) | L | Multiple new files |
| 29 | Decompose ProjectDetailPage.tsx (4093 lines) | L | Multiple new files |
| 30 | Add per-route ErrorBoundaries in frontend | M | `App.tsx` + wrappers |
| 31 | Create shared client API types | M | New `types/api.ts` |
| 32 | Add auth route integration tests | M | New test files |
| 33 | Add multi-tenant isolation tests | M | New test files |
| 34 | Add frontend test infrastructure | L | Multiple files |
| 35 | Standardize API response shapes | L | All route files |

---

## Quick Wins (< 30 minutes each)

1. Allowlist sort columns in `RiskRepository.ts` (5 min)
2. Fix `killSwitch.ts` userId path (2 min)
3. `crypto.timingSafeEqual` in `waitlist.ts` (5 min)
4. Wrap 4x `JSON.parse` in try/catch (10 min)
5. Add `reply.status(201)` to 9 POST endpoints (10 min)
6. Add null checks + 404 to 5 GET endpoints (10 min)
7. Remove 5 unused npm dependencies (5 min)
8. Move `esbuild`/`vite`/`@rollup` to devDependencies (2 min)
9. Fix `AI_MONTHLY_BUDGET` env var name in operations.ts (2 min)
10. Restrict CORS localhost to port 5173 only (3 min)
11. Add `process.exit(1)` to unhandledRejection (1 min)
12. Fix `handleSave` no-op in SettingsPage (5 min)
13. Change `requireScope('read')` to `'write'` on 2 mutation routes (2 min)
14. Add `requireProjectAccess('viewer')` to audit trail route (3 min)
15. Apply `sanitizeForPrompt()` to 2 AI service inputs (5 min)

---

## Conclusion

The codebase is architecturally sound with good security foundations. The critical issues are concentrated in:
1. **One SQL injection** (sort params) — immediate fix required
2. **One privilege escalation** (API key scopes) — immediate fix required
3. **Performance time bombs** (recursive N+1, unbounded scans) — fix before scale
4. **Missing auth guards** on ~6 routes — fix before multi-tenant go-live

Batch 1 (critical security) can be completed in under 2 hours. Batch 2 (high-priority) in 1-2 days. The codebase is production-ready for single-tenant use today, but Batches 1-2 should be completed before enabling multi-tenant mode.
