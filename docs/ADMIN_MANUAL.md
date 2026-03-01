# PM Assistant -- Admin Manual

This manual is for **system administrators** who manage users, projects, and platform configuration for PM Assistant, an enterprise project management platform.

---

## 1. Roles and Access

| Role       | Access                                                              |
|------------|---------------------------------------------------------------------|
| **admin**  | Full access: all users, projects, system settings, billing, audit.  |
| **manager**| Create/manage projects, assign members, run reports, approve tasks. |
| **member** | View and work on assigned projects, log time, update tasks.         |

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

### Managing Members
- Add or remove members from a project's **Team** tab.
- Set per-project roles: project manager, contributor, viewer.

### Archive and Delete
- **Archive** removes the project from active views but preserves all data.
- **Delete** permanently removes the project (requires admin role; audit entry created).

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

## 7. OAuth 2.1

### Client Registration
- Register OAuth clients under **Settings > OAuth Clients**.
- Provide client name, redirect URIs, and allowed scopes.
- Each client receives a `client_id` and `client_secret`.

### PKCE Flow
- All public clients must use PKCE (Proof Key for Code Exchange).
- The authorization endpoint enforces `code_challenge` and `code_challenge_method=S256`.

### Token Management
- Access tokens expire after 1 hour (configurable via `OAUTH_TOKEN_TTL`).
- Refresh tokens expire after 30 days.
- Revoke tokens via the `/api/oauth/revoke` endpoint or admin panel.

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
- Run `npm run db:backup` to create a timestamped MySQL dump.
- Backups are stored in `./backups/` by default (configure via `BACKUP_DIR`).
- Schedule daily backups via cron or your hosting provider's scheduler.

### Restoring
- Restore with `npm run db:restore <backup-file>`.
- Test restores periodically in a staging environment.

### Secret Rotation
- Rotate `JWT_SECRET` and `COOKIE_SECRET` periodically per your security policy.
- After rotation, all active sessions are invalidated; users must re-authenticate.

### Health Monitoring
- **`GET /api/health`** -- returns server status, database connectivity, and uptime.
- Monitor API latency, error rates, and database connection pool usage.
- Set up alerts for repeated failures or degraded performance.

---

## Troubleshooting

| Issue                        | Resolution                                                    |
|------------------------------|---------------------------------------------------------------|
| Users cannot log in          | Check credentials, token expiry, cookie domain, HTTPS config. |
| API returns 503              | Verify Fastify is running; check Passenger logs.              |
| AI features not working      | Confirm `AI_ENABLED=true` and valid `ANTHROPIC_API_KEY`.      |
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
