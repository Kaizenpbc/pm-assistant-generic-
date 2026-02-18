# PM Assistant — Feature List

## 1. Authentication & User Management

Secure, session-based identity layer that handles login, registration, and role assignment. Tokens are stored in HTTP-only cookies so credentials never touch JavaScript, and every endpoint is rate-limited to block brute-force attacks.

- **JWT cookie-based authentication** — login, register, logout, token refresh
- **Role-based access** — admin, project_manager, team_member, viewer
- **Timing-safe login** — prevents username enumeration via bcrypt timing attacks
- **Auto-refresh** — transparent 401 retry with queued requests during refresh
- **Per-route rate limiting** — login (5/min), register (3/min), API (100/min)

---

## 2. Project Management (Core)

The central hub for all project data. Create projects across eight industry types, track status and budget in real time, and control who can see or edit each project with fine-grained role-based permissions.

- **Project CRUD** — create, read, update, delete with user-scoped ownership
- **Project types** — construction, software, event, research, marketing, operations, infrastructure, other
- **Status tracking** — planning, active, on-hold, completed, cancelled, delayed
- **Budget management** — total budget, actual spend, budget variance
- **Completion tracking** — percentage-based progress with automated rollup
- **Project members** — RBAC with owner, manager, editor, viewer roles per project

---

## 3. Schedule Management

Full-featured scheduling engine with four interchangeable views. Define tasks, link them with industry-standard dependency types, track field-level changes, and snapshot baselines to measure variance over time.

- **Multiple schedule views** — Gantt chart, calendar, Kanban board, table view
- **Task CRUD** — full lifecycle: create, update, delete, reorder, comment
- **Task dependencies** — finish-to-start (FS), start-to-start (SS), finish-to-finish (FF), start-to-finish (SF)
- **Priority levels** — urgent, high, medium, low
- **Task comments** — threaded discussion per task
- **Activity tracking** — field-level change history on every task
- **Baselines** — snapshot schedules at any point for variance analysis

---

## 4. Resource Management

Manage your workforce and equipment in one place. Assign resources to tasks, monitor weekly utilization, and catch overallocation before it causes delays — all visualized through capacity charts and heatmaps.

- **Resource pool** — named resources with hourly capacity and skill tags
- **Task assignments** — allocate resources to tasks with hours/week and date ranges
- **Workload computation** — weekly utilization percentages per resource
- **Capacity chart** — visual resource utilization over time
- **Workload heatmap** — color-coded overallocation detection
- **Resource forecast** — forward-looking capacity planning

---

## 5. AI Co-Pilot (Chat)

A conversational assistant embedded in every project view that can take real actions on your schedule, tasks, and resources. Ask it anything in plain English and it executes changes with full transparency into what it did and why.

- **Conversational AI** — natural language interaction powered by Claude
- **Tool-loop execution** — AI can create/update/delete tasks, projects, schedules on your behalf
- **20+ AI tools** — create_task, update_task, delete_task, reschedule_task, bulk_update_tasks, create_project, update_project, generate_report, analyze_schedule, and more
- **Context-aware** — automatically injects project, schedule, task, and resource context
- **Action result transparency** — expandable cards showing tool name, parameters, and full result data
- **Context attribution** — every AI response shows what data scope informed it
- **Token budgets** — configurable daily budget, per-request cap, and hourly request limits
- **Usage logging** — every AI call logged with token count, latency, and cost estimate

---

## 6. AI Task Prioritization

Let the AI rank your backlog so your team always works on what matters most. Every score comes with a transparent breakdown of the factors that drove it, so you can trust — or override — the recommendation.

- **Automatic ranking** — AI scores and ranks all tasks by urgency and impact
- **Priority factors** — each task shows the factors driving its priority (with high/medium/low impact labels)
- **Suggested changes** — recommends priority upgrades/downgrades with explanations
- **One-click apply** — apply individual or bulk priority changes
- **Critical path awareness** — identifies tasks on the critical path

---

## 7. AI Auto-Reschedule

When tasks slip, the system automatically detects the delay, proposes new dates for downstream work, and shows you exactly how the change affects your critical path — all before anything moves.

- **Delay detection** — identifies overdue and slipping tasks
- **Reschedule proposals** — AI generates new date recommendations with rationale
- **Progress comparison** — actual vs expected progress bars per delayed task
- **Critical path flagging** — prominent badges on critical path tasks
- **Impact estimation** — shows cost, timeline, and critical path impact of proposed changes
- **Accept/reject workflow** — review each proposal before applying

---

## 8. AI Resource Optimization

AI analyzes your team's workload across all projects and suggests rebalancing moves — shifting assignments from overloaded resources to underutilized ones while respecting skill requirements.

