# PM Assistant -- Admin Manual

This manual is for **system administrators** who manage users, projects, and platform configuration for PM Assistant, an enterprise project management platform.

---

## 1. Roles and Access

| Role          | Access                                                              |
|---------------|---------------------------------------------------------------------|
| **admin**     | Full access: all users, projects, system settings, billing, audit.  |
| **executive** | Read-only portfolio view, analytics dashboards, KPI summaries.      |
| **manager**   | Create/manage projects, assign members, run reports, approve tasks. |
| **member**    | View and work on assigned projects, log time, update tasks.         |

Admins can manage all aspects of the platform. Managers operate within projects they own or are assigned to. Members participate in their assigned work.

---

## 2. User Management

### Creating Users
- Navigate to **Settings > Users > Add User**.
- Provide name, email, role, and initial password.
- Users receive an email invitation if SMTP is configured.

### Editing Users
- Update role, display name, email, or deactivate accounts.
- Role changes take effect on the user's next request (JWT re-issued on login).

### Password Management
- Admins can trigger a password reset email or set a temporary password.
- Enforce password complexity via `PASSWORD_MIN_LENGTH` and `PASSWORD_REQUIRE_SPECIAL` env vars.

### Deleting Users
- Deactivate accounts before deletion to preserve audit history.
- Deleted users are soft-deleted; their audit trail entries remain intact.

---

## 3. Project Administration

### Creating Projects
- **Projects > New Project** -- set name, description, start/end dates, and budget.
- Assign a project manager (must have `manager` role).
- Optionally apply a **project template** to pre-populate tasks and milestones.
- The creator is **automatically added as project owner** in the project members list.

### Managing Members
- Add or remove members from a project's **Team** tab.
- Set per-project roles: **owner**, **manager**, **editor**, **viewer**.

### Project-Level Access Control

Project membership is enforced on all project-scoped API routes. Only members of a project can access its data. Non-members receive a `404 Not Found` response (to prevent information leakage).

| Project Role | Read | Write (tasks, comments, time) | Admin (delete, manage members) |
|---|---|---|---|
| **owner** | Yes | Yes | Yes |
| **manager** | Yes | Yes | No |
| **editor** | Yes | Yes (tasks, comments, time only) | No |
| **viewer** | Yes | No | No |
| **Non-member** | 404 | 404 | 404 |

**Global role bypasses:** Users with the `admin` or `pmo` global role can access all projects without membership. Users with the `executive` role have read-only access to all projects.

> **Important:** Project roles (owner/manager/editor/viewer) are separate from global user roles (admin/executive/project_manager/team_member/etc.). A user needs both: a global role with sufficient scope *and* a project role with sufficient access.

### Archive and Delete
- **Archive** removes the project from active views but preserves all data.
- **Delete** permanently removes the project (requires admin role + project owner; audit entry created).

---

## 4. System Configuration

### Environment Variables

Key variables in `.env` (never commit secrets):

| Variable              | Purpose                                     |
|-----------------------|---------------------------------------------|
| `DATABASE_URL`        | MySQL/MariaDB connection string             |
| `JWT_SECRET`          | Token signing secret                        |
| `COOKIE_SECRET`       | Session cookie signing secret               |
| `AI_ENABLED`          | Enable/disable Claude AI features (`true`/`false`) |
| `ANTHROPIC_API_KEY`   | Anthropic API key (required if AI enabled)  |
| `STRIPE_SECRET_KEY`   | Stripe billing integration                  |
| `SMTP_HOST` / `SMTP_PORT` | Outbound email configuration            |
| `CORS_ORIGIN`         | Allowed CORS origins                        |
| `BASE_URL`            | Public-facing URL of the application        |

### AI Features Toggle
- Set `AI_ENABLED=true` and provide `ANTHROPIC_API_KEY` to enable AI-powered features (task suggestions, risk analysis, natural language queries).
- When disabled, all AI endpoints return a 503 with a descriptive message.

### Server Settings
- **Fastify** listens on `PORT` (default 3001) behind LiteSpeed + Passenger in production.
- Static assets are served directly by LiteSpeed; API routes proxy to Fastify.
- CSP headers are managed by Helmet (currently in report-only mode).

