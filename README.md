# PM Assistant

**Enterprise Project Management Platform with Agentic AI**

A full-featured, production-grade project management SaaS application combining traditional PM methodologies (CPM, EVM, Agile) with an autonomous AI agent system. 14 specialized agents continuously monitor projects, reason about issues via Claude, and propose (or auto-execute) corrective actions — all with human-in-the-loop governance, confidence scoring, and full audit trails. Built with Fastify, React, and the Anthropic Claude SDK.

**Live:** [https://pm.kpbc.ca](https://pm.kpbc.ca)

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Feature Overview](#feature-overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [MCP Server](#mcp-server)
- [Development Commands](#development-commands)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [License](#license)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Fastify 5 + TypeScript, Node.js 22 |
| **Frontend** | React 18 + Vite + Tailwind CSS + Zustand |
| **Database** | MySQL / MariaDB |
| **AI** | Anthropic Claude SDK (optional, via `AI_ENABLED` env var) |
| **Auth** | JWT (access + refresh tokens) with HttpOnly cookies; OAuth 2.1 with PKCE for MCP transport |
| **Real-time** | WebSocket + Server-Sent Events (SSE) |
| **Billing** | Stripe |
| **Validation** | Zod |
| **API Docs** | OpenAPI / Swagger |
| **MCP** | Model Context Protocol server for Claude Desktop and Claude Web |
| **Deployment** | LiteSpeed (static assets) + Passenger (Node.js API) on TMD Hosting |

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
cd src/client && npm install && cd ../..
```

### 2. Environment Setup

```bash
cp env.example .env
```

Edit `.env` with your database credentials, JWT secrets, and optional integrations. See [Environment Variables](#environment-variables) for the full list.

### 3. Start Development

```bash
npm run dev
```

This starts both the Fastify API server and the Vite dev server concurrently.

- **Application:** http://localhost:5173
- **API:** http://localhost:3001
- **Swagger Docs:** http://localhost:3001/documentation
- **Health Check:** http://localhost:3001/health — returns database connectivity, memory usage, and overall system status (200 OK / 503 DEGRADED)

**Default login:** `admin` / `admin123`

---

## Feature Overview

### Project & Schedule Management
- Full CRUD for projects, tasks, and schedules
- Multiple views: Gantt chart, Kanban board, Calendar, Table (with MS Project-style column picker and saved views)
- Gantt drag-and-drop rescheduling (move and resize task bars)
- Task hierarchy with summary task auto-calculation
- Multi-dependency support: up to 20 predecessors per task (FS/SS/FF/SF + lag), stored in a `task_dependencies` junction table
- MS Project-style predecessor notation (e.g. "3FS+2d,5SS,7") with health badges and inline editing in Table view
- Recurring tasks (daily, weekly, biweekly, monthly) with auto-generation
- Customizable dashboard widgets with per-user persistence
- Real-time presence indicators showing who is viewing a project

### Critical Path Method (CPM)
- Forward and backward pass computation
- Critical path identification and highlighting
- Float/slack calculation
- Network diagram visualization

### Baseline Management
- Create, compare, and track schedule baselines
- Variance analysis between baseline and current schedule

### Earned Value Management (EVM)
- PV, EV, AC, SPI, CPI, EAC, ETC, VAC, TCPI metrics
- S-curve visualization
- Performance forecasting with trend analysis

### Resource Management
- Resource pool with roles, capacity, and cost rates
- Workload heatmap visualization
- Resource leveling algorithm
- Resource optimization suggestions
- Resource availability calendar (vacation, holiday, unavailable, reduced hours)

### DAG Workflow Engine
- Declarative directed acyclic graph workflows
- Six node types: trigger, condition, action, approval, delay, agent
- Event-driven triggers: status_change, progress_threshold, date_passed, task_created, priority_change, assignment_change, dependency_change, budget_threshold, project_status_change
- Task lifecycle events (create/update) automatically fire matching workflows
- Project-level events (budget changes, status changes) trigger workflows via `evaluateProjectChange()`
- Actions: update_field, log_activity, send_notification (creates real notifications), invoke_agent
- Agent nodes with retry logic and configurable backoff
- 15-minute overdue-task scanner triggers `date_passed` workflows automatically
- Persistent execution with per-node status tracking
- Approval gates that pause execution pending human review
- Condition branching with field-based operator evaluation
- Full audit integration

### Approval Workflows & Change Requests
- Multi-level approval chains
- Change request tracking with impact analysis
- Status lifecycle management

### Sprint / Agile Management
- Sprint planning with backlog grooming
- Kanban sprint board
- Burndown and velocity charts
- Sprint retrospective support

### Time Tracking & Timesheets
- Per-task time entry logging
- Weekly timesheet views
- Actual vs. estimated comparison

### Custom Fields
- Per-project custom field definitions
- Text, number, date, select, and multi-select types

### File Attachments
- Upload and attach files to tasks and projects
- Version history tracking

### Monte Carlo Simulation
- Schedule risk analysis via Monte Carlo simulation
- Probability distribution for project completion dates

### AI Features (requires `AI_ENABLED=true`)
- **Auto-Reschedule** -- AI-driven schedule optimization
- **Natural Language Queries** -- Ask questions about project data in plain English
- **Meeting Intelligence** -- Automated meeting minutes and action item extraction
- **Lessons Learned** -- AI-assisted capture and retrieval of project lessons
- **Task Prioritization** -- Intelligent priority scoring
- **Predictive Intelligence** -- Forecast delays, cost overruns, and risks
- **Task Slip Predictor** -- Identifies which tasks are likely to slip with confidence scores and reasons
- **Scope Creep Detector** -- Compares current state against baselines to flag unauthorized scope growth
- **Status Report Generator** -- One-click AI-generated weekly status reports with copy/download
- **Anomaly Detection** -- Proactive alerts for unusual patterns
- **Cross-Project Intelligence** -- Insights across the portfolio
- **What-If Scenario Modeling** -- Simulate schedule and resource changes

### Agentic System (requires `AGENT_ENABLED=true`)
- **Agentic Proposals** -- Agents autonomously detect issues, reason about root causes via Claude, and propose concrete recovery actions for human approval
- **Schedule Recovery Agent** -- Detects schedule delays, reasons about root cause, proposes task date/resource changes
- **Scope Creep Detection Agent** -- Monitors task growth, estimate increases, and change requests against baselines; alerts when scope creep is detected
- **Budget Intelligence Agent** -- Analyzes EVM metrics (CPI, SPI, VAC, EAC), identifies root causes of cost deviations via Claude reasoning, proposes corrective actions
- **Resource Optimization Agent** -- Detects over-allocated (>100%) and under-utilized (<40%) resources, identifies bottleneck roles, proposes rebalancing actions via Claude reasoning
- **Cross-Project Intelligence Agent** -- Portfolio-level analysis: identifies systemic risks, common patterns, resource contention, and cascading delays across all active projects
- **Risk Escalation Agent** -- Runs last in each scan; detects compound risks where 2+ agents flag the same project (e.g., schedule delay + budget overrun + resource bottleneck), escalates to management
- **Stakeholder Communication Agent** -- Auto-generates stakeholder status reports with executive summaries, key highlights, risks/concerns, upcoming milestones, and recommended actions
- **Project Hygiene Agent** -- Detects stale tasks (14+ days), missing dates/estimates, unassigned tasks, abandoned sprints, and zero-progress in-progress tasks
- **Dependency Risk Agent** -- Analyzes task dependency graphs to detect blocked chains, bottleneck tasks (3+ dependents), and long dependency chains (depth > 5)
- **Lessons Learned Agent** -- Auto-extracts lessons when projects reach 90%+ completion or are completed; stores lessons for RAG retrieval and future project improvement
- **Predictive Alerting Agent** -- Pattern-based early warnings using velocity trends, progress-vs-time trajectory, risk accumulation, and similar project comparison
- **Autonomous Execution (Tier 3)** -- Agents with proven track records (30+ days, 20+ proposals, 80%+ acceptance, zero rollbacks) can be promoted to auto-execute low-risk, high-confidence proposals
- **Confidence Scoring** -- Weighted confidence (data quality + historical accuracy + model certainty) controls what agents can propose
- **Proposal Lifecycle** -- pending -> approved/rejected -> executed/rolled_back with full audit trail
- **Emergency Kill Switch** -- Global, per-agent, and per-project agent shutdown via API with audit logging
- **Rate Limiting** -- Per-agent and all-agent rate limits prevent alert fatigue (3/agent/24h, 10/all/24h)
- **Circuit Breakers** -- Per-agent circuit breakers open after 3 consecutive failures, auto-retry after cooldown
- **Degradation Handling** -- Graceful scope reduction when Claude API or database is unhealthy
- **Feedback Loop** -- Users rate proposal outcomes; feedback improves future confidence scores
- **Agent Proposals UI** -- Dedicated page (`/agent`) for managers/admins to review, approve/reject, execute, rollback, and rate agent proposals with full reasoning and action detail

### Reporting & Analytics
- Custom report builder with saved templates
- Portfolio-level analytics and executive dashboards
- Project health scoring
- Exportable reports
- Scheduled report delivery via email (daily/weekly/monthly CSV)

### Notifications
- In-app notification center
- Real-time WebSocket push notifications
- Configurable notification preferences
- Email notifications for critical/high severity events
- Daily and weekly email digests (overdue tasks, upcoming deadlines, unread count)

### Client / Stakeholder Portal
- External-facing read-only project views
- Scoped access for stakeholders

### Intake Forms
- Configurable intake form builder
- Submission review and approval workflow

### Project Templates
- Save and apply project templates
- Pre-configured task structures and workflows

### External Integrations
- Jira, GitHub, Slack, and Trello integration adapters
- Bi-directional sync support (partial — adapter framework implemented)

### Webhooks
- Configurable outbound webhooks for project events
- Retry logic and delivery logs

### API Key Management
- API key generation and revocation
- Per-key rate limiting and scope control

### Immutable Audit Ledger
- Hash-chain integrity for all audit records
- Tamper-evident logging of every mutation
- Full audit trail with actor, action, and timestamp

### Policy Engine
- Configurable policy rules evaluated on project events
- Automated enforcement of organizational standards

### Billing (Stripe)
- Subscription management with tiered pricing
- Usage-based billing support
- Stripe Checkout and customer portal integration

### Progressive Web App (PWA)
- Offline capability via service worker
- Installable on desktop and mobile
- Push notification support

### Mobile-Optimized Views
- Bottom navigation bar for mobile devices
- Card-based mobile task list with quick status cycling
- Mobile-friendly timesheet with day-by-day card layout
- Responsive schedule views (auto-switches to mobile on small screens)

### Dark Mode
- Global dark theme with Tailwind `dark:` classes throughout
- Toggle in the TopBar; preference persisted in `themeStore` (localStorage)

### Project Milestones
- Tasks flagged as milestones (`is_milestone`) render as diamonds on the Gantt chart

### Multi-Dependency Support
- Up to 20 predecessors per task, each with its own type (FS/FF/SS/SF) and lag days
- Stored in `task_dependencies` junction table with `ON DELETE CASCADE`
- API: `dependencies[]` array on create/update payloads (`dependencyId`, `dependencyType`, `lagDays`)
- MS Project-style comma-separated row-number notation in Table view and Gantt left panel (e.g. "3FS+2d,5SS,7"); same format in CSV export
- Dependency health badges per predecessor: green (completed), yellow (in progress), red (overdue)
- Gantt arrows drawn per predecessor, color-coded by health status
- Task form modal: multi-predecessor UI with add/remove rows, type dropdown, and lag field per entry
- Inline predecessor editing in Table view with comma-separated syntax and validation
- Server-side validation per dependency: self-reference, circular, cross-schedule, existence, and 20-predecessor limit (400 errors)
- Orphan cleanup via `ON DELETE CASCADE` — deleting a task removes all its dependency records automatically

### Kanban WIP Limits
- Per-column Work-In-Progress limits on the Kanban board
- Limits stored in localStorage; columns visually flag when the limit is exceeded

### Comment @Mentions
- `@username` autocomplete in task comment input
- Mentioned users receive in-app notifications automatically

### Bulk Import (CSV / Excel)
- Upload CSV or Excel (.xlsx, .xls) files to import tasks into a schedule
- Multi-sheet Excel support with sheet selector
- Column mapping UI with preview before import is committed
- Duplicate detection (same name + start date skipped)
- 5MB file size limit (client and server enforced)
- Schedule existence validation before import

### Gantt PDF Export
- Print-friendly Gantt export via `window.print()`; triggered from the schedule toolbar

### Goals / OKR Tracking
- Objectives and Key Results with progress tracking and nested hierarchy
- OKRs can be linked to projects for portfolio alignment

### Time Zone Support
- Per-user timezone preference; all dates displayed in the user's local timezone
- Preference stored server-side and applied on the frontend

### Multi-Language (i18n)
- English, French, and Spanish translations
- Locale selection in user settings; active locale managed via `localeStore` and `useTranslation` hook

---

## Architecture

```
                    +-----------+
                    | LiteSpeed |  (static assets: HTML, CSS, JS, images)
                    +-----+-----+
                          |
              +-----------+-----------+
              |                       |
        /api/* routes           static files
              |
     +--------v--------+
     |  Passenger (Node) |
     +--------+---------+
              |
     +--------v---------+
     |   Fastify Server  |
     |  (TypeScript API) |
     +--------+---------+
              |
    +---------+---------+
    |         |         |
    v         v         v
  MySQL    Claude    Stripe
 (MariaDB)  (AI)   (Billing)
```

- **Frontend** is a Vite-built React SPA served as static files by LiteSpeed.
- **Backend** is a Fastify app running under Passenger, handling all `/api/v1/` routes.
- **WebSocket** connections are managed by `@fastify/websocket` for real-time updates.
- **MCP Server** runs as a separate process, exposing PM tools via the Model Context Protocol.

---

## Project Structure

```
pm-assistant-generic/
├── src/
│   ├── server/                  # Fastify backend
│   │   ├── routes/              # 50+ route modules (8 domain subdirectories)
│   │   ├── services/            # Business logic & AI services
│   │   │   └── agents/          # Agentic pipeline (reasoning, proposals, execution)
│   │   ├── middleware/          # Auth, rate limiting, policies
│   │   ├── database/            # Migrations, seeds, connection pool
│   │   └── config.ts            # Environment-based configuration
│   ├── client/                  # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── pages/           # 30+ page components
│   │   │   ├── components/      # Reusable UI components
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── services/        # API client layer
│   │   │   └── stores/          # Zustand state stores
│   │   └── vite.config.ts
│   └── shared/                  # Shared types, schemas, utilities
├── mcp-server/                  # MCP server for Claude integration
│   ├── server.ts                # MCP tool definitions & handlers
│   └── package.json
├── demo-agent/                  # CLI demo agent
│   ├── agent.ts
│   └── package.json
├── scripts/                     # DB backup/restore, deployment
├── env.example                  # Environment variable template
├── package.json
└── tsconfig.json
```

---

## MCP Server

The MCP (Model Context Protocol) server exposes 11 tools that allow Claude Desktop and Claude Web to interact with PM Assistant directly:

- `list-projects` / `get-project` — Project listing and details
- `get-schedules` / `get-tasks` — Schedule and task data
- `get-project-health` / `get-project-risks` / `get-project-budget` — AI-powered assessments
- `get-analytics` — Portfolio-level analytics summary
- `get-alerts` — Proactive alerts across all projects
- `search` — Search projects and tasks by keyword
- `get-portfolio` — Full portfolio overview

See `mcp-server/` for setup instructions and tool definitions.

---

## Development Commands

```bash
# Development
npm run dev                  # Start API + client concurrently
npm run server:dev           # Start Fastify server only (with nodemon)
npm run client:dev           # Start Vite dev server only

# Build
npm run build                # Build server + client for production
npm run build:server         # TypeScript compile (server)
npm run build:client         # Vite build (client)

# Production
npm run start                # Start compiled server (serves API + static)

# Database
npm run db:migrate           # Run database migrations
npm run db:seed              # Seed initial data

# Testing
npm run test                 # Run tests (Vitest)
npm run test:unit            # Run unit tests once

# Code Quality
npm run lint                 # ESLint check
npm run lint:fix             # ESLint auto-fix
npm run type-check           # TypeScript type check (no emit)
```

---

## Environment Variables

Copy `env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_HOST` | MySQL host | Yes |
| `DB_PORT` | MySQL port (default: 3306) | Yes |
| `DB_USER` | MySQL username | Yes |
| `DB_PASSWORD` | MySQL password | Yes |
| `DB_NAME` | MySQL database name | Yes |
| `JWT_SECRET` | Secret for signing access tokens | Yes |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | Yes |
| `COOKIE_SECRET` | Secret for cookie signing | Yes |
| `PORT` | API server port (default: 3001) | No |
| `AI_ENABLED` | Enable AI features (`true` / `false`) | No |
| `ANTHROPIC_API_KEY` | Anthropic API key (required if AI enabled) | No |
| `STRIPE_SECRET_KEY` | Stripe secret key | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | No |
| `RESEND_API_KEY` | Resend API key for transactional email | No |

Generate secrets with:

```bash
openssl rand -base64 32
```

---

## API Documentation

Interactive Swagger documentation is available at `/documentation` when the server is running.

All API endpoints are versioned under `/api/v1/`. Endpoint groups (50+ route modules):

| Group | Prefix | Purpose |
|-------|--------|---------|
| Auth | `/api/v1/auth` | Login, register, refresh, logout, password reset |
| Projects | `/api/v1/projects` | Project CRUD and membership |
| Users | `/api/v1/users` | User management |
| Schedules | `/api/v1/schedules` | Schedule and task management |
| Sprints | `/api/v1/sprints` | Sprint lifecycle |
| Resources | `/api/v1/resources` | Resource pool (paginated: `?limit=&offset=`) |
| Time Entries | `/api/v1/time-entries` | Time tracking |
| Custom Fields | `/api/v1/custom-fields` | Custom field definitions and values |
| Attachments | `/api/v1/attachments` | File upload and management |
| Notifications | `/api/v1/notifications` | In-app notification center |
| Portal | `/api/v1/portal` | Stakeholder portal |
| Intake | `/api/v1/intake` | Intake form builder and submissions |
| Templates | `/api/v1/templates` | Project templates |
| Integrations | `/api/v1/integrations` | Third-party integrations |
| Webhooks | `/api/v1/webhooks` | Outbound webhook management |
| Workflows | `/api/v1/workflows` | DAG workflow engine |
| Approvals | `/api/v1/approvals` | Change request approval chains |
| Report Builder | `/api/v1/report-builder` | Custom report templates |
| AI Reports | `/api/v1/ai-reports` | AI-generated narrative reports |
| Stripe | `/api/v1/stripe` | Billing and subscriptions |
| API Keys | `/api/v1/api-keys` | API key management |
| Audit | `/api/v1/audit` | Immutable audit ledger |
| Policies | `/api/v1/policies` | Policy engine rules |
| Search | `/api/v1/search` | Full-text search |
| Bulk | `/api/v1/bulk` | Bulk operations |
| Portfolio | `/api/v1/portfolio` | Portfolio overview |
| Analytics | `/api/v1/analytics` | Portfolio analytics summary |
| Alerts | `/api/v1/alerts` | Proactive alert feed |
| Predictions | `/api/v1/predictions` | AI health, risk, budget predictions |
| Intelligence | `/api/v1/intelligence` | Cross-project intelligence |
| EVM Forecast | `/api/v1/evm-forecast` | Earned value forecasting |
| Monte Carlo | `/api/v1/monte-carlo` | Monte Carlo simulation |
| Network Diagram | `/api/v1/network-diagram` | Precedence diagram layout |
| Burndown | `/api/v1/burndown` | Sprint burndown data |
| Resource Leveling | `/api/v1/resource-leveling` | Histogram and leveling |
| Resource Optimizer | `/api/v1/resource-optimizer` | AI resource optimization |
| Auto-Reschedule | `/api/v1/auto-reschedule` | AI reschedule proposals |
| NL Query | `/api/v1/nl-query` | Natural language queries |
| AI Scheduling | `/api/v1/ai-scheduling` | AI task breakdown |
| AI Chat | `/api/v1/ai-chat` | Conversational AI |
| Task Prioritization | `/api/v1/task-prioritization` | AI task ranking |
| Meeting Intelligence | `/api/v1/meeting-intelligence` | Transcript analysis |
| Lessons Learned | `/api/v1/lessons-learned` | Retrospective knowledge base |
| Learning | `/api/v1/learning` | AI learning feedback |
| Exports | `/api/v1/exports` | Data export |
| Agent | `/api/v1/agent` | Agent scheduler, health, and kill switch |
| Agent Proposals | `/api/v1/agent/proposals` | Proposal lifecycle (list, approve, reject, execute, feedback) |
| Agent Autonomy | `/api/v1/agent/autonomy` | Tier 3 autonomy configuration, promotion/demotion |
| Agent Log | `/api/v1/agent-log` | Agent activity log |
| RAG | `/api/v1/rag` | Semantic search |
| WebSocket | `/api/v1/ws` | Real-time updates |
| MCP | `/mcp` | MCP HTTP transport proxy |
| Goals / OKR | `/api/v1/goals` | Objectives and Key Results CRUD |
| Task Import | `/api/v1/schedules/:id/import` | Bulk CSV task import |
| User Preferences | `/api/v1/users/me/preferences` | Timezone and locale preferences |

---

## License

MIT