- **Workload balancing** — AI suggests resource reallocation to reduce overload
- **Skill-based matching** — considers resource skills when recommending reassignments
- **Utilization targets** — recommendations factor in target utilization rates

---

## 9. Predictive Analytics

A forward-looking intelligence engine that scores every project's health on a 0–100 scale, predicts completion dates, and surfaces risks before they become problems. Every score is fully explainable with per-dimension breakdowns.

- **Project health scores** — 0–100 composite score with breakdown (schedule, budget, risk, weather)
- **Score breakdown** — expandable per-dimension health bars with color thresholds
- **Trend indicators** — improving, stable, or declining trend arrows
- **Completion predictions** — ML-based estimated completion dates
- **Risk scoring** — identifies projects most likely to miss deadlines or budgets
- **Recommendations** — AI-generated action items per project
- **Dashboard summary** — portfolio-level risk/weather/budget overview with highlight badges

---

## 10. Critical Path Analysis (CPM)

Industry-standard Critical Path Method implementation that identifies the longest chain of dependent tasks. Any delay on the critical path delays the entire project — this feature makes those tasks visible at a glance.

- **Forward/backward pass** — computes early start, early finish, late start, late finish
- **Float calculation** — total float and free float per task
- **Critical path identification** — highlights zero-float task chains
- **Visual highlighting** — critical tasks flagged in Gantt and table views

---

## 11. Monte Carlo Simulation

Quantify schedule uncertainty by running 10,000+ simulated project outcomes. Instead of a single deadline, get a probability distribution — know the dates you'll hit with 50%, 75%, or 90% confidence, and which tasks create the most risk.

- **PERT-distributed simulation** — 10,000+ iteration risk analysis
- **Confidence intervals** — P10, P25, P50, P75, P90 completion dates
- **Histogram visualization** — distribution of simulated outcomes
- **Tornado diagram** — sensitivity analysis showing which tasks drive the most variance
- **Criticality index** — probability each task appears on the critical path

---

## 12. Earned Value Management (EVM)

The gold standard for measuring project performance. EVM integrates scope, schedule, and cost into a single framework so you can answer "are we on budget?" and "will we finish on time?" with hard numbers, not gut feel.

- **Core metrics** — Planned Value (PV), Earned Value (EV), Actual Cost (AC)
- **Performance indices** — CPI (cost), SPI (schedule)
- **Forecasting** — Estimate to Complete (ETC), Estimate at Completion (EAC)
- **S-curve analysis** — cumulative progress charting
- **Trend charts** — EVM metric trends over time
- **Forecast comparison** — multiple EAC calculation methods side by side

---

## 13. What-If Scenario Modeling

Test decisions before you make them. Create hypothetical scenarios — "what if we add two more engineers?" or "what if the permit is delayed 3 weeks?" — and compare the projected outcomes side by side against your current plan.

- **Scenario creation** — define hypothetical changes (dates, resources, budget)
- **Side-by-side comparison** — compare scenario outcomes against baseline
- **Impact analysis** — quantifies schedule, cost, and risk impact of each scenario

---

## 14. Cross-Project Intelligence

See the big picture across your entire portfolio. The system analyzes patterns spanning all projects to detect systemic issues — like a department that consistently overruns budgets — that no single-project view would reveal.

- **Portfolio trends** — aggregate performance patterns across all projects
- **Anomaly detection** — flags unusual patterns in schedules and budgets
- **Pattern recognition** — identifies recurring issues across the portfolio

---

## 15. Meeting Intelligence

Turn meeting notes into actionable project updates. Paste a transcript and the AI extracts tasks, assigns owners, and sets deadlines — then lets you push them into your schedule with one click.

- **Transcript analysis** — paste or upload meeting notes for AI processing
- **Action item extraction** — AI identifies tasks, owners, and deadlines from transcripts
- **One-click apply** — create tasks directly from extracted action items
- **Meeting history** — searchable archive of analyzed meetings

---

## 16. Lessons Learned Knowledge Base

Capture what went right and wrong so the organization never repeats the same mistakes. The AI detects patterns across lessons and proactively suggests mitigations when similar situations arise in new projects.

- **Lesson capture** — record lessons with category, impact, and tags
- **Pattern detection** — AI identifies recurring patterns across lessons
- **Mitigation suggestions** — recommendations based on historical lessons
- **Seed data** — pre-populate with industry-standard lessons
- **Full-text search** — find relevant lessons by keyword or category

---

## 17. Natural Language Queries

Skip the filters and menus — just type your question. The system interprets natural language, queries your project data, and returns formatted tables or auto-generated charts. Think of it as a search engine for your entire portfolio.