---

## 5. Billing and Subscriptions (Stripe)

### Plans
- Define subscription plans (Free, Pro, Enterprise) in the Stripe Dashboard.
- Map Stripe price IDs to app tiers via `STRIPE_PRICE_*` env vars.

### Managing Subscriptions
- View active subscriptions under **Settings > Billing**.
- Upgrade, downgrade, or cancel subscriptions from the admin panel.
- Stripe webhooks (`/api/webhooks/stripe`) handle payment events automatically.

### Stripe Dashboard
- Use the Stripe Dashboard for invoice management, refunds, and payment method issues.
- Ensure `STRIPE_WEBHOOK_SECRET` is set for webhook signature verification.

---

## 6. API Key Management

### Generating Keys
- **Settings > API Keys > Generate** -- create keys scoped to specific permissions.
- Available scopes: `read`, `write`, `admin`.
- Keys are shown once at creation; store them securely.

### Rate Limiting
- Default rate limits: 100 requests/minute per key.
- Configure via `API_RATE_LIMIT` and `API_RATE_WINDOW` env vars.

### Revoking Keys
- Revoke compromised or unused keys immediately from **Settings > API Keys**.
- Revocation is instant; in-flight requests with the revoked key will fail.

---

## 7. Authentication

### JWT Dual-Token Strategy
- **Access token:** HTTP-only cookie (`access_token`), 15-minute expiry.
- **Refresh token:** HTTP-only cookie (`refresh_token`), 7-day expiry.
- Both cookies use `secure: true` in production, `sameSite: 'lax'`.

### Login Flow
1. User submits credentials to `POST /api/v1/auth/login`.
2. Server validates password (bcrypt) and issues both tokens as HTTP-only cookies.
3. Access token is sent with every request automatically via cookies.
4. When the access token expires, the client calls `POST /api/v1/auth/refresh` to get a new pair.

### Logout
- `POST /api/v1/auth/logout` clears both cookies.

### Security Requirements
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` must each be at least 32 characters.
- All three secrets must be different from each other (validated at startup).

---

## 8. Audit Trail

### Viewing the Audit Ledger
- **Settings > Audit Trail** -- browse the immutable, append-only audit log.
- Every create, update, delete, and auth event is recorded with timestamp, user, and action.

### Hash-Chain Integrity
- Each audit entry includes a SHA-256 hash linking it to the previous entry.
- Run the integrity check via **Settings > Audit Trail > Verify Integrity** or the CLI: `npm run audit:verify`.

### Search and Filter
- Filter by date range, user, action type, or resource.
- Export audit logs as CSV for compliance reporting.

---

## 8b. Database Indexes

The following custom indexes exist beyond the default primary/foreign key indexes:

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| `idx_tasks_end_date` | `tasks` | `end_date` | Speeds up the overdue task scan (`AgentSchedulerService`) which runs every 2 minutes |

---

## 9. Policy Engine

### Configuring Rules
- **Settings > Policies** -- create automated rules that trigger on project or task events.
- Example rules: auto-assign reviewers, enforce mandatory fields, block status transitions without approvals.

### Rule Structure
- Each rule has a **trigger** (event type), **conditions** (field checks), and **actions** (status change, notification, assignment).
- Rules execute in priority order; first matching rule wins unless configured to chain.

---

## 10. Workflow Management

### DAG Workflow Engine
- Create directed acyclic graph (DAG) workflows under **Settings > Workflows**.
- Six node types: trigger, condition, action, approval, delay, agent.
- Define stages, transitions, and approval gates visually or via JSON.

### Event-Driven Triggers
- Workflows fire automatically on task events (create, update, priority change, assignment change, dependency change).
- Project-level triggers fire on budget threshold crossings and status changes.
- A 15-minute overdue-task scanner detects past-due tasks and fires `date_passed` triggers.
- Configure the scan interval with `AGENT_OVERDUE_SCAN_MINUTES` (default: 15).

### Monitoring Executions
- View active workflow instances under **Projects > Workflows**.
- Track which stage each item is in, who approved, and time spent per stage.

### Approval Gates
- Configure stages that require one or more approvers before progressing.
- Approvers are notified via email and in-app notifications.

### Agent Nodes
- Agent nodes invoke registered AI capabilities (e.g., auto-reschedule) inline within a workflow.
- Support retry logic with configurable backoff.
- Use template variables (e.g., `{{task.scheduleId}}`) to pass task context to agents.

---

## 10b. Agent System Administration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_ENABLED` | Enable/disable agent scheduler | `false` |
| `AGENT_CRON_SCHEDULE` | Cron expression for daily scan | `0 2 * * *` (2 AM) |
| `AGENT_OVERDUE_SCAN_MINUTES` | Overdue task scan interval | `15` |
| `AGENT_DELAY_THRESHOLD_DAYS` | Minimum delay days to flag | `3` |
| `AGENT_BUDGET_CPI_THRESHOLD` | CPI below which budget alert fires | `0.9` |
| `AGENT_BUDGET_OVERRUN_THRESHOLD` | AI overrun probability threshold | `60` |
| `AGENT_MC_CONFIDENCE_LEVEL` | Monte Carlo confidence level to check | `80` |

