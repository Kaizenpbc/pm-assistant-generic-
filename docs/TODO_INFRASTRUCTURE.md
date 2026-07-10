# Infrastructure-Blocked TODO Items

These architecture audit items are blocked by infrastructure constraints on TMD Hosting (shared plan, no Redis, no external job runner).

---

## Item 11: Redis Rate Limiter + Metrics Store

**Current state:** In-memory rate limiter (`RateLimitService`) and `MetricsService` singleton. Works for single-instance deployment but prevents horizontal scaling.

**What Redis enables:**
- Shared rate limiting across multiple Node instances
- Persistent metrics store (survives process restarts)
- Distributed circuit breaker state

**When unblocked:** Replace in-memory stores with Redis-backed implementations. No API changes needed -- same interfaces, different backing store.

---

## Item 12: Repository Caching Layer

**Current state:** Repository pattern covers 8 entities (Project, User, Schedule, Sprint, ApprovalWorkflow, IntakeForm, Resource, Integration). All SQL centralized in repository classes.

**What Redis enables:**
- Read-through cache on `findById()` / `findByProject()` calls
- Cache invalidation on writes (update/delete)
- TTL-based expiry for list queries

**When unblocked:** Add a `CachedRepository<T>` wrapper or mixin that checks Redis before hitting MySQL. Apply to high-read entities (Project, Sprint, Resource).

---

## Item 13: External Cron Scheduler

**Current state:** 5 in-process cron jobs via `node-cron` (agent scan, overdue scan, recurrence, digest emails, report delivery). If the Node process crashes, all stop. If multiple instances run, jobs execute in duplicate.

**What's needed:** An external job runner (e.g., BullMQ + Redis, or a cPanel cron hitting an API endpoint).

**When unblocked:** Move job definitions to external scheduler. Keep job logic in existing services -- just change the trigger mechanism.

---

## ~~Item 14: Migration Rollback Runner~~ — DONE (July 2026)

**Implemented:** `migrationRunner.ts` now exports `rollbackMigrations(count, dryRun)`, `dryRunMigrations()`, and `listMigrations()`. CLI via `migrateCli.ts`:
- `run` — apply pending migrations (existing behavior)
- `run --dry-run` — preview pending migrations without executing
- `rollback [N]` — rollback last N migrations using `.down.sql` files
- `rollback --dry-run` — preview what would be rolled back
- `list` — show all migrations with applied/pending status and rollback availability

Rollback files use convention `NNN_name.down.sql` alongside `NNN_name.sql`. Forward runner excludes `.down.sql` files.

---

## Item 14b: Portal Rate Limiting

**Current state:** Public portal endpoints (`GET /portal/view/:token`, `POST /portal/view/:token/comment`) have no rate limiting. Any user with a valid token can call them without restriction.

**What's needed:**
- Per-IP rate limit on `GET /portal/view/:token` (e.g., 60 req/min) to prevent scraping
- Per-IP rate limit on `POST /portal/view/:token/comment` (e.g., 5 req/min) to prevent comment spam
- Can use existing in-memory `RateLimitService` for single-instance deployment; upgrade to Redis-backed when available

**Priority:** Low while in development. Should be added before exposing portal links to untrusted external users.

---

## Item 15: External Alerting / Distributed Tracing

**Current state:** Good local observability (Winston logs with requestId, MetricsService with counters/latency percentiles, admin `/api/v1/metrics` endpoint). No external alerting when metrics cross thresholds, no distributed tracing.

**What's needed:**
- Webhook or email alerts when error rate spikes, AI budget nears limit, or circuit breaker opens
- Optional integration with external monitoring (e.g., Sentry, Datadog, or simple webhook to Slack/email)
- Trace IDs propagated to external services for correlation

**Priority:** Low — current logging and metrics are sufficient for single-instance deployment. Becomes important if scaling or if uptime SLAs tighten.

---

## Item 16: Dashboard Enhancements (UI)

**These items came from the dashboard wireframe discussion (July 2026). Not infrastructure-blocked — just scoped out of current sprint.**

### 16a: AI Next Best Actions Widget
Prescriptive action cards (3-5 per dashboard) with inline action buttons (e.g., "Approve budget CR for Project X", "Reassign overdue task"). Different from AgentProposalsWidget — these are opinionated recommendations, not raw proposals.

### 16b: Health Trends Sparklines Widget
3-column sparkline charts showing project health scores over time. **Requires backend work:**
- New `project_health_snapshots` table (project_id, score, date, captured_by cron)
- Daily cron job to snapshot health scores from predictions API
- New API endpoint: `GET /api/v1/projects/:id/health-history`

### 16c: Activity Feed + AI Summary Sidebar
Enhance `RecentActivityWidget` to 2-column layout: left = activity feed (existing), right = AI-generated summary of recent activity patterns.

### 16d: Dashboard Footer
Minor — version info, quick links, last refresh timestamp.

---

## Unblocking Path

1. Request Redis addon from TMD Hosting, or
2. Migrate to a VPS/container hosting plan with Redis support

**Status:** Upgrade requested from TMD Hosting (as of March 2026). No response yet.
