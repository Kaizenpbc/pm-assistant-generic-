# PM Assistant — Roadmap

Last updated: 2026-07-14

---

## Tier 1: Cleanup (Finish Methodology Feature)

These items are incomplete work from the methodology-aware projects feature. They should be done before any new feature work.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 1 | Wire `getDefaultViewMode()` | Schedule tab should initialize to Kanban for agile projects. The utility exists but is not connected to the Schedule tab's view state. | Small |
| 2 | Delete `getContextCardConfig()` | Dead code in `src/client/src/utils/methodology.ts`. Exported but never imported or used anywhere. | Trivial |
| 3 | Unit tests for `methodology.ts` | `getPrimaryTabs`, `getReadinessSteps`, `getDefaultViewMode` are pure functions with no dependencies. Cover all three methodologies. | Small |
| 4 | Methodology badge on project cards | Dashboard project cards show no indication of methodology. Add a small W/A/H pill badge so PMs can distinguish at a glance. | Small |

---

## Tier 2: Polish (Gaps in Existing Features)

Small improvements that round out existing functionality.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 5 | Methodology in MCP `get-project` response | The API returns the field, but MCP resource summaries (project summary resource) may not surface it. Verify and fix. | Trivial |
| 6 | Methodology in AI context | `aiContextBuilder` should include methodology so Mjuzi and agents know whether a project is agile/waterfall when reasoning about it. | Small |
| 7 | Methodology in project exports | CSV, XML (MSPDI), and PDF exports should include the methodology field. | Small |
| 8 | Readiness bar auto-dismiss | When all 5 steps are complete, show a brief "All set!" state and auto-dismiss after a few seconds, instead of staying visible with 5/5 green. | Small |

---

## Tier 3: New Features

New user-facing capabilities.

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 9 | Sprint velocity widget on dashboard | Sparkline chart on PM dashboard showing velocity trend for agile projects. Reuses existing `GET /sprints/velocity/:projectId` endpoint. | Medium |
| 10 | Backlog view | Dedicated view for tasks not assigned to any sprint. Useful for agile projects to manage the product backlog separately from sprint work. | Medium |
| 11 | Story points on Kanban cards | Surface `sprint_tasks.story_points` on board task cards. Show column point totals and optional WIP limits. | Medium |
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