### Kill Switch (Emergency Stop)

The kill switch provides runtime control over agent execution without restarting the server. State is in-memory and resets to "enabled" on restart (safe default).

**API Endpoints:**

```bash
# View current state
GET /api/v1/agent/kill-switch

# Disable all agents globally (admin scope required)
POST /api/v1/agent/kill-switch  {"action": "disable"}

# Re-enable all agents
POST /api/v1/agent/kill-switch  {"action": "enable"}

# Disable a specific agent
PUT /api/v1/agent/kill-switch/agent/:agentId  {"disabled": true}

# Disable agents for a specific project
PUT /api/v1/agent/kill-switch/project/:projectId  {"disabled": true}
```

All kill switch changes are recorded in the audit ledger with the admin's user ID.

### Monitoring Agent Health

**`GET /api/v1/agent/health`** returns:
- `status` — `healthy` or `degraded`
- `claudeApiStatus` — `available` or `unavailable`
- `databaseStatus` — `{ healthy, latencyMs }`
- `circuitBreakers` — per-agent breaker state and failure count
- `killSwitch` — global enabled state, disabled agents list, disabled projects list
- `recommendedScanScope` — `full`, `reduced`, `critical_only`, or `none`
- `costs.today` — tokens used, estimated USD, invocation count
- `pendingProposals` — count of proposals awaiting review

**`GET /api/v1/agent/costs`** returns cost breakdown by agent with optional `?since=` and `?until=` date filters.

### Circuit Breakers

Each agent has an independent circuit breaker:
- **Closed** (normal): agent runs normally
- **Open** (after 3 consecutive failures): agent is blocked, retries after 1 hour
- **Half-open** (retry attempt): one execution allowed; success closes breaker, failure re-opens with 24h cooldown

Circuit breakers reset automatically — no manual intervention needed unless the root cause persists.

### Autonomous Execution (Tier 3)

Agents can be promoted to Tier 3 (autonomous execution) after meeting eligibility criteria:
- 30+ days of operation history
- 20+ proposals generated
- 80%+ acceptance rate
- 70%+ effectiveness rate (executed / accepted)
- Zero rollbacks

**API Endpoints:**

```bash
# List active autonomy configurations
GET /api/v1/agent/autonomy

# Check if an agent is eligible for promotion
GET /api/v1/agent/autonomy/:agentId/eligibility?projectId=optional

# Promote agent to Tier 3 (admin scope required)
PUT /api/v1/agent/autonomy/:agentId
Body: {"action": "promote", "projectId": "optional", "minConfidenceThreshold": 80, "maxRiskLevel": "low"}

# Demote agent back to Tier 2
PUT /api/v1/agent/autonomy/:agentId
Body: {"action": "demote", "projectId": "optional"}
```

