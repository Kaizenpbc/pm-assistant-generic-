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
| 12 | MariaDB 11.6 vector upgrade | Upgrade from MariaDB 10.11 to 11.6+ on Oracle Cloud. Refactor `EmbeddingService.searchSimilar()` to use native `VECTOR` column type and `VEC_DISTANCE_COSINE()`. Remove in-memory cosine similarity cache. | Large |
| 13 | External Cron Scheduler (Audit Item 13) | Last open item from the July 2026 architecture audit. Move scheduled jobs from in-process `node-cron` to an external scheduler for reliability. | Large |

---

## Tier 4: Strategic

Longer-term features that build on the methodology foundation.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 14 | Methodology-aware templates | Templates suggest a default methodology based on project type (e.g., IT template defaults to agile, construction to waterfall). User can override at creation time. | Small |
| 15 | Sprint retrospective AI | Mjuzi generates retrospective summaries from completed sprint data — what went well, what didn't, velocity trends, carryover analysis. | Medium |
| 16 | Cumulative flow diagram | Agile analytics chart showing task state distribution over time. Complements existing burndown and velocity charts. | Medium |
| 17 | Capacity planning for sprints | Use resource availability data to recommend sprint velocity commitments and flag overallocation before sprint start. | Large |
| 18 | Cross-project portfolio velocity | Aggregate velocity metrics across multiple agile projects for executive/PMO dashboards. | Medium |

---

## Prioritization Notes

- **Tier 1 is mandatory** — shipping dead code and missing tests is technical debt that compounds.
- **Tier 2 before Tier 3** — polish existing features before adding new ones.
- **Tier 3 items are independent** — can be done in any order based on user demand.
- **Tier 4 depends on Tier 3** — strategic items build on the foundation laid by earlier tiers.
- **Items 12-13** are infrastructure upgrades that can be scheduled independently of feature work.
