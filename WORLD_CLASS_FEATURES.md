# World-Class Features Roadmap

## Vision
An agentic AI project management platform that combines the scheduling power of Primavera P6, the usability of Monday.com/Smartsheet, and autonomous AI agents that no competitor offers. 14 agents continuously detect, reason, and act — with human-in-the-loop governance and full audit trails.

## Benchmarked Against
- Oracle Primavera P6 (enterprise scheduling, EVM, critical path)
- Microsoft Project (Gantt, resource leveling, baselines)
- Monday.com (UX, automation, collaboration)
- Wrike (AI features, resource management)
- Smartsheet (portfolio management, dashboards)
- Asana (workload management, goals)

---

## Priority 1: Table Stakes (Must-Have to Be Taken Seriously)

### 1.1 Critical Path Method (CPM)
- Auto-calculate forward/backward pass (ES, EF, LS, LF)
- Total float and free float per task
- Highlight critical path on Gantt chart (red bars)
- Recalculate on demand via API and UI toggle
- **Benchmark:** Primavera P6, MS Project

### 1.2 Baseline Management
- Save schedule baseline snapshots (planned start, planned end, progress)
- Compare baseline vs actual on Gantt (dual bars)
- Start, end, and duration variance analysis per task
- Multiple baseline support (Baseline 1, 2, 3...)
- Baseline comparison report
- **Benchmark:** Primavera P6, MS Project

### 1.3 Full Earned Value Management (EVM)
- Planned Value (PV / BCWS)
- Earned Value (EV / BCWP)
- Actual Cost (AC / ACWP)
- Cost Performance Index (CPI = EV/AC)
- Schedule Performance Index (SPI = EV/PV)
- Estimate at Completion (EAC)
- Estimate to Complete (ETC)
- To-Complete Performance Index (TCPI)
- Variance at Completion (VAC)
- S-Curve visualization (PV vs EV vs AC over time)
- **Benchmark:** Primavera P6

### 1.4 Gantt Timescale Zoom, Resizable Splitter & Inline Grid Editing
- Five zoom levels: Day (32px/day), Week (10px/day), Month (3.2px/day), Quarter (1.2px/day), Year (0.27px/day)
- Two-tier timescale header (upper tier: coarser unit, lower tier: finer unit)
- Segmented zoom control in toolbar (D | W | M | Q | Y)
- Draggable splitter between task table and timeline (width persists per schedule)
- 11 columns in left panel: #, Task Name, Pred, Start, End, Duration, Est Days, %, Priority, Assigned, Status
- Zoom and splitter width persist per schedule via localStorage
- **Inline grid editing** — click any cell to edit directly in the left panel (10 editable fields: name, predecessor, start, end, duration, est days, %, priority, assigned, status). Tab/Shift+Tab navigates across cells and rows. Duration edits auto-compute end date. Enter saves, Escape cancels, blur auto-saves, green flash confirms success. Input types match field: text, date picker, number, select dropdown, MS Project predecessor notation.
- **Benchmark:** MS Project, Primavera P6 — matches P6/MS Project zoom + dual header + resizable splitter + inline cell editing

### 1.5 Kanban Board View
- Toggle between Gantt / Kanban / Table views
- Columns by status (Pending, In Progress, Completed, Cancelled)
- Drag-and-drop cards between columns
- Card shows: task name, assignee, priority, due date, progress
- **Benchmark:** Monday.com, Jira, Asana

### 1.6 Resource Pool & Workload View
- Resource pool: list all team members with roles and capacity
- Assign resources to tasks with effort hours
- Workload heatmap: visual capacity per person per week
- Over-allocation detection and warnings
- Resource utilization percentage
- Paginated list endpoints (`?limit=&offset=`, max 200, default 50) on resources, projects, schedule tasks, sprints, and templates — shared `paginationSchema` with `PaginatedResponse<T>` format (data, total, page, pageSize, totalPages)
- Dedicated Resource Management page (`/resources`) with project selector, summary cards, and four tabs: Team (full resource table with create/edit/delete CRUD), Workload Heatmap (color-coded weekly utilization grid), Resource Histogram (SVG bar charts with 8h capacity line), Capacity Forecast (8-week bottleneck predictions + AI recommendations)
- **Benchmark:** MS Project, Wrike, Asana