When an agent is at Tier 3, proposals with confidence >= threshold and risk <= max risk level are automatically approved and executed. All auto-executions are logged in the console and proposal history.

**Database:** Requires migration `003_agent_autonomy.sql` to create `agent_autonomy_config` table.

### Rate Limiting

Proposal creation is rate-limited to prevent alert fatigue:
- 3 proposals per agent per project per 24 hours
- 10 proposals across all agents per project per 24 hours
- 10 proposals per agent per project per 7 days
- 30 proposals across all agents per project per 7 days

### Registered Agents

| Agent ID | What It Does |
|----------|-------------|
| `auto-reschedule-v1` | Detects schedule delays, generates reschedule proposals |
| `budget-forecast-v1` | Generates EVM budget forecasts |
| `monte-carlo-v1` | Runs Monte Carlo simulations for schedule risk |
| `meeting-followup-v1` | Identifies overdue meeting action items |
| `schedule-recovery-v1` | Claude-powered root cause analysis and recovery proposals |
| `scope-creep-detection-v1` | Detects scope creep via task growth, estimate increases, change requests |
| `budget-intelligence-v1` | Analyzes EVM metrics, reasons about cost deviations, proposes budget recovery actions |
| `resource-optimization-v1` | Detects over-allocated/under-utilized resources and bottleneck roles, proposes rebalancing actions |
| `cross-project-intelligence-v1` | Portfolio-level analysis: systemic risks, common patterns, resource contention across projects |
| `risk-escalation-v1` | Detects compound risks where multiple agents flag the same project; escalates to management |
| `stakeholder-communication-v1` | Auto-generates stakeholder status reports with executive summaries, highlights, risks, and recommended actions |
| `project-hygiene-v1` | Detects stale tasks, missing data, abandoned sprints, zero-progress tasks |
| `dependency-risk-v1` | Builds dependency graph, detects blocked chains, bottleneck tasks, long chains |
| `lessons-learned-v1` | Extracts structured lessons when projects near completion (≥90%) or complete |
| `predictive-alerting-v1` | Velocity trend analysis, progress trajectory, risk accumulation, early warnings |

### Autonomous Execution (Tier 3)

Agents can be promoted from Tier 2 (propose-only) to Tier 3 (auto-execute) when they demonstrate sustained reliability. Promotion requires ≥30 days, ≥20 proposals, ≥80% acceptance, ≥70% effectiveness, and zero rollbacks.

**API:**
- `GET /api/v1/agent/autonomy` — list autonomy configs
- `GET /api/v1/agent/autonomy/:agentId/eligibility` — check promotion eligibility
- `PUT /api/v1/agent/autonomy/:agentId` — promote/demote (admin only)

---

## 11. Integrations

### Jira
- **Settings > Integrations > Jira** -- provide Jira URL, email, and API token.
- Sync projects, issues, and statuses bidirectionally.
- Map PM Assistant statuses to Jira statuses in the configuration panel.

### GitHub
- Connect via OAuth or personal access token.
- Link repositories to projects; sync issues, PRs, and commit references.

### Slack
- Install the PM Assistant Slack app via OAuth.
- Configure channel notifications for project events (task created, status changed, approvals needed).

### Sync Management
- View sync status and last sync time under each integration.
- Trigger manual sync or configure auto-sync intervals.

---

## 12. Webhooks

### Configuring Outbound Webhooks
- **Settings > Webhooks > Add Webhook** -- provide a target URL and select event types.
- Events: `task.created`, `task.updated`, `project.created`, `sprint.completed`, etc.
- Each webhook includes an HMAC signature header for verification.

### Delivery Logs
- View delivery history, response codes, and retry status.
- Failed deliveries retry up to 3 times with exponential backoff.

---

## 13. Notifications

- **Settings > Notifications** -- configure system-wide notification preferences.
- Notification channels: in-app, email, Slack (if integrated).
- Admins can set mandatory notifications (e.g., security alerts) that users cannot disable.

---

## 14. Resource Management

- **Resources > Pool** -- define team members, their skills, and availability.
- **Capacity Planning** -- view resource allocation across projects by week/month.
- Identify over-allocated resources and rebalance assignments.
- Generate resource histograms and workload reports.

