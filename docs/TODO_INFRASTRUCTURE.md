# Infrastructure TODO Items

Items from the architecture audit. Most were previously blocked by TMD shared hosting — resolved after migration to Oracle Cloud (July 2026).

---

## ~~Item 11: Redis Rate Limiter + Metrics Store~~ — DONE (July 2026)

**Implemented:** Redis installed on Oracle Cloud (`redis-server`, systemd-managed). `ioredis` package added.
- **RedisService** (`src/server/services/RedisService.ts`) — singleton with graceful fallback. All methods return safe defaults when disconnected.
- **RateLimiter** upgraded with `checkAsync()` method — uses Redis `INCR`/`EXPIRE` when connected, falls back to in-memory. Portal routes migrated to `checkAsync`.
- **MetricsService** upgraded with `startRedisSync()` / `loadFromRedis()` — persists aggregate counters to Redis every 30s (key: `metrics:snapshot`, 24h TTL). Counters survive process restarts.
- **Config:** `REDIS_URL` env var (default: empty = disabled). Set to `redis://localhost:6379` on server.
- **Boot:** `index.ts` connects Redis before plugins, loads metrics, starts sync interval. Shutdown disconnects cleanly.

---

## ~~Item 12: Repository Caching Layer~~ — DONE (July 2026)

**Implemented:** `CachedRepository<T>` wrapper (`src/server/database/CachedRepository.ts`) — generic read-through cache with Redis backing.
- `findById()` checks Redis first (key: `cache:<prefix>:<id>`), falls through to DB on miss, stores result with TTL
- `invalidate(id)` deletes cache entry on write
- Applied to `ProjectService` — `findById()` uses cached path (5-min TTL), `update()` and `delete()` invalidate
- Graceful fallback: when Redis is disconnected, all calls pass through directly to the repository
- Extensible: wrap any repository with `new CachedRepository(repo, { prefix, ttlSeconds })` to add caching

---

## Item 13: External Cron Scheduler

**Current state:** 5 in-process cron jobs via `node-cron` (agent scan, overdue scan, recurrence, digest emails, report delivery). If the Node process crashes, all stop. If multiple instances run, jobs execute in duplicate.

**What's needed:** An external job runner (e.g., BullMQ + Redis, or systemd timers hitting API endpoints).

**When ready:** Move job definitions to external scheduler. Keep job logic in existing services — just change the trigger mechanism.

**Priority:** Low — single-process deployment with systemd auto-restart is reliable enough. Becomes important if scaling to multiple instances.

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

## ~~Item 14b: Portal Rate Limiting~~ — DONE (July 2026)

**Implemented:** Per-IP rate limiting on public portal routes using `rateLimiter.checkAsync()` (Redis-backed when available, in-memory fallback):
- `GET /portal/view/:token` — 60 req/min per IP
- `POST /portal/view/:token/comment` — 5 req/min per IP
- Returns `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers; 429 with `retryAfterMs` on excess

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

**These items came from the dashboard wireframe discussion (July 2026).**

### ~~16a: AI Next Best Actions Widget~~ — DONE (July 2026)
Implemented as `NextBestActionsWidget` + inline `AINextBestActions` in `ActionCenterPM`. Aggregates pending proposals, high-severity notifications, and low-health projects into prioritized action cards. Wired into PM Dashboard.

### ~~16b: Health Trends Sparklines Widget~~ — DONE (July 2026)
Implemented as `HealthTrendsWidget` with SVG sparklines. Backend: `project_health_history` table (migration 038), daily snapshot cron (`healthSnapshotJob.ts`), `GET /api/v1/predictions/project/:id/health-history` endpoint. Wired into PM Dashboard.

### ~~16c: Activity Feed + AI Summary Sidebar~~ — SKIPPED (July 2026)
Redundant — dashboard already has `AISummaryBanner` (portfolio AI insights) and `ActionCenterPM` (priorities + AI next best actions) covering this use case.

### ~~16d: Dashboard Footer~~ — DONE (July 2026)
Last-refreshed timestamp and version label added to PM Dashboard.

---

## Remaining Open Items

| # | Item | Status | Blocker |
|---|------|--------|---------|
| 13 | External Cron Scheduler | Open | None (low priority) |
| 15 | External Alerting | Open | None (low priority) |
