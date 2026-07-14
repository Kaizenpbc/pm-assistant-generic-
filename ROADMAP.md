# PM Assistant — Roadmap

Last updated: 2026-07-14

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
| 13 | External Cron Scheduler (Audit Item 13) | Last open item from the July 2026 architecture audit. Move scheduled jobs from in-process `node-cron` to an external scheduler for reliability. | Large |

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

## Prioritization Notes

- **Tier 1 is mandatory** — shipping dead code and missing tests is technical debt that compounds.
- **Tier 2 before Tier 3** — polish existing features before adding new ones.
- **Tier 3 items are independent** — can be done in any order based on user demand.
- **Tier 4 depends on Tier 3** — strategic items build on the foundation laid by earlier tiers.
- **Items 12-13** are infrastructure upgrades that can be scheduled independently of feature work.