- **Ask anything** — type questions like "which tasks are overdue?" or "show me budget status"
- **Structured results** — returns formatted data tables, charts, or summaries
- **Dynamic visualization** — auto-generates bar, line, or pie charts based on query type
- **DOMPurify sanitization** — all rendered content sanitized against XSS

---

## 18. AI-Generated Reports

Generate polished status reports, risk assessments, and budget forecasts on demand. The AI pulls live project data and writes executive-ready summaries — saving hours of manual report writing every week.

- **Status reports** — AI-generated project status summaries
- **Risk assessments** — comprehensive risk analysis with mitigation strategies
- **Budget forecasts** — forward-looking budget projections
- **Custom prompts** — request specific report formats and focus areas

---

## 19. Proactive Alerts & Notifications

Don't wait for problems to find you. The system continuously monitors for overdue tasks, budget overruns, and resource conflicts, then pushes real-time alerts with one-click action buttons so you can resolve issues instantly.

- **Automatic alerts** — system detects overdue tasks, budget thresholds, resource conflicts
- **Severity levels** — critical, high, medium, low with color-coded badges
- **Alert types** — risk, budget, schedule, resource, informational
- **Suggested actions** — one-click action buttons to resolve issues (e.g., "Reschedule Task")
- **Real-time delivery** — WebSocket push notifications
- **Notification center** — bell icon with unread count, mark-all-read, dismiss

---

## 20. Workflow Automation

Define rules like "when a task is marked complete, notify the project manager" or "when budget exceeds 90%, escalate to the executive." The system evaluates triggers automatically and logs every execution for auditability.

- **Rule-based triggers** — define conditions that automatically execute actions
- **Execution logging** — full audit trail of automated actions
- **Rule management** — CRUD interface for workflow rules

---

## 21. Templates

Standardize how your organization starts projects. Save any project's structure — phases, tasks, dependencies — as a reusable template, then spin up new projects in seconds with a consistent foundation.

- **Project templates** — save project structures as reusable templates
- **Template gallery** — browse, preview, and customize templates
- **One-click apply** — instantiate a new project from any template
- **Phase-based structure** — templates preserve task hierarchy and dependencies

---

## 22. Exports & Reporting

Get your data out in the format stakeholders expect. Export project reports as branded PDFs for executives, XLSX spreadsheets for finance teams, or raw CSV for integration with other tools.

- **PDF export** — formatted project reports with branding
- **Excel export** — XLSX spreadsheets with task data
- **CSV export** — raw data export for external tools
- **Scope** — export individual projects or full portfolio

---

## 23. Audit Trail

Complete traceability for compliance and accountability. Every significant action — task updates, AI executions, permission changes — is recorded with who did it and when, filterable by project.

- **Activity logging** — every significant action recorded with timestamp and user
- **Project-scoped** — audit trails filterable by project
- **10,000-entry cap** — memory-safe with automatic pruning

---

## 24. Real-Time Collaboration

No more stale data or "refresh to see changes." When anyone on your team updates a task, schedule, or project, every connected user sees the change instantly via WebSocket push — no page reload needed.

- **WebSocket updates** — live push when tasks, schedules, or projects change
- **Multi-user aware** — changes from one user instantly reflected for others
- **Connection management** — 1,000 global / 10 per-user connection limits
- **Exponential backoff** — automatic reconnection with jitter (1s–30s, max 10 retries)

---

## 25. Dashboard Views

Role-specific home screens that surface what each user needs immediately. Project managers see their task backlog and alerts; executives see portfolio KPIs and budget health — everyone gets a tailored starting point.

### PM Dashboard
- Project list with status badges and completion percentages
- Task summary (overdue, in-progress, upcoming)
- Alert feed with action buttons
- AI chat panel with project context

### Executive Dashboard
- Portfolio KPIs (total projects, budget utilization, on-track %)
- Project health cards with expandable score breakdowns
- Cross-project trend analysis
- Budget tracking with variance indicators

### Portfolio Dashboard
- Multi-project comparison grid
- Aggregate resource utilization
- Portfolio-level risk summary

---

## 26. Security Features

Enterprise-grade security hardened over 10 rounds of review. Every input is validated, every mutation is ownership-checked, every error is sanitized, and every action is logged — so your data stays safe even if the internet doesn't.

- **CSRF protection** — signed double-cookie pattern with race-condition fix
- **Security headers** — CSP, HSTS, Permissions-Policy, X-Content-Type-Options, Referrer-Policy
- **Input validation** — Zod schemas on every route parameter and request body
- **Rate limiting** — global + per-route limits with 429 responses
- **Ownership checks** — every mutation verified against project ownership
- **XSS protection** — DOMPurify on all user-generated content rendering
- **Error sanitization** — production mode returns generic error messages only
- **Audit logging** — all errors and significant actions logged
- **Memory safety** — capped in-memory arrays prevent unbounded growth
