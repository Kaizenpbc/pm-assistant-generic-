# PM Assistant

**Enterprise Project Management Platform with AI Co-Pilot**

A full-featured, production-grade project management SaaS application combining traditional PM methodologies (CPM, EVM, Agile) with AI-powered intelligence. Built with Fastify, React, and the Anthropic Claude SDK.

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
| **Auth** | JWT (access + refresh tokens) with HttpOnly cookies |
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
- Multiple views: Gantt chart, Kanban board, Calendar, Table
- Task hierarchy with summary task auto-calculation
- Dependency management with predecessor/successor relationships
- Drag-and-drop scheduling

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
- **Anomaly Detection** -- Proactive alerts for unusual patterns
- **Cross-Project Intelligence** -- Insights across the portfolio
- **What-If Scenario Modeling** -- Simulate schedule and resource changes

### Reporting & Analytics
- Custom report builder with saved templates
- Portfolio-level analytics and executive dashboards
- Project health scoring
- Exportable reports

### Notifications
- In-app notification center
- Real-time WebSocket push notifications
- Configurable notification preferences

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
│   │   ├── routes/              # 50+ route modules
│   │   ├── services/            # Business logic & AI services
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
| Agent | `/api/v1/agent` | Agent scheduler |
| Agent Log | `/api/v1/agent-log` | Agent activity log |
| RAG | `/api/v1/rag` | Semantic search |
| WebSocket | `/api/v1/ws` | Real-time updates |
| MCP | `/mcp` | MCP HTTP transport proxy |

---

## License

MIT