---

## 15. Report Templates

- **Reports > Templates** -- create reusable report templates with custom fields, filters, and layouts.
- Built-in templates: project status, burndown, velocity, budget forecast.
- Schedule automated report generation and email delivery.

---

## 16. Intake Forms

### Configuring Forms
- **Settings > Intake Forms** -- design forms for project requests with custom fields.
- Set required fields, dropdown options, and validation rules.

### Reviewing Submissions
- Submissions appear under **Intake > Pending Review**.
- Approve to create a project automatically, or reject with comments.

---

## 17. Project Templates

- **Settings > Templates** -- create and manage reusable project templates.
- Templates capture task structure, milestones, workflow assignments, and default settings.
- Apply templates when creating new projects to ensure consistency.

---

## 18. MCP Server (Model Context Protocol)

### Setup
- The MCP server enables Claude Desktop and Claude Web to interact with PM Assistant data.
- Configure the MCP endpoint in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pm-assistant": {
      "command": "node",
      "args": ["path/to/mcp-server/dist/index.js"],
      "env": {
        "PM_API_URL": "https://your-domain.com/api",
        "PM_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Available Operations
- The MCP server exposes project, task, sprint, resource, and reporting tools.
- Claude can query project status, create tasks, log time, and generate reports via natural language.

---

## 19. Backup and Maintenance

### Database Backups
- Use your hosting provider's backup tools (e.g., cPanel MySQL backup) or `mysqldump` via SSH.
- Schedule daily backups via cron or your hosting provider's scheduler.
- TMD Hosting provides automated daily backups with point-in-time recovery via cPanel.

### Restoring
- Restore via cPanel backup restore or `mysql` CLI import via SSH.
- Test restores periodically in a staging environment.

### Secret Rotation
- Rotate `JWT_SECRET` and `COOKIE_SECRET` periodically per your security policy.
- After rotation, all active sessions are invalidated; users must re-authenticate.

### Health Monitoring
- **`GET /health`** -- returns overall status (`OK` or `DEGRADED`), database connectivity with response time, memory usage (RSS, heap used, heap total), uptime, and environment. Returns HTTP 200 when healthy, 503 when degraded.
- **`GET /api/v1/agent/health`** -- returns agent system health: Claude API status, database latency, circuit breaker states, kill switch state, recommended scan scope, daily cost tracking, and pending proposal count.
- Memory status shows `WARN` if heap usage exceeds 90% of heap total.
- Monitor API latency, error rates, and database connection pool usage.
- Set up alerts for repeated failures or degraded performance.

---

## Troubleshooting

| Issue                        | Resolution                                                    |
|------------------------------|---------------------------------------------------------------|
| Users cannot log in          | Check credentials, token expiry, cookie domain, HTTPS config. |
| API returns 503              | Verify Fastify is running; check Passenger logs.              |
| AI features not working      | Confirm `AI_ENABLED=true` and valid `ANTHROPIC_API_KEY`.      |
| Agents not running           | Check `AGENT_ENABLED=true`; check kill switch state via `GET /api/v1/agent/kill-switch`. |
| Kill switch left on          | Re-enable via `POST /api/v1/agent/kill-switch {"action":"enable"}`. |
| Agent circuit breaker open   | Check error rate at `GET /api/v1/agent/health`; breaker auto-retries after 1h/24h. |
| Stripe webhooks failing      | Verify `STRIPE_WEBHOOK_SECRET`; check Stripe event logs.      |
| Integrations not syncing     | Check API tokens/credentials; review sync logs.               |
| Audit integrity check fails  | Investigate potential data tampering; restore from backup.     |

For detailed logs, check `./logs/` or your hosting provider's log viewer.

---

## References

- [User Guide](./USER_GUIDE.md) -- Projects, tasks, and day-to-day usage.
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) -- Server setup and deployment.
- [Security Guide](./SECURITY_GUIDE.md) -- Security configuration and best practices.
- [API Documentation](./API_DOCS.md) -- REST API reference.
