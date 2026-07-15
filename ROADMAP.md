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
| 19 | CSP enforcement | Done -- Nginx CSP header on all static pages with SHA256 hash for gtag inline script (no `unsafe-inline` for scripts). Helmet CSP tightened: added worker-src, manifest-src, base-uri, form-action, frame-ancestors. Additional headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. | Done |
| 20 | E2E test suite | Done -- Playwright tests for 5 critical flows: auth (login, invalid creds, redirect, password toggle), project CRUD (navigate, create blank project, view detail), task management (add task from schedule tab), sprint planning (sprints tab, board view), navigation (dashboard, sidebar, 404). Config at `playwright.config.ts`, tests in `e2e/`. Run with `npm run test:e2e`. | Done |
| 21 | Accessibility audit | Done -- `useModal` hook with focus trap, Escape-to-close, focus restoration. `AccessibleModal` wrapper component. Applied to all 11 modal components. Added `aria-label` to ~15 icon-only buttons. Added `aria-label` to ~10 unlabelled form inputs. Skip-to-content link. `aria-live` region for screen reader announcements. `role="button"` + keyboard handlers on clickable divs. `aria-hidden` on decorative SVGs. | Done |
| 22 | Drag-and-drop Kanban | Done -- Both `SprintBoard.tsx` and `KanbanBoard.tsx` use native HTML5 DnD API with `draggable` cards, `onDragStart`/`onDragOver`/`onDragLeave`/`onDrop` handlers, `ring-2 ring-primary-400` visual highlight on target column, "Drop here" text in empty columns, `cursor-grab`/`active:cursor-grabbing` on cards, and optimistic local state updates (`localTaskOverrides` in SprintBoard). | Done |
| 23 | Gantt dependency arrows | Done -- SVG overlay renders arrows between dependent tasks for all 4 dependency types (FS/SS/FF/SF). Color-coded by health: green (satisfied), yellow (in progress), red (violated). Click-drag from bar edge to create dependencies with blue dashed preview line. Edit/remove via inline Pred column. | Done |
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
