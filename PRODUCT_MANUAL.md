# PM Assistant -- Product Manual

## Product Overview

PM Assistant is an enterprise-grade project management platform built with TypeScript, React, and Fastify. It combines traditional PM discipline (CPM, EVM, baselines) with AI-powered intelligence (auto-reschedule, natural language queries, predictive analytics) in a single SaaS application. The platform supports the full project lifecycle from intake through execution, monitoring, and closeout.

---

## 1. Project Management

### Projects

Full CRUD lifecycle for projects with the following attributes:

- **Status tracking**: planning, active, on_hold, completed, cancelled
- **Priority levels**: low, medium, high, urgent
- **Budget management**: allocated budget, spent budget, budget variance
- **Date management**: start date, end date, auto-calculated duration
- **Team assignment**: project members with role-based access

### Schedules

Each project contains one or more schedules. A schedule groups tasks into a logical timeline and serves as the unit for critical path analysis, baselines, and Monte Carlo simulation.

### Tasks

Tasks are the atomic unit of work. Each task supports:

- Status: pending, in_progress, completed, cancelled
- Priority: low, medium, high, urgent
- Multiple predecessor dependencies (up to 20 per task) with type and lag per dependency
- Estimated duration (days) and work effort
- Assigned resource
- Parent-child hierarchy (subtasks)
- Risk and issue annotations
- Progress percentage tracking
- Recurring task support (daily, weekly, biweekly, monthly) with auto-generation

### Recurring Tasks

Tasks can be marked as recurring templates with an RRULE-style recurrence rule. Supported frequencies:

- **Daily** — generates a new task instance every day
- **Weekly / Biweekly** — with selectable days of the week (e.g., Mon/Wed/Fri)
- **Monthly** — on a specific day of the month

A daily cron job (02:00 UTC) scans for templates and generates instances within a 14-day horizon. Generated instances link back to their parent template via `recurrence_parent_id`. Template tasks appear in the Gantt chart with a repeat icon.

### Views

