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

## Item 14: Migration Rollback Runner

**Current state:** Migrations are one-way SQL files (`NNN_descriptive_name.sql`). No reverse migration generator, no dry-run mode. Rollback requires manually writing and running reverse SQL via SSH.

**What's needed:**
- Reverse migration files (e.g., `NNN_descriptive_name.down.sql`) alongside forward migrations
- A `rollback` command that reads the `_migrations` table and applies the corresponding `.down.sql`
- `--dry-run` mode that shows what would be rolled back without executing
- Guard against rolling back migrations that have dependent forward migrations applied after them

**Priority:** Medium — manual rollback works but is error-prone under pressure.

---

## Item 15: External Alerting / Distributed Tracing

**Current state:** Good local observability (Winston logs with requestId, MetricsService with counters/latency percentiles, admin `/api/v1/metrics` endpoint). No external alerting when metrics cross thresholds, no distributed tracing.

**What's needed:**
- Webhook or email alerts when error rate spikes, AI budget nears limit, or circuit breaker opens
- Optional integration with external monitoring (e.g., Sentry, Datadog, or simple webhook to Slack/email)
- Trace IDs propagated to external services for correlation

**Priority:** Low — current logging and metrics are sufficient for single-instance deployment. Becomes important if scaling or if uptime SLAs tighten.

---

## Unblocking Path

1. Request Redis addon from TMD Hosting, or
2. Migrate to a VPS/container hosting plan with Redis support

**Status:** Upgrade requested from TMD Hosting (as of March 2026). No response yet.