### 1.6a Gantt Overallocation Warnings & Minimap
- **Overallocation warnings**: Toggle "Overalloc" button in Gantt toolbar; client-side detection of overlapping assignments per resource; amber 2px border + glow + "!" dot on flagged bars; count badge on toolbar button; legend entry
- **Minimap**: 200×80px overview panel (bottom-right); colored rectangles per task matching status colors; semi-transparent blue viewport rectangle tracks scroll position; click/drag to scroll timeline proportionally; enabled by default, toggleable via "Map" button
- **Benchmark:** MS Project (overallocation indicators), Primavera P6 (minimap navigation)

### 1.6b Comments & Activity Feed
- Comment thread on each task
- Activity feed: auto-log all changes (status, assignee, dates, etc.)
- Timestamp and user attribution
- **Benchmark:** All top tools

### 1.7 Export Capabilities
- Export project summary report to PDF (browser print)
- Export project data to CSV
- Export project as MSPDI XML (compatible with MS Project and ProjectLibre)
  - Tasks with UID, Name, WBS, OutlineLevel, Start, Finish, Duration, Milestone, Summary, PercentComplete, PredecessorLinks
  - Resources extracted from assignedTo, Assignments linking tasks to resources
  - Dependency types: FS=1, FF=0, SS=2, SF=3; lag in tenths-of-minutes
  - Duration format: PT{days×8}H0M0S
- **Benchmark:** All top tools; MSPDI export matches MS Project, Primavera P6

---

## Priority 2: Competitive Differentiators

### 2.1 Auto-Scheduling Engine
- Move one task -> cascade all dependent tasks automatically
- Respect all four dependency types (FS, SS, FF, SF) and lag days across multiple predecessors
- Up to 20 predecessors per task; cascades compute the correct early start by taking the maximum constraint from all predecessors
- **Benchmark:** MS Project, Primavera P6

### 2.2 Workflow Automation Builder (DAG Engine)
- Declarative DAG-based workflow engine with DB persistence
- Node types: trigger, condition, action, approval gate, delay, agent
- Triggers: status_change, progress_threshold, date_passed, task_created, priority_change, assignment_change, dependency_change, budget_threshold, project_status_change, manual
- Event-driven: task create/update and project budget/status changes automatically fire matching workflows
- Conditions: field-based evaluation with operators (equals, greater_than, contains, etc.)
- Actions: update_field, log_activity, send_notification (real notifications via NotificationService), invoke_agent
- Agent nodes: invoke registered AI agent capabilities inline with retry logic and backoff
- Approval gates: pause execution until resumed via API/UI
- Multi-step workflows with branching (yes/no edges on conditions)
- Persistent execution history with per-node status tracking
- 15-minute overdue-task scanner triggers date_passed workflows automatically
- Cycle protection, graceful degradation, audit integration
- 5 DB tables: workflow_definitions, workflow_nodes, workflow_edges, workflow_executions, workflow_node_executions
- **Benchmark:** Monday.com, Wrike, Smartsheet (exceeds with DAG support + approval gates + agent nodes)

### 2.3 Custom Dashboards
- Role-based dashboards (PM project list, Executive analytics)
- Executive view: portfolio charts, KPI cards, status summaries
- **On Track percentage** uses actual schedule variance (SPI) and budget variance instead of a progress-threshold heuristic, accurately reflecting project health
- Widget drag-to-reorder: drag handle (grip icon) on hover, blue ring drop indicator, order persisted in localStorage (separate from visibility toggles)
- Auto-refresh via WebSocket cache invalidation
- **Benchmark:** Monday.com, Smartsheet

### 2.4 Real-Time Collaboration
- Real-time task updates (WebSocket)
- Real-time presence indicators: avatar circles in project header show who else is viewing the same project
- Presence is ephemeral (server in-memory), auto-cleans on disconnect
- **Benchmark:** Monday.com, Smartsheet

