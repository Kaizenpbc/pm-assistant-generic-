# PM Assistant — Roadmap

Last updated: 2026-07-15

---

## Tier 1: Cleanup (Finish Methodology Feature) -- DONE

Completed 2026-07-14 in commit `6d5689c`.

| # | Item | Status |
|---|------|--------|
| 1 | Wire `getDefaultViewMode()` | Done -- agile projects open Kanban by default |
| 2 | Delete `getContextCardConfig()` | Done -- removed dead code |
| 3 | Unit tests for `methodology.ts` | Done -- 13 tests covering all 3 functions x 3 methodologies |
| 4 | Methodology badge on project cards | Done -- Agile/Hybrid pill badge on dashboard cards |

---

## Tier 2: Polish (Gaps in Existing Features) -- DONE

Completed 2026-07-14.

| # | Item | Status |
|---|------|--------|
| 5 | Methodology in MCP `get-project` response | Done -- verified: MCP resource calls `GET /projects/:id` which returns `toProjectDTO()` including methodology |
| 6 | Methodology in AI context | Done -- `aiContextBuilder` includes methodology in project context, portfolio context, and both prompt strings |
| 7 | Methodology in project exports | Done -- JSON export includes methodology field in project object |
| 8 | Readiness bar auto-dismiss | Done -- shows "All set!" banner when 5/5 complete, auto-dismisses after 3 seconds |

---

## Tier 3: New Features

New user-facing capabilities.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 9 | Sprint velocity widget on dashboard | Done -- sparkline chart per agile/hybrid project on PM dashboard, shows velocity trend + average + trend arrow. Toggleable via Customize dropdown. | Done |
| 10 | Backlog view | Done -- dedicated Backlog tab for agile/hybrid projects. Shows unassigned tasks with priority filter, bulk select, and assign-to-sprint. Backend endpoint `GET /sprints/backlog/:scheduleId`. | Done |
| 11 | Story points on Kanban cards | Done -- column point totals, total sprint points in header, WIP limits with localStorage persistence and amber warning ring. | Done |
| 12 | MariaDB 11.8 vector upgrade | Done -- Upgraded MariaDB 10.11→11.8.8 on Oracle Cloud. Embeddings column converted from JSON to BLOB (native vector storage). `EmbeddingRepository.searchSimilar()` uses `VEC_DISTANCE_COSINE()` + `VEC_FromText()` for SQL-level similarity search. In-memory cache removed. | Done |
| 13 | External Cron Scheduler (Audit Item 13) | Done -- All 8 cron jobs moved from in-process `node-cron` to systemd timers. Standalone runner `scripts/runCronJob.ts` executes any job by name. Jobs survive app restarts, have independent failure domains, and log to systemd journal. | Done |

---

## Tier 4: Strategic

Longer-term features that build on the methodology foundation.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 14 | Methodology-aware templates | Done -- each template has `defaultMethodology` (IT→agile, Cloud/ERP/Telecom→hybrid, Construction/Roads/Infra→waterfall). Form pre-selects it; user can override. | Done |
| 15 | Sprint retrospective AI | Done -- `POST /sprints/:id/retrospective` generates AI retrospective via Claude for completed sprints. BookOpen button on completed sprint cards. Inline display panel with dismiss. | Done |
| 16 | Cumulative flow diagram | Done -- `GET /sprints/:id/cumulative-flow` returns daily task status distribution. SVG stacked area chart (not_started / in_progress / completed) in Sprints tab "flow" view. | Done |
| 17 | Capacity planning for sprints | Done -- `GET /sprints/:id/capacity` returns recommended velocity based on historical average + team size. Confidence indicator (low/medium/high based on sprint count). "capacity" view in Sprints tab. | Done |
| 18 | Cross-project portfolio velocity | Done -- Portfolio aggregate row in VelocitySparklineWidget on PM dashboard. Aggregates velocity across all agile/hybrid projects with sparkline + trend arrow. | Done |

---

## Tier 5: Quality & Polish

Hardening, testing, and UX improvements.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 19 | CSP enforcement | Switch Helmet CSP from report-only to enforcing mode with proper allowlists for scripts, styles, fonts, API endpoints. | Small |
| 20 | E2E test suite | Playwright tests for critical flows: login, create project, add tasks, sprint planning, Kanban board. CI-ready. | Large |
| 21 | Accessibility audit | ARIA labels, keyboard navigation, focus management in modals, screen reader support, color contrast checks. | Medium |
| 22 | Drag-and-drop Kanban | Replace click-to-move with native HTML drag-and-drop on sprint board and schedule Kanban. Visual drop indicators. | Medium |
| 23 | Gantt dependency arrows | Visualize task dependencies as SVG arrows between bars on the Gantt chart. Click arrow to edit/remove dependency. | Medium |
| 24 | Notification preferences | Per-user settings for which notifications to receive (overdue, mentions, approvals, digests) and channel (email vs in-app). | Medium |

---

## Tier 6: Infrastructure & Performance

Server-side hardening and optimization.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 25 | API response compression | Enable gzip/brotli compression on Fastify API responses. Nginx handles static files but API JSON payloads are uncompressed. | Small |
| 26 | Database connection pool tuning | Profile and tune MariaDB pool size, idle timeout, and queue limits for the 1GB Oracle Cloud VM. | Small |
| 27 | Log rotation | Configure Winston file transport with daily rotation, max file size, and retention policy. Prevent unbounded log growth. | Small |
| 28 | Sprint goal tracking | Visual progress indicator on sprint cards showing goal completion based on linked task statuses. | Small |

---

## Tier 7: AI & Intelligence

AI-powered features building on Claude and RAG infrastructure.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 29 | RAG auto-indexing | Auto-index lessons and meetings on create/update instead of requiring manual backfill. Hook into service layer. | Small |
| 30 | AI task estimation | Use historical task data (estimated vs actual days by project type, category) to suggest estimated_days for new tasks via Claude. | Medium |

---

## Prioritization Notes

- **Tiers 1-4 are complete** — all 18 original items shipped on July 14, 2026.
- **Tier 5 before Tier 6** — user-facing quality improvements before infrastructure tuning.
- **Tier 6 items are small and independent** — can be knocked out quickly in any order.
- **Tier 7 builds on existing AI infrastructure** — RAG auto-indexing is low-hanging fruit; task estimation is more ambitious.
