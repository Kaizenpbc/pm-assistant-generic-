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
- Dependency linking (finish-to-start)
- Estimated duration (days) and work effort
- Assigned resource
- Parent-child hierarchy (subtasks)
- Risk and issue annotations
- Progress percentage tracking

### Views

- **Gantt chart** -- interactive timeline with dependency arrows and critical path highlighting
- **Kanban board** -- drag-and-drop cards grouped by status
- **Calendar view** -- tasks plotted on a monthly/weekly calendar
- **Table view** -- sortable, filterable spreadsheet-style listing

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

### Anomaly Detection

The `anomalyDetectionService` identifies unusual patterns in project data such as sudden progress drops, budget spikes, or resource utilization anomalies.

### What-If Scenarios

The `whatIfScenarioService` allows users to model hypothetical changes (adding resources, extending deadlines, changing scope) and see projected impacts before committing.

### Cross-Project Intelligence

The `crossProjectIntelligenceService` analyzes patterns across the entire portfolio to surface systemic risks, resource conflicts, and optimization opportunities.

### AI Chat

The `aiChatService` provides a conversational interface where users can ask open-ended questions about their projects and receive AI-generated responses grounded in actual project data.

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
/api/v1/agent             Agent scheduler
/api/v1/agent-log         Agent activity log
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