### 2.5 Calendar & Table Views
- Calendar view with task bars across dates
- Table view with inline editing (spreadsheet-like)
- MS Project-style column picker: 22 columns across 4 groups (Standard, Scheduling/CPM, Baseline, Other)
- **Row number (#) column** — always visible, sequential numbering, cannot be toggled off
- **Multi-predecessor support** — up to 20 predecessors per task, each with its own type (FS/SS/FF/SF) and lag days, stored in a `task_dependencies` junction table
- **MS Project-style predecessor display** — comma-separated compact row-number notation (e.g. "3FS+2d,5SS,7") instead of full task names; same format used in CSV export
- **Dependency health badges** — colour-coded dots (green/yellow/red) per predecessor showing completion status. No other PM tool shows dependency health inline.
- **Inline predecessor editing** — click and type comma-separated row numbers with optional type and lag; validated with error feedback
- **Task form multi-predecessor UI** — add/remove dependency rows in the task modal, each with predecessor selector, type dropdown, and lag field
- **Server-side dependency validation** — single `validateDependency()` method enforces self-reference, circular, cross-schedule, existence, and 20-predecessor limit checks across API, UI, and AI tools. Orphan cleanup via `ON DELETE CASCADE` on task deletion.
- Column visibility persisted per schedule in localStorage
- CPM columns (Early Start, Late Finish, Total Float, etc.) auto-trigger critical path computation
- Baseline variance columns populate when comparison is active
- WBS auto-computed from task hierarchy
- Column sorting on all numeric and date fields
- Saved Views: name and store column+sort configurations per schedule, load/update/delete from dropdown
- **Benchmark:** MS Project, Smartsheet, Monday.com — **exceeds MS Project** with multi-predecessor support, health badges, and inline predecessor editing

### 2.6 Portfolio Dashboard
- Full portfolio dashboard with 6 KPI cards: Total Projects, Active, On Track, At Risk, Budget Allocated, Budget Spent
- Status filter pills to narrow the project card grid (All / Active / On Hold / Planning / Completed)
- Aggregate portfolio budget progress bar (allocated vs. spent)
- Per-project cards with health indicator, progress bar, task completion ratio, and budget utilization bar
- Dashboard / Timeline toggle preserving the original multi-project Gantt view
- Server-side aggregation via `/api/v1/reporting/portfolio` returning `budgetAllocated`, `budgetSpent`, `progressPercentage`, `totalTasks`, `completedTasks` per project
- **Benchmark:** Primavera P6, Smartsheet, Monday.com — **exceeds** with budget KPI cards and per-project health cards alongside the Gantt timeline

### 2.7 Advanced Security
- Role-based access control (admin, executive, project_manager, team_member, scrum_master, finance_officer) with project member roles (owner, manager, editor, viewer)
- MCP tool permission matrix: 79 tools filtered by user role at registration time (agents only see permitted tools)
- Append-only chained audit ledger with API search, filter, and pagination
- Data encryption at rest and in transit
- Per-user AI token budget enforcement (`AIBudgetService`) — monthly limits, custom per-user overrides, `GET /api/v1/ai/budget` usage endpoint, automatic enforcement before every AI call, proactive 80% threshold warning notification (daily-deduped)
- Zod validation on 24 route files covering all critical API inputs
- **Benchmark:** Enterprise tools

---

## Priority 3: AI Moat (What Nobody Else Has)

### 3.1 AI Auto-Rescheduling
- Detect delays automatically
- AI proposes new schedule minimizing total project impact
- One-click accept or modify AI suggestion

### 3.2 Predictive Resource Optimizer
- AI predicts resource bottlenecks up to 8 weeks ahead (configurable)
- Suggests team rebalancing before burnout occurs
- Skill-based matching for task assignment
- Capacity forecasting

### 3.3 Natural Language Queries with Charts
- "Which projects are at risk of missing Q3 deadline?" -> instant answer with chart
- "Show me resource utilization for last month" -> auto-generated visualization
- "Compare Project A vs Project B" -> side-by-side analysis
- Deep integration with all project data

### 3.4 AI Meeting Minutes -> Auto-Update Project
- Paste meeting transcript for analysis
- AI extracts action items, decisions, risks
- Auto-creates/updates tasks in the schedule
- Identifies and categorizes risks from transcript

### 3.5 AI Lessons Learned Engine
- Learns from every completed project
- Pattern recognition across project types
- Auto-suggests risk mitigations from past projects
- Knowledge base that grows smarter
- Full CRUD on the Lessons Learned page: edit opens the lesson modal pre-filled; delete presents a styled confirmation modal before removing the record
- "Load More" pagination on the Lessons Learned page for incremental loading of large knowledge bases

### 3.6 Monte Carlo Simulation
- Probabilistic schedule modeling
- P50, P80, P90 completion date predictions
- Risk-adjusted cost forecasting
- Confidence intervals on all predictions
- Visual tornado diagrams for sensitivity analysis

### 3.7 AI-Powered Earned Value Forecasting
- Predict future CPI/SPI trends
- Early warning for projects trending toward overrun
- AI suggests corrective actions with estimated impact
- Compare AI forecast vs traditional EAC formulas
- Dedicated EVM Dashboard page (`/evm`) with 6 KPI cards, 4 forecast cards (with warning borders), CPI/SPI trend line chart, early warnings panel, forecast comparison table, and AI predictions section (confidence range, overrun probability, corrective actions with priority badges)

### 3.8 Agent Activity Log
- Per-project decision log for all 4 agentic agents (Auto-Reschedule, Budget, Monte Carlo, Meeting)
- Every agent run records its decision: alert created, skipped (with reason), or error
- Structured details include thresholds, metrics, and context for each decision
- Filterable by agent, paginated API and UI
- "Agent Activity" tab on project detail page
- Full transparency into why alerts were or weren't created

---

## Priority 4: Production Polish (Make It Shippable)

### 4.1 Notification System
- In-app notification center with unread badge
- Full-page Notifications Center (`/notifications`) with severity summary cards (Critical/High/Medium/Low), type and severity filters, full notification list with severity color bars, type icons, project names, and mark-read controls
- Individual mark-as-read persists to the server via API so read state survives page refreshes
- "Load More" pagination on the Notifications Center page for incremental loading of large notification lists
- Accessible from sidebar ("Notifications" under Workspace) and "View all alerts" in bell dropdown
- Email alerts for assignments, deadlines, status changes
- Configurable notification preferences per user
- @mention notifications from comments
- **Benchmark:** All top tools

### 4.2 File Attachments & Documents
- Upload files to tasks and projects
- File preview (images, PDFs, documents)
- Version history on attachments
- Drag-and-drop upload
- **Benchmark:** Monday.com, Wrike, Asana

### 4.3 Time Tracking & Timesheets
- Log hours against tasks
- Weekly timesheet view per resource with inline **"Log Time"** form (project/schedule/task dropdowns, date, hours, description) — create entries without leaving the page
- Actual vs estimated hours comparison
- Time-based cost calculations
- **Benchmark:** MS Project, Wrike, Smartsheet

### 4.4 Project Templates
- Save project structure as reusable template
- Template library with categories
- One-click project creation from template
- Include tasks, dependencies, roles, and milestones
- **Benchmark:** Monday.com, Asana, Smartsheet

### 4.5 Custom Fields
- User-defined fields on tasks and projects (text, number, date, dropdown, checkbox)
- Custom field filtering and sorting
- Custom fields visible in all views (Gantt, Kanban, Table)
- **Benchmark:** Monday.com, Jira, Asana

### 4.6 Network Diagram View
- Dependency graph visualization (PERT/precedence diagram)
- Interactive node layout with zoom/pan
- Critical path highlighting on network view
- **Benchmark:** Primavera P6, MS Project

### 4.7 Burndown/Burnup Charts
- Sprint burndown chart (remaining work vs time)
- Burnup chart (completed work + scope changes)
- Velocity tracking across sprints
- **Benchmark:** Jira, Azure DevOps

---

## Priority 5: Market Advantage (Win Enterprise Deals)

### 5.1 External Integrations
- Slack integration (notifications, slash commands)
- Microsoft Teams integration
- Jira two-way sync
- GitHub/GitLab commit linking
- Email webhook triggers
- **Benchmark:** Monday.com, Asana, Wrike

### 5.2 Client/Stakeholder Portal
- Read-only external view for clients
- Branded portal with project status
- Approval workflows for deliverables
- Comment/feedback from external stakeholders
- **Benchmark:** Wrike, Smartsheet

### 5.3 Approval Workflows & Change Requests
- Formal change request submission
- Multi-level approval chains
- Impact analysis before approval
- Audit trail of all approvals/rejections
- **Benchmark:** Primavera P6, enterprise tools

### 5.4 Resource Leveling
- Automatic over-allocation resolution
- Level within slack / extend project options
- Priority-based resource conflict resolution
- Before/after comparison view
- **Benchmark:** MS Project, Primavera P6

### 5.5 Sprint Planning / Agile Mode
- Scrum board with sprint cycles
- Backlog grooming and prioritization
- Story points and velocity tracking
- Sprint retrospective summaries
- **Benchmark:** Jira, Azure DevOps, Monday.com

### 5.6 Custom Report Builder
- Drag-and-drop report designer
- Configurable data sources and filters
- KPI, chart, and table sections render with correct data shapes (fixed section rendering bugs)
- `groupBy` parameter validated against an allowlist for SQL injection protection
- Regular users can delete their own templates (no longer requires admin role)
- Report Designer correctly persists all sections when updating an existing template
- Scheduled report delivery via email
- Shareable report links
- **Benchmark:** Smartsheet, Monday.com

### 5.7 Project Intake Forms
- Customizable request submission forms
- Triage pipeline with scoring
- Auto-routing to approvers
- Conversion from request to active project
- **Benchmark:** Wrike, Smartsheet, Monday.com

---

## Implementation Status

| Feature | Status | Priority |
|---------|--------|----------|
| Critical Path Method | Done | P1 |
| Baseline Management | Done | P1 |
| Full EVM Metrics | Done | P1 |
| Kanban Board View | Done | P1 |
| Resource Pool & Workload | Done | P1 |
| Comments & Activity Feed | Done | P1 |
| Export Capabilities | Done | P1 |
| Auto-Scheduling Engine | Done | P2 |
| Workflow Automation | Done | P2 |
| Custom Dashboards | Done | P2 |
| Real-Time Collaboration | Done | P2 |
| Calendar & Table Views | Done | P2 |
| Portfolio-Level Gantt | Done | P2 |
| Advanced Security | Done | P2 |
| AI Auto-Rescheduling | Done | P3 |
| Predictive Resource Optimizer | Done | P3 |
| NL Queries with Charts | Done | P3 |
| AI Meeting -> Auto-Update | Done | P3 |
| AI Lessons Learned | Done | P3 |
| Monte Carlo Simulation | Done | P3 |
| AI EVM Forecasting | Done | P3 |
| Agent Activity Log | Done | P3 |
| Notification System | Done | P4 |
| File Attachments & Documents | Done | P4 |
| Time Tracking & Timesheets | Done | P4 |
| Project Templates | Done | P4 |
| Custom Fields | Done | P4 |
| Network Diagram View | Done | P4 |
| Burndown/Burnup Charts | Done | P4 |
| External Integrations | Partial | P5 |
| Client/Stakeholder Portal | Done | P5 |
| Approval Workflows & Change Requests | Done | P5 |
| Resource Leveling | Done | P5 |
| Sprint Planning / Agile Mode | Done | P5 |
| Custom Report Builder | Done | P5 |
| Project Intake Forms | Done | P5 |
| Gantt Drag-and-Drop Rescheduling | Done | Enhancement |
| Recurring Tasks | Done | Enhancement |
| Resource Availability Calendar | Done | Enhancement |
| Customizable Dashboard Widgets | Done | Enhancement |
| AI Task Slip Predictor | Done | Enhancement |
| AI Status Report Generator | Done | Enhancement |
| AI Scope Creep Detector | Done | Enhancement |
| Mobile-Optimized Views | Done | Enhancement |
| Email Notifications & Digests | Done | Enhancement |
| Scheduled Report Delivery | Done | Enhancement |
| Dark Mode (full coverage — all 41 pages + shared components) | Done | Enhancement |
| Project Milestones (Gantt diamonds) | Done | Enhancement |
| Dependency Types (FS/FF/SS/SF + lag) | Done | Enhancement |
| Multi-Dependency Support (up to 20 predecessors, junction table) | Done | Enhancement |
| Row Numbers & MS Project-style Predecessors | Done | Enhancement |
| Dependency Health Badges (green/yellow/red) | Done | Innovation |
| Inline Predecessor Editing (multi-predecessor comma syntax) | Done | Enhancement |
| Health-Colored Gantt Dependency Arrows (one per predecessor) | Done | Innovation |
| Kanban WIP Limits | Done | Enhancement |
| Comment @Mentions | Done | Enhancement |
| Bulk CSV/Excel Task Import (with guardrails) | Done | Enhancement |
| Gantt PDF Export | Done | Enhancement |
| Goals / OKR Tracking | Done | Enhancement |
| Time Zone Support | Done | Enhancement |
| Multi-Language / i18n (EN/FR/ES) | Done | Enhancement |
| Gantt Row Striping (alternating backgrounds, dark mode) | Done | Enhancement |
| Gantt Resource Avatars (initials circles on bars) | Done | Enhancement |
| Gantt Drag-to-Create (click-drag timeline to create task) | Done | Innovation |
| Gantt Resource Overallocation Warnings (amber highlights on overlapping assignments) | Done | Innovation |
| Gantt Minimap (200×80px overview panel with draggable viewport) | Done | Enhancement |
| MS Project XML Export (MSPDI format with tasks, resources, assignments) | Done | Enhancement |
| Resource Management Page (workload heatmap, histogram, capacity forecast) | Done | Enhancement |
| EVM Dashboard Page (KPI cards, trend chart, forecasts, AI predictions) | Done | Enhancement |
| Notifications Center Page (severity cards, filters, full list) | Done | Enhancement |
| Dashboard Widget Drag-to-Reorder (grip handle, localStorage persistence) | Done | Enhancement |
| Mobile-Responsive Gantt Touch Gestures (bar drag, progress drag, drag-to-create) | Done | Enhancement |
| Resource Management Team Tab (create/edit/delete resources from /resources page) | Done | Enhancement |
| Timesheet Inline Log Time Form (project/schedule/task dropdowns, date, hours, description) | Done | Enhancement |
| Notification Mark-as-Read Persistence (individual read state saved to server API) | Done | Bug Fix |
| Executive Dashboard On Track Metric (uses schedule/budget variance, not progress heuristic) | Done | Bug Fix |
| Goals Project Dropdown (replaces free-text Project ID input with searchable dropdown) | Done | Bug Fix |
| Lessons Learned Edit/Delete (pre-filled modal for edit, ConfirmModal for delete) | Done | Enhancement |
| Styled ConfirmModal (replaces window.confirm() across Integrations, Change Requests, Intake, Settings, Report Builder, Goals) | Done | Enhancement |
| Expanded Global Search (6 entity types: projects, tasks, goals, lessons, resources, change requests; parallel queries) | Done | Enhancement |
| Portfolio Dashboard (6 KPI cards, status filter pills, budget progress bar, project health cards, Dashboard/Timeline toggle) | Done | Enhancement |
| Portfolio API Enhancement (budgetAllocated, budgetSpent, progressPercentage, totalTasks, completedTasks per project) | Done | Enhancement |
| Load More Pagination (Notifications Center, Lessons Learned, Agent Proposals pages) | Done | Enhancement |
| Report Builder Data Shape Fixes (KPI/chart/table sections, groupBy SQL injection guard, user-owned template delete, designer section persistence) | Done | Bug Fix |
| Shared Pagination Schema (paginationSchema.ts + PaginatedResponse on projects, schedule tasks, sprints, templates) | Done | Enhancement |
| Per-User AI Token Budget (AIBudgetService, ai_usage_log table, GET /ai/budget endpoint, enforcement in claudeService) | Done | Enhancement |
| Zod Validation Expansion (9 additional route files: users, bulk, sprints, timeEntries, aiChat, apiKeys, webhooks, intakeForms, goals) | Done | Enhancement |
| Repository Layer (BaseRepository + ProjectRepository, UserRepository, ScheduleRepository — centralized SQL/row mapping, services keep business logic) | Done | Architecture |
| Structured Metrics (MetricsService with request counts, latency p50/p95/p99, AI token usage, DB query counts; GET /api/v1/metrics admin endpoint) | Done | Observability |
| Request Context Propagation (AsyncLocalStorage request ID through all async operations, Winston logger auto-includes requestId) | Done | Observability |
| Transaction Boundaries (queryOn() helper + transaction() wraps 7 multi-table service methods for ACID guarantees) | Done | Reliability |
| DB Pool Timeouts (connectTimeout: 5s, idleTimeout: 30s, queueLimit: 50 — env-configurable) | Done | Reliability |
| AI Budget 80% Threshold Warning (proactive daily-deduped notification before hard block at 100%) | Done | Enhancement |
| AI Circuit Breaker (trips after 5 transient failures, 60s cooldown, returns 503 instantly, auto-recovers) | Done | Reliability |
| Parallel Agent Scheduler (projects processed concurrently with bounded parallelism of 3, ~3x scan speedup) | Done | Performance |
| Structured Log Export (daily-rotated JSON logs with 14d retention, admin query/download endpoints) | Done | Observability |