- **Gantt chart** -- interactive timeline with dependency arrows and critical path highlighting. **Five zoom levels** (Day, Week, Month, Quarter, Year) with a **two-tier timescale header** (e.g. months over weeks, years over months). Zoom selection persists per schedule via localStorage. A **draggable splitter** between the task table and timeline lets you resize the panels; width persists per schedule. The left panel shows 11 columns: row number (#), task name, predecessor (row-number format with health dot), start date, end date, duration, estimated days, progress %, priority, assigned to, and status. Drag the splitter to reveal or hide columns. **Resizable columns**: drag column borders in the header to resize; widths persist per schedule in localStorage. **Column picker**: Columns button in toolbar toggles column visibility; # and Task Name always visible; persists per schedule. **Row expand/collapse**: parent tasks have a chevron toggle to collapse/expand children; persists in localStorage. **Collapse All / Expand All** buttons in toolbar toggle all parent tasks at once. **Inline grid editing**: click any cell (except row #) to edit directly — text inputs for name/assignee, date pickers for start/end, number inputs for est days/%, select dropdowns for priority/status, and MS Project notation for predecessors. Tab/Shift+Tab navigates across fields and rows. Duration edits auto-compute end date. Enter saves, Escape cancels, blur auto-saves, green flash confirms. **Row drag reorder**: hover over the # column for a drag grip; drag rows up/down within the same parent level. **Multi-select bulk edit**: checkbox selection with Shift+click range select; sticky toolbar for bulk status/priority/assignee changes and delete. Delete key triggers bulk delete with confirmation. **Undo/Redo**: Ctrl+Z/Ctrl+Y (up to 50 actions) for inline edits, bar drags, reorders, and bulk updates; undo/redo buttons in toolbar with tooltips. **Keyboard navigation**: Arrow keys move between cells, Enter/F2 to edit, Escape to clear focus. Supports drag-and-drop rescheduling: drag a bar to move a task, drag the right edge to resize; timeline auto-scrolls when dragging near viewport edges. Date changes cascade through dependencies automatically. Dependency arrows are colour-coded by predecessor health: green (completed), yellow (in progress), red (overdue/at risk). Hover over a bar to see predecessor details including row number, task name, and health status. **Column header sort**: click any column header to cycle through ascending/descending/none; sort indicator (▲/▼) shown in header; sorts within sibling groups to preserve hierarchy; row drag reorder disabled while sort is active. **Copy/Paste cells**: Ctrl+C copies the focused cell value to clipboard; Ctrl+V pastes into the focused cell (same field type only); green flash confirms. **Baseline bar refinement**: ghost bars are rendered only when a task's baseline dates differ from its current dates, eliminating visual noise for on-schedule tasks. **Indent/Outdent**: Tab indents the focused task (makes it a child of the task above); Shift+Tab outdents (promotes to parent's parent); both operations go through onTaskUpdate and are undoable. **Bar progress drag**: drag the progress fill edge in a task bar to set completion percentage; visible handle appears on hover; change is undoable via Ctrl+Z.
- **Kanban board** -- drag-and-drop cards grouped by status
- **Calendar view** -- tasks plotted on a monthly/weekly calendar
- **Table view** -- sortable, filterable spreadsheet-style listing with a customizable column picker. Choose from 22 columns across four groups (Standard, Scheduling/CPM, Baseline, Other). The **# (row number)** column is always visible and shows sequential numbering. The **Predecessor** column displays dependencies in compact MS Project-style row-number format (e.g. "3", "7SS+2d") with colour-coded health badges: green dot (predecessor completed), yellow dot (in progress), red dot (overdue). Predecessors are **inline-editable** — click and type a row number with optional type and lag. Column selections persist per schedule. Scheduling columns automatically trigger CPM computation. Baseline columns show variance data when a baseline comparison is active. **Saved Views** let you name and store column+sort configurations; load, update, or delete them from the Views dropdown.

### Bulk Operations

Bulk create, update, and status-change endpoints allow operating on multiple tasks or projects in a single request.

### Search

Full-text search across projects, tasks, and schedules with keyword matching.

---

## 2. Critical Path and Baselines

### Critical Path Method (CPM)

The `CriticalPathService` performs a full forward and backward pass across the task dependency graph to compute:

- **Early Start (ES)** and **Early Finish (EF)** for every task
- **Late Start (LS)** and **Late Finish (LF)**
- **Total float** and **free float**
- **Critical path identification** -- tasks with zero total float
- **Project duration** -- the minimum schedule span

Results feed into Gantt chart highlighting, Monte Carlo simulation, and resource leveling.

### Baselines

The `BaselineService` captures point-in-time snapshots of a schedule. Each baseline records every task's start date, end date, estimated days, progress, and status. Baselines are immutable once created.

### Variance Tracking

Comparing a baseline against current schedule state produces per-task variance metrics:

- Start variance (days slipped)
- End variance (days slipped)
- Duration variance (longer or shorter than planned)
- Progress variance (percentage points ahead or behind)
- Status change detection

---

## 3. Earned Value Management (EVM)

### S-Curve Data

The `SCurveService` computes cumulative Planned Value (PV), Earned Value (EV), and Actual Cost (AC) data points over time, derived from task durations, progress percentages, and project budgets. These data points render as the classic S-curve chart.

### EVM Metrics

Standard earned value indicators computed from S-curve data:

| Metric | Formula | Meaning |
|--------|---------|---------|
| CPI | EV / AC | Cost Performance Index |
| SPI | EV / PV | Schedule Performance Index |
| CV | EV - AC | Cost Variance |
| SV | EV - PV | Schedule Variance |
| EAC | BAC / CPI | Estimate at Completion |
| ETC | EAC - AC | Estimate to Complete |
| VAC | BAC - EAC | Variance at Completion |

### EVM Forecasting

The `EVMForecastService` extends basic EVM with AI-powered forecasting:

- Predicted CPI and SPI for the next 4 weeks based on trend momentum
- AI-adjusted EAC with confidence range (low/high)
- Trend direction assessment: improving, stable, or deteriorating
- Cost overrun probability (0-100%)
- Corrective action recommendations with effort, priority, and estimated impact
- Narrative summary in plain language

### Early Warnings

Proactive alerts fire when CPI or SPI drop below configurable thresholds, enabling intervention before projects go off-track.

---

## 4. Resource Management

### Resource Pool

The `ResourceService` maintains a central resource registry. Each resource has:

- Name, email, role
- Capacity (hours per week, default 40)
- Skill tags
- Active/inactive status

The `GET /api/v1/resources` endpoint supports pagination via `?limit=` and `?offset=` query parameters (default limit 50, max 200). The response includes a `total` count for client-side pagination controls.

### Workload Heatmap

The resource workload endpoint aggregates task assignments across projects to produce a per-resource, per-day demand profile. Over-allocated days are flagged.

### Resource Histogram

The `ResourceLevelingService` generates daily demand histograms showing hours demanded vs. capacity for each resource. Over-allocations are returned as structured data for visualization.

### Resource Leveling

When over-allocations are detected, the leveling algorithm shifts non-critical tasks within their float to smooth demand below capacity. The result includes:

- Original vs. leveled demand profiles
- List of adjusted tasks with original and new dates
- Remaining over-allocations (if any cannot be resolved within float)

### Resource Optimization

The `ResourceOptimizerService` uses AI to analyze resource utilization patterns and recommend:

- Reallocation of underutilized resources
- Load balancing across team members
- Skill-based assignment optimization

### Resource Availability Calendar

Each resource has an availability calendar accessible from the Team tab. Managers can define blocks of time when a resource is unavailable or has reduced hours:

| Type | Effect |
|------|--------|
| **Vacation** | Resource fully unavailable for the date range |
| **Holiday** | Resource fully unavailable (company-wide) |
| **Unavailable** | Generic unavailability |
| **Reduced Hours** | Resource available for fewer hours/day |

The calendar displays a color-coded month grid (red=vacation, blue=holiday, gray=unavailable, amber=reduced). Workload heatmap calculations automatically account for availability blocks — when a resource has vacation during a week, their effective capacity is reduced proportionally.

**API endpoints:**
- `GET /api/v1/resources/:resourceId/availability?from=&to=`
- `POST /api/v1/resources/:resourceId/availability`
- `PUT /api/v1/resources/availability/:id`
- `DELETE /api/v1/resources/availability/:id`

---

## 5. Workflow Automation (DAG Engine)

### Overview

The `DagWorkflowService` implements a directed acyclic graph (DAG) execution engine. Workflows are composed of nodes connected by edges, with optional condition expressions on edges for branching.

### Node Types

| Node Type | Purpose |
|-----------|---------|
| **Trigger** | Entry point -- fires on entity events (e.g., task status change, priority escalation, task creation) |
| **Condition** | Evaluates a boolean expression against execution context |
| **Action** | Executes a side effect (update task, send notification, invoke agent, log activity) |
| **Approval** | Pauses execution until an authorized user approves or rejects |
| **Delay** | Pauses execution for a configurable duration |
| **Agent** | Invokes a registered AI agent capability with retry logic and configurable backoff |

### Trigger Types

| Trigger | Fires When | Optional Filters |
|---------|-----------|-----------------|
| `status_change` | Task status changes | `fromStatus`, `toStatus` |
| `progress_threshold` | Progress crosses a threshold | `progressThreshold`, `progressDirection` |
| `date_passed` | Task end date is in the past | -- |
| `task_created` | New task is created (oldTask is null) | `statusFilter` |
| `priority_change` | Task priority changes | `toPriority` |
| `assignment_change` | Task assignee changes | `toAssignee` |
| `dependency_change` | Task dependency changes | -- |
| `budget_threshold` | Project budget utilization crosses threshold | `thresholdPercent` |
| `project_status_change` | Project status changes | `fromStatus`, `toStatus` |
| `manual` | Triggered via API | -- |

### Action Types

| Action | Effect |
|--------|--------|
| `update_field` | Updates a task field to a specified value |
| `log_activity` | Logs an activity entry on the task |
| `send_notification` | Creates a real notification via NotificationService (notifies the project manager) |
| `invoke_agent` | Invokes a registered agent capability inline (e.g., auto-reschedule) |

### Event-Driven Execution

Workflows are triggered automatically by task and project lifecycle events:

- **Task events:** `ScheduleService.createTask()` and `updateTask()` call `evaluateTaskChange()` (fire-and-forget)
- **Project events:** `ProjectService.update()` calls `evaluateProjectChange()` on budget or status changes
- **Overdue scanner:** A 15-minute cron in `AgentSchedulerService` detects newly-overdue tasks and fires `date_passed` triggers

All event-driven calls are non-blocking -- they use `.catch()` so workflow failures never break task or project operations.

### Execution Model

- Each workflow definition is versioned and can be project-scoped or global
- Edges support condition expressions and sort ordering for deterministic branching
- Execution state is persisted per-node with statuses: pending, running, completed, failed, skipped, waiting
- Full execution history is retained with start/end timestamps and error messages
- Executions can be running, completed, failed, cancelled, or waiting (paused at an approval or delay node)
- All workflow actions are recorded in the audit ledger

---

## 6. Approval and Change Management

### Approval Workflows

The `ApprovalWorkflowService` defines multi-step approval chains scoped to a project and entity type. Each step specifies an approver role and execution order.

### Change Requests

Change requests capture proposed modifications with:

- Title, description, category, and priority
- Impact summary
- Status progression through workflow steps
- Link to an approval workflow (optional)
- Full action history with comments per step

### Approval Actions

Each step in a change request records: who acted, what action they took (approve/reject), optional comment, and timestamp. All actions are written to the audit ledger.

---

## 7. Sprint / Agile

### Sprint Planning

The `SprintService` manages time-boxed iterations with:

- Sprint name, goal, start date, end date
- Status: planning, active, completed
- Task assignment to sprints
- Sprint capacity tracking

### Sprint Board

A Kanban-style board scoped to a single sprint, showing tasks grouped by status with drag-and-drop support.

### Burndown Charts

The `BurndownService` computes daily remaining work for a sprint, producing the classic burndown line. Ideal burndown is plotted alongside actual for comparison.

### Velocity Tracking

Historical sprint velocity (story points or task count completed per sprint) is tracked across sprints to support future capacity planning.

---

## 8. Time Tracking

### Time Entries

The `TimeEntryService` records individual time logs:

- Associated task and project
- Hours worked, date, description
- Billable flag
- Created-by user

### Timesheets

Aggregated time entry views per user per week, suitable for approval workflows and payroll integration.

### Actual vs. Estimated

Compare logged hours against task estimated effort to identify underestimation patterns and improve future planning accuracy.

---

## 9. Custom Fields

### Per-Project Field Definitions

The `CustomFieldService` allows each project to define additional metadata fields:

| Field Type | Description |
|------------|-------------|
| **text** | Free-form string |
| **number** | Numeric value |
| **date** | Date picker |
| **dropdown** | Single-select from predefined options |
| **checkbox** | Boolean toggle |

Custom field values are stored per-entity (task, project) and included in search, filtering, and report outputs.

---

## 10. File Attachments

### Upload and Storage

The `FileAttachmentService` handles file uploads with:

- Configurable storage backend
- File size and type validation
- Unique file naming to prevent collisions

### Versioning

Multiple versions of a file can be uploaded to the same attachment slot. Previous versions are retained.

### Entity Linking

Attachments can be linked to any entity type (project, task, change request) via entity_type and entity_id references.

---

## 11. Monte Carlo Simulation

### Probabilistic Schedule Analysis

The `MonteCarloService` runs configurable simulations (default: 10,000 iterations) over the task dependency graph using PERT or triangular distributions derived from optimistic, most-likely, and pessimistic duration estimates.

### Outputs

- **Confidence levels**: P50, P80, P90 (or any custom percentiles) for project completion duration
- **Histogram**: distribution of simulated project durations in configurable bin widths
- **Sensitivity analysis**: which tasks contribute most to overall schedule variance
- **Criticality index**: percentage of iterations in which each task appears on the critical path
- **Tornado diagram data**: ranked sensitivity items for visualization

---

## 12. Network Diagrams

### PERT / Precedence Visualization

The `NetworkDiagramService` computes a layout of the task dependency graph suitable for rendering as a precedence diagram (Activity-on-Node). Each node includes:

- Task name, duration, ES, EF, LS, LF, total float
- Critical path flag
- X/Y position coordinates for rendering

Edges connect predecessor to successor nodes with critical-path highlighting.

---

## 13. AI Features

All AI features use the Anthropic Claude SDK and are gated behind the `AI_ENABLED` environment variable. When disabled, the system operates as a fully functional non-AI PM tool.

### Auto-Reschedule

The `AutoRescheduleService` detects delayed tasks and generates reschedule proposals:

1. Identifies tasks that have slipped past their planned dates
2. Analyzes downstream impact through the dependency graph
3. Uses AI to generate proposed date changes with rationale
4. Proposals are stored for review -- users accept, reject, or provide feedback

### Natural Language Queries

The `NLQueryService` implements a multi-step AI pipeline:

1. **Tool-loop phase**: Claude gathers real data using read-only tools (list projects, get EVM metrics, get critical path, get resource workload, etc.)
2. **Structuring phase**: raw answer is formatted into structured JSON with narrative, data tables, suggested charts, and follow-up questions

Users ask questions like "Which projects are over budget?" or "Show me the critical path for Project Alpha" and receive data-backed answers.

### Meeting Intelligence

The `MeetingIntelligenceService` processes meeting transcripts or notes to extract:

- Action items with assignees and due dates
- Key decisions made
- Risk items identified
- Follow-up topics

### Lessons Learned

The `LessonsLearnedService` captures and retrieves project retrospective insights, categorized and searchable, to improve future project execution.

### Task Prioritization

The `TaskPrioritizationService` uses AI to rank tasks based on:

- Dependency criticality
- Resource availability
- Deadline proximity
- Business impact

### Predictive Intelligence

The `predictiveIntelligence` module provides AI-driven assessments:

- **Project health scoring**: overall health grade with contributing factors
- **Risk assessment**: identified risks with probability, impact, and mitigation strategies
- **Budget forecasting**: AI-adjusted budget projections considering trends and project context
- **Dashboard predictions**: aggregated portfolio-level predictions

### Task Slip Prediction

The `predictTaskSlips()` method analyzes individual tasks to predict which are likely to slip, using deterministic scoring:

- **Overdue factor** (40%): Days past due relative to task duration
- **Progress gap** (30%): Actual vs expected progress based on elapsed time
- **Dependency factor** (20%): Incomplete predecessor count
- **Duration factor** (10%): Longer tasks carry higher inherent risk

Returns the top 20 at-risk tasks with slip probability, severity, reasons, and suggested actions. Available at `GET /api/v1/predictions/project/:projectId/task-slips`.

### Scope Creep Detector

Deterministic analysis comparing current project state against baselines:

- **Task count delta**: New tasks added since baseline
- **Estimate growth**: Cumulative duration increase across tasks
- **Change request count**: Open change requests
- **Schedule health**: Percentage of tasks on track or ahead

Severity thresholds: critical (10+ new tasks or 20+ days growth), high (5+/10+), medium (3+/5+ or 2+ change requests). Available at `GET /api/v1/predictions/project/:projectId/scope-creep`.

### AI Status Report Generator

One-click weekly status report generation from the project detail page. Uses Claude to produce a narrative markdown report with sections (Executive Summary, Key Metrics, Risks & Issues, Milestones, Recommendations). Supports copy-to-clipboard and download as `.md` file. Uses existing `POST /api/v1/ai-reports/generate` endpoint.

### Anomaly Detection

The `anomalyDetectionService` identifies unusual patterns in project data such as sudden progress drops, budget spikes, or resource utilization anomalies.

### What-If Scenarios

The `whatIfScenarioService` allows users to model hypothetical changes (adding resources, extending deadlines, changing scope) and see projected impacts before committing.

### Cross-Project Intelligence

The `crossProjectIntelligenceService` analyzes patterns across the entire portfolio to surface systemic risks, resource conflicts, and optimization opportunities.

### AI Chat

The `aiChatService` provides a conversational interface where users can ask open-ended questions about their projects and receive AI-generated responses grounded in actual project data. The chat panel supports **voice input** (browser Speech Recognition): users can click the mic, speak their message, and the transcript is sent as a normal chat message. Optional **text-to-speech** (“Speak replies”) reads the assistant’s replies aloud when enabled.

### AI Reports

The `aiReportService` generates narrative project reports using AI, summarizing status, risks, and recommendations in natural language.

### Proactive Alerts

The `proactiveAlertService` continuously monitors project metrics and generates alerts when thresholds are breached (schedule slip, budget overrun, resource over-allocation).

---

## 14. Reporting

### Custom Report Builder

The `ReportBuilderService` provides a configurable report engine:

- **Report templates**: saved configurations with named sections, sharable across users
- **Section types**: KPI cards, tables, bar charts, line charts, pie charts
- **Data sources**: projects, tasks, time entries, budgets
- **Filters**: date range, project, status
- **Group-by**: aggregate data by any dimension

### AI-Generated Reports

The AI report endpoint generates narrative compliance and status reports using Claude, grounded in real project data.

### Portfolio Analytics

The `AnalyticsSummaryService` computes portfolio-level KPIs:

- Total projects by status
- Budget utilization across portfolio
- Resource allocation summary
- Schedule performance overview

---

## 15. Notifications

### In-App Alerts

The `NotificationService` delivers notifications to users with:

- **Severity levels**: critical, high, medium, low
- **Type classification**: system, task, project, approval, alert
- **Entity linking**: link to specific project, schedule, or entity
- **Read/unread tracking**
- **WebSocket delivery**: real-time push via the `WebSocketService`
- **Bulk mark-as-read**

### Real-Time Presence

When multiple users view the same project, avatar circles appear in the project header showing who else is currently viewing. Presence is ephemeral (in-memory on the server) and updates instantly via WebSocket. Avatars show user initials with a tooltip displaying the full username. The current user is filtered out. Up to 5 avatars are shown, with a "+N" overflow indicator for larger teams.

### Email Notifications & Digests

Critical and high-severity notifications are automatically sent via email (Resend) to users with `emailNotificationsEnabled = true` and a verified email. Users can configure a **digest frequency** (none, daily, weekly) in Settings > Notifications. The `DigestService` runs daily at 7 AM via cron and sends a summary containing:

- **Overdue tasks** assigned to the user
- **Upcoming deadlines** (next 3 days)
- **Unread notification count**

Preferences are stored in the database (`users.email_notifications_enabled`, `users.digest_frequency`, `users.digest_last_sent_at`) and managed via `PUT /api/v1/users/me/notification-preferences`.

### Scheduled Report Delivery

Report templates from the Report Builder can be scheduled for automatic email delivery. Configuration is stored in the `report_schedules` table with:

- **Frequency**: daily, weekly (pick day of week), or monthly (pick day of month)
- **Time of day**: configurable delivery time
- **Recipients**: comma-separated email list
- **Format**: CSV attachment via Resend

The `ReportScheduleService` executes due schedules every 15 minutes via cron. Each execution generates the report, exports to CSV, and emails to all recipients. API endpoints at `/api/v1/report-schedules` provide full CRUD. The schedule modal is accessible via the clock icon on each report template card in the Report Builder.

---

## 16. Stakeholder Portal

### Token-Based Access

The `PortalService` generates shareable portal links with:

- Unique token per link
- Configurable permissions (read-only by default)
- Optional expiration date
- Active/inactive toggle
- Label for identification

### Public Views

Portal token holders can access without authentication:

- Project overview and status
- Gantt chart view
- Task listing

### Stakeholder Comments

External stakeholders can submit comments on project entities through the portal, identified by author name rather than system user account.

---

## 17. Intake Forms

### Dynamic Form Builder

The `IntakeFormService` supports creating intake forms with configurable fields:

- Field types: text, number, date, select, checkbox, textarea
- Required/optional validation
- Dropdown option lists
- Active/inactive form status

### Submission Tracking

Submissions flow through a review pipeline:

- Submitted -> Under Review -> Approved / Rejected
- Reviewer assignment and notes
- Conversion to project: approved submissions can be automatically converted into new projects

---

## 18. Templates

### Project Templates

The `TemplateService` allows saving a project's structure as a reusable template:

- Template name, description, category
- Serialized project configuration (tasks, phases, dependencies, custom fields)
- Shared or private visibility
- Apply a template to create a new project with pre-populated structure

---

## 19. Integrations

### Supported Providers

| Provider | Adapter | Capabilities |
|----------|---------|-------------|
| **Jira** | `JiraAdapter` | Bi-directional task sync, status mapping |
| **GitHub** | `GitHubAdapter` | Issue sync, PR status tracking |
| **Slack** | `SlackAdapter` | Notification delivery, channel updates |
| **Trello** | `TrelloAdapter` | Card sync, board mapping |

### Webhooks

The `WebhookService` allows registering outbound webhook endpoints that fire on configurable events (task created, status changed, project updated, etc.). Each delivery is logged with status and retry support.

### Integration Management

- Per-project or global integration configuration
- Credential storage in encrypted config blobs
- Sync logging with direction (inbound/outbound), item counts, and error tracking
- Last-sync timestamp for monitoring

---

## 20. Security

### Authentication

- **JWT tokens**: issued on login, stored in HttpOnly cookies with configurable expiration
- **Password hashing**: bcrypt with configurable salt rounds
- **Registration**: username, email, password, full name
- **Password reset**: token-based email flow via `EmailService`
- **Session management**: refresh token rotation
- **OAuth 2.1**: PKCE-based authorization for MCP HTTP transport (per-user access from Claude Desktop/Web)

### API Keys

The `ApiKeyService` issues scoped API keys for programmatic access:

- Scope-based permissions (read, write, admin)
- Key hashing (only prefix stored in plaintext for identification)
- Expiration support
- Revocation

### Audit Ledger (Hash-Chain)

The `AuditLedgerService` maintains a tamper-evident append-only log:

- Every entry references the previous entry's SHA-256 hash, forming a hash chain
- Entries record: actor (user/api_key/system), action, entity type/ID, project, payload, source (web/mcp/api/system), IP address, session
- Chain integrity can be verified at any time
- Filterable by project, entity, actor, action, date range

### Policy Engine

The `PolicyEngineService` enforces configurable governance rules:

- **Action patterns**: match against specific operations (e.g., `task.delete`, `budget.update`)
- **Condition expressions**: field-based conditions with operators (>, <, ==, !=, in, contains, etc.)
- **Enforcement levels**: log_only, require_approval, block
- **Evaluation logging**: every policy evaluation is recorded with context snapshot
- Project-scoped or global policies

### Security Middleware

- Content Security Policy (CSP) via Helmet
- Rate limiting per endpoint
- CORS protection with environment-aware origins
- Input validation via Zod schemas on all routes
- Scope-based route protection via `requireScope` middleware

---

## 21. MCP Server

### Overview

A standalone Model Context Protocol (MCP) server (`mcp-server/server.ts`) enables Claude Desktop and Claude Web to interact with PM Assistant directly. It communicates over stdio transport and authenticates via API key.

### Available Tools

| Tool | Description |
|------|-------------|
| `list-projects` | List all projects |
| `get-project` | Get project details by ID |
| `get-schedules` | Get all schedules for a project |
| `get-tasks` | Get all tasks in a schedule |
| `get-project-health` | AI health score for a project |
| `get-project-risks` | AI risk assessment for a project |
| `get-project-budget` | AI budget forecast for a project |
| `get-analytics` | Portfolio-level analytics summary |
| `get-alerts` | Proactive alerts across all projects |
| `search` | Search projects and tasks by keyword |
| `get-portfolio` | Full portfolio overview |

### MCP Proxy

The main application also exposes an `/mcp` reverse proxy route for HTTP-based MCP transport, allowing browser-based Claude integrations to connect through the production domain.

---

## 22. Billing

### Stripe Integration

The `StripeService` manages subscription billing:

- **Customer creation**: linked to user accounts
- **Checkout sessions**: redirect-based Stripe Checkout with 14-day free trial
- **Billing portal**: self-service subscription management via Stripe's portal
- **Webhook handling**: processes Stripe events for subscription lifecycle (created, updated, cancelled, payment succeeded/failed)
- **Tier support**: free, pro, business plans mapped to Stripe price IDs

---

## 23. Customizable Dashboard Widgets

Both the PM Dashboard and Executive Dashboard support customizable widget layouts. Users can toggle individual widgets on/off via a gear icon dropdown. Selections persist in `localStorage`.

**PM Dashboard widgets:**
- Stats overview (project/task counts)
- AI Summary Banner
- Active Projects table
- Recent Activity feed
- Resource Utilization overview
- Project Burndown progress bars

**Executive Dashboard widgets:**
- Portfolio stats
- Budget overview
- Resource summary
- AI Summary Banner
- Active Projects table
- Recent Activity feed
- Resource Utilization overview
- Project Burndown progress bars

Widgets render in a responsive CSS grid (1-3 columns depending on viewport). When all widgets are disabled, a "No widgets enabled" message is shown.

---

## 24. Mobile-Optimized Views

The application includes mobile-optimized layouts that activate automatically on screens narrower than 768px (the `useBreakpoint()` hook, shared across all pages).

### Bottom Navigation Bar

A fixed bottom navigation bar (`BottomNav`) replaces the sidebar on mobile, providing quick access to:
- Dashboard, Projects, Timesheet, Notifications, and More (opens sidebar overlay)

The main content area receives bottom padding (`pb-20`) to prevent overlap with the bottom nav.

### Mobile Task Cards

The `TaskCardMobile` component displays tasks in a touch-friendly card format with:
- Task name, status pill, priority badge, assignee, and due date
- Quick status cycle button (tap to advance: pending -> in_progress -> completed)
- Comfortable tap targets (min 56px height)

The `TaskListMobile` component wraps multiple cards with filter chips (status filter, "My Tasks" toggle).

### Mobile Schedule View

On mobile, the project Schedule tab automatically renders `TaskListMobile` instead of the Gantt/Kanban/Table/Calendar view toggle, providing a scrollable card-based task list.

### Mobile Timesheet

On mobile, the timesheet displays a card-per-day layout instead of the grid table. Each card shows the date, total hours, and a compact entry list. Week navigation is preserved.

---

## 25. Dark Mode

A global dark theme is available throughout the application. The user toggles it via the **dark mode button** in the TopBar. The selected theme is persisted in `themeStore` (localStorage) and applied immediately by adding the `dark` class to the root `<html>` element. All UI components use Tailwind `dark:` variant classes so colours, borders, and backgrounds switch automatically.

---

## 26. Project Milestones

Any task can be marked as a milestone by setting `is_milestone = true`. Milestone tasks render as **diamonds** on the Gantt chart (zero-width diamond icon centred on the task date) rather than as horizontal bars. Milestones are still full tasks — they carry status, assignee, and dependency information — but conventionally have zero estimated duration.

---

## 27. Multi-Dependency Support

Each task supports up to **20 predecessors**. Dependencies are stored in a `task_dependencies` junction table (with `ON DELETE CASCADE`) rather than columns on the task row, allowing any number of predecessors per task.

### Dependency Types and Lag

Each individual predecessor relationship carries its own type and optional lag:

| Type | Meaning |
|------|---------|
| **FS** (Finish-to-Start) | Successor starts after predecessor finishes (default) |
| **FF** (Finish-to-Finish) | Successor finishes no earlier than predecessor finishes |
| **SS** (Start-to-Start) | Successor starts no earlier than predecessor starts |
| **SF** (Start-to-Finish) | Successor finishes after predecessor starts |

An optional **lag** (positive integer, days) can be added to any individual dependency to introduce a waiting period. Negative lag (lead time) is also supported. CPM forward/backward pass calculations respect all four types and lag values across all predecessors, taking the maximum constraint when a task has multiple predecessors.

### API Payload

On task create and update, pass a `dependencies` array. Each entry has:

```json
{ "dependencyId": "<taskId>", "dependencyType": "FS", "lagDays": 0 }
```

Omitting `dependencies` leaves existing dependencies unchanged. Passing an empty array `[]` clears all predecessors.

### Predecessor Display Format

Multiple predecessors are displayed as a comma-separated list in compact **row-number notation** matching MS Project conventions:

| Display | Meaning |
|---------|---------|
| `3` | Finish-to-Start dependency on row 3 (FS is default, omitted for brevity) |
| `7SS` | Start-to-Start dependency on row 7 |
| `3FS+2d` | Finish-to-Start on row 3 with 2-day lag |
| `12FF-1d` | Finish-to-Finish on row 12 with 1-day negative lag (lead) |
| `3FS+2d,5SS,7` | Three predecessors on rows 3, 5, and 7 |

This format is also used in CSV export, matching MS Project's export convention.

### Dependency Health Badges

Each predecessor in the list displays a colour-coded health dot indicating that predecessor's status:

| Colour | Meaning |
|--------|---------|
| Green | Predecessor is **completed** — dependency satisfied |
| Yellow | Predecessor is **in progress** — being worked on |
| Red | Predecessor is **overdue** — not completed and past its end date |

Health badges appear in the Table view Predecessor column, the Gantt left panel Pred column, and Gantt bar tooltips. Dependency arrows on the Gantt chart are drawn for each predecessor and colour-coded by health status (green, yellow, or red).

### Inline Predecessor Editing

In Table view, the Predecessor column is inline-editable. Click a predecessor cell and type one or more predecessor entries separated by commas (e.g. `3`, `5SS`, `7FS+2d`, `3FS+2d,5SS,7`). The input is validated: invalid row numbers, self-references, duplicate entries, and malformed formats display a red error border with a message. Clearing the field removes all dependencies.

### Task Form Modal

The task form modal shows a multi-predecessor UI: a list of dependency rows, each with a predecessor selector, dependency type dropdown (FS/SS/FF/SF), and lag-days field. Use the **Add Predecessor** button to append a new row (up to the 20-predecessor limit) and the remove button on each row to delete it.

### Server-Side Dependency Validation

All dependency writes — API, UI, and AI tools — go through `validateDependency()` on the server for each dependency entry. The server is the single source of truth; no client-side pre-flight checks are needed. The following rules are enforced per dependency, returning HTTP 400 on violation:

| Rule | Error Message |
|------|---------------|
| **Self-reference** — a task cannot depend on itself | "A task cannot depend on itself" |
| **Nonexistent dependency** — the referenced task must exist | "Dependency task '{id}' not found" |
| **Cross-schedule** — both tasks must be in the same schedule | "Dependency must be in the same schedule" |
| **Circular dependency** — the dependency must not create a cycle (A→B→C→A) | "Circular dependency detected: the dependency task is already downstream of this task" |
| **Limit exceeded** — tasks may not have more than 20 predecessors | "A task cannot have more than 20 predecessors" |

**Orphan cleanup:** When a task is deleted, its row in `task_dependencies` is removed by `ON DELETE CASCADE` for both the predecessor and successor sides, so no dangling references remain.

---

## 28. Kanban WIP Limits

Each status column on the Kanban board can have a **Work-In-Progress (WIP) limit**. When a column's task count reaches the configured limit, the column header turns amber and further drops are visually flagged. WIP limits are set per-column from the Kanban toolbar and stored in `localStorage`. A limit of `0` means unlimited.

---

## 29. Comment @Mentions

When writing a task comment, typing `@` opens an autocomplete dropdown listing project members. Selecting a username inserts the mention token into the comment. When the comment is saved, the `NotificationService` creates an in-app notification for every mentioned user, linking back to the task.

---

## 30. Bulk Import (CSV / Excel)

Tasks can be imported in bulk from a CSV or Excel file via `POST /api/v1/schedules/:id/import`. The UI provides:

1. **Upload or paste** — drag-and-drop a `.csv`, `.xlsx`, or `.xls` file (max 5MB) or paste raw CSV text.
2. **Sheet selection** — for multi-sheet Excel files, a dropdown lets you choose which sheet to import.
3. **Column mapping** — map columns to task fields (name, start date, end date, estimated days, status, priority, assignee).
4. **Preview** — inspect the parsed rows before committing.
5. **Import** — valid rows are created as tasks via `scheduleService.createTask()` (with full dependency validation, audit logging, workflow triggers, sort order management, and WebSocket broadcasts); errors are reported per-row.

**Guardrails:**
- **Schedule validation** — the target schedule must exist (404 otherwise).
- **Duplicate detection** — rows with the same name + start date as an existing task (or earlier row in the same batch) are skipped.
- **File size limit** — 5MB enforced both client-side (before upload) and server-side (before parsing).
- **Row limit** — maximum 100 rows per import.

---

## 31. Gantt PDF Export

A **Print / Export PDF** button in the schedule toolbar calls `window.print()` with a print-optimised CSS stylesheet applied. The Gantt chart expands to show all tasks, hides navigation chrome, and formats page breaks appropriately. The result is a print-ready PDF when saved from the browser's print dialog.

---

## 32. Gantt Quick Search, Filter Panel & Saved Views

### Quick Search (Ctrl+F)

A **search bar** in the Gantt toolbar provides instant type-ahead filtering on task names. Press **Ctrl+F** to focus the search input. Typing filters the task list to show only tasks whose name contains the search term (case-insensitive substring match). Parent rows remain visible when any of their children match, preserving hierarchy context. A counter displays **"X / total tasks"** to indicate how many tasks match the current filter. Press **Escape** to clear the search and restore the full task list.

### Filter Panel

Click the **Filter** button (funnel icon) in the Gantt toolbar to open a collapsible filter panel. Available filters:

- **Status** — Multi-select checkboxes (Pending, In Progress, Completed, Cancelled).
- **Priority** — Multi-select checkboxes (Low, Medium, High, Critical).
- **Assignee** — Free-text search to filter by assignee name.
- **Date Range** — "Start After" and "Start Before" date pickers to narrow tasks by their start date.
- **Progress Range** — Min and Max percentage sliders/inputs to filter by completion percentage.

All active filters are combined with **AND** logic — a task must satisfy every filter to appear. Parent rows remain visible when any descendant matches, maintaining the hierarchy. An **active filter count badge** appears on the Filter button showing how many filters are currently applied. A **"Clear All"** button inside the panel resets every filter at once.

### Saved Views

The existing **SavedViewsDropdown** component is wired into the Gantt toolbar. It allows users to save and load named view configurations that capture:

- **Visible columns** — which left-panel columns are shown or hidden.
- **Sort field and direction** — the active column sort (ascending, descending, or none).
- **Zoom level** — the selected timescale (Day, Week, Month, Quarter, Year).

Saved views are stored in **localStorage** with a `gantt:` prefix to keep them separate from Table view configurations. Select a saved view from the dropdown to instantly restore its settings; create new views or delete existing ones from the same dropdown.

---

## 33. Goals / OKR Tracking

The Goals module provides Objectives and Key Results (OKR) tracking alongside traditional project scheduling.

- **Objectives** — High-level goals with a title, description, owner, and time period.
- **Key Results** — Measurable outcomes nested under an objective, each with a numeric target, current value, and unit.
- **Progress** — Automatically calculated from key result completion percentages.
- **Project linking** — OKRs can be associated with one or more projects to show how project work contributes to strategic goals.

**API endpoints:** `GET/POST /api/v1/goals`, `GET/PUT/DELETE /api/v1/goals/:id`.

---

## 33. Time Zone Support

Each user can set a preferred timezone in **Settings → Preferences** (stored via `PUT /api/v1/users/me/preferences`). All date and time values rendered in the UI are converted to the user's timezone using the stored IANA timezone string (e.g., `America/Toronto`). Server timestamps remain in UTC; conversion happens client-side. When no preference is set the browser's local timezone is used as a fallback.

---

## 34. Multi-Language (i18n)

The frontend supports **English (en)**, **French (fr)**, and **Spanish (es)**. The active locale is managed by `localeStore` (Zustand, persisted in localStorage) and consumed via the `useTranslation()` hook. All user-facing strings are keyed through the translation map; switching locale applies immediately without a page reload. The locale can be changed from **Settings → Language**.

---

## Technical Architecture

### Backend

- **Runtime**: Node.js 22 with TypeScript
- **Framework**: Fastify (high-performance HTTP server)
- **Database**: MySQL (MariaDB compatible)
- **Validation**: Zod schemas on all API inputs
- **AI**: Anthropic Claude SDK (gated by `AI_ENABLED` env var)
- **Real-time**: WebSocket service for live notifications
- **Email**: Configurable email service for password reset and notifications
- **Service layer**: Stateless services use module-level singletons to avoid redundant instantiation and preserve in-memory caches (e.g., EmbeddingService). Internal queries include safety `LIMIT 1000` on unbounded SELECTs; public list endpoints use proper pagination.

### Frontend

- **Framework**: React 18
- **Build tool**: Vite
- **State management**: Zustand
- **Server state**: React Query (TanStack Query)
- **Styling**: Tailwind CSS
- **PWA**: Service worker with offline caching, install prompts, push notifications

### API Structure

All API routes are prefixed with `/api/v1/` and organized by domain:

```
/api/v1/auth              Authentication (login, register, reset password)
/api/v1/projects          Project CRUD
/api/v1/schedules         Schedule and task management
/api/v1/resources         Resource pool management (paginated)
/api/v1/sprints           Sprint lifecycle
/api/v1/time-entries      Time logging
/api/v1/custom-fields     Custom field definitions and values
/api/v1/attachments       File upload and management
/api/v1/notifications     In-app notifications
/api/v1/portal            Stakeholder portal (public + admin)
/api/v1/intake            Form builder and submissions
/api/v1/templates         Project templates
/api/v1/integrations      Third-party integration management
/api/v1/webhooks          Outbound webhook configuration
/api/v1/workflows         DAG workflow definitions and execution
/api/v1/approvals         Change request approval chains
/api/v1/report-builder    Custom report templates and generation
/api/v1/report-schedules  Scheduled report delivery CRUD
/api/v1/ai-reports        AI-generated narrative reports
/api/v1/stripe            Billing and subscription management
/api/v1/api-keys          API key management
/api/v1/audit             Audit ledger queries
/api/v1/policies          Policy engine rules
/api/v1/search            Full-text search
/api/v1/bulk              Bulk operations
/api/v1/portfolio         Portfolio overview
/api/v1/analytics         Portfolio analytics summary
/api/v1/alerts            Proactive alert feed
/api/v1/predictions       AI health, risk, and budget predictions
/api/v1/intelligence      Cross-project intelligence and anomaly detection
/api/v1/evm-forecast      Earned value forecasting
/api/v1/monte-carlo       Monte Carlo simulation
/api/v1/network-diagram   Precedence diagram layout
/api/v1/burndown          Sprint burndown data
/api/v1/resource-leveling Resource histogram and leveling
/api/v1/resource-optimizer AI resource optimization
/api/v1/auto-reschedule   Auto-reschedule proposals
/api/v1/nl-query          Natural language queries
/api/v1/ai-scheduling     AI task breakdown and scheduling
/api/v1/ai-chat           Conversational AI interface
/api/v1/task-prioritization  AI task ranking
/api/v1/meeting-intelligence Meeting transcript analysis
/api/v1/lessons-learned   Retrospective knowledge base
/api/v1/learning          AI learning feedback
/api/v1/exports           Data export
/api/v1/agent             Agent scheduler (14 agents)
/api/v1/agent-log         Agent activity log
/api/v1/agent/proposals   Agent proposal management
/api/v1/agent/autonomy    Tier 3 autonomy configuration
/api/v1/users             User management
/api/v1/project-members   Project membership
/api/v1/rag               Semantic search (RAG)
/api/v1/ws                WebSocket connections
/mcp                      MCP HTTP transport proxy
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | production / development |
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Token signing secret |
| `COOKIE_SECRET` | Cookie signing secret |
| `CORS_ORIGIN` | Allowed origin for CORS |
| `AI_ENABLED` | Enable/disable AI features (true/false) |
| `ANTHROPIC_API_KEY` | Claude API key (required if AI_ENABLED) |
| `STRIPE_SECRET_KEY` | Stripe secret key (optional) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `APP_URL` | Public application URL |
| `PM_API_KEY` | API key for MCP server |
| `PM_BASE_URL` | Base URL for MCP server API calls |

---

## Getting Started

### Prerequisites

- Node.js 22+
- MySQL 8.0+ (or MariaDB 10.5+)
- npm

### Installation

```bash
git clone <repository-url>
cd pm-assistant-generic
npm install

# Copy and configure environment
cp env.example .env
# Edit .env with your database credentials and secrets

# Start development servers
npm run dev
```

### Access Points

| Endpoint | URL |
|----------|-----|
| Application | http://localhost:3000 |
| API | http://localhost:3001 |
| API Documentation | http://localhost:3001/documentation |
| Health Check | http://localhost:3001/health (returns DB status, memory usage, overall health — 200 OK or 503 DEGRADED) |

### Production Build

```bash
npm run build
```

The build produces a `dist/` directory with compiled server and optimized client assets. In production, static files are served by the web server (e.g., LiteSpeed, Nginx) and API requests are proxied to the Fastify process.
