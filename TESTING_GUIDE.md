# Testing Guide - PM Assistant Generic

**Last updated:** February 28, 2026
**Stack:** Fastify + TypeScript (server), React 18 + Vite + Tailwind CSS (client)
**Database:** MariaDB on TMD Hosting (no local database)
**Production URL:** https://pm.kpbc.ca

---

## 1. Build Verification

The project has two build targets: server (TypeScript compiled with `tsc`) and client (TypeScript check + Vite bundle).

### Full build

```bash
npm run build
```

This runs `npm run build:server && npm run build:client`.

### Server build

```bash
npm run build:server
# Equivalent to: tsc --project tsconfig.json
```

The server build must complete with zero errors. Output goes to `dist/server/`.

### Client build

```bash
npm run build:client
# Equivalent to: cd src/client && tsc && vite build
```

The client `tsc` step has pre-existing type errors (see section 7 below) but Vite still emits output to `dist/client/`. A successful build ends with Vite printing the bundle summary.

### Type-check only (server)

```bash
npm run type-check
# Equivalent to: tsc --noEmit
```

---

## 2. API Testing Patterns

All API testing is done with `curl` against the production server at `https://pm.kpbc.ca`. There is no local database, so all testing hits the live environment.

### General conventions

- Base URL: `https://pm.kpbc.ca/api/v1`
- Authentication: HTTP-only cookies (`access_token` and `refresh_token`) set by the login endpoint
- Use a cookie jar file (`-b cookies.txt -c cookies.txt`) to persist the session
- All request/response bodies are JSON
- Authenticated endpoints require the `access_token` cookie; unauthenticated requests return `401`

### Useful curl flags

```bash
# -s  silent (no progress bar)
# -S  show errors even in silent mode
# -b  read cookies from file
# -c  write cookies to file
# -H  set header
# -d  POST body (implies POST method)
# -X  explicit HTTP method
# -w '\n'  add newline after response
# | jq .  pretty-print JSON (install jq separately)
```

---

## 3. Login Flow

Authentication uses cookie-based JWT. Login sets HTTP-only `access_token` and `refresh_token` cookies.

### Step 1: Log in and capture cookies

```bash
curl -s -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_USER","password":"YOUR_PASS"}' \
  https://pm.kpbc.ca/api/v1/auth/login | jq .
```

Expected response:

```json
{
  "message": "Login successful",
  "user": {
    "id": "...",
    "username": "YOUR_USER",
    "email": "...",
    "role": "admin"
  }
}
```

The `cookies.txt` file now contains the `access_token` and `refresh_token` cookies.

### Step 2: Use authenticated requests

All subsequent curl commands should include `-b cookies.txt`:

```bash
curl -s -b cookies.txt https://pm.kpbc.ca/api/v1/projects | jq .
```

---

## 4. Testing the Workflow Engine

The workflow engine is a DAG-based system at `/api/v1/workflows`. Workflows are composed of nodes (trigger, condition, action, approval, delay, agent) connected by edges. Workflows fire automatically on task create/update events, project budget/status changes, and via a 15-minute overdue-task scanner.

### 4a. Create a workflow definition

```bash
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{
    "name": "Test Workflow",
    "description": "Integration test workflow",
    "nodes": [
      {
        "nodeType": "trigger",
        "name": "On task create",
        "config": {"event": "task.created"}
      },
      {
        "nodeType": "action",
        "name": "Set priority high",
        "config": {"action": "set_field", "field": "priority", "value": "high"}
      }
    ],
    "edges": [
      {"sourceIndex": 0, "targetIndex": 1}
    ]
  }' \
  https://pm.kpbc.ca/api/v1/workflows | jq .
```

Save the returned `definition.id` for subsequent steps.

### 4b. List workflow definitions

```bash
curl -s -b cookies.txt https://pm.kpbc.ca/api/v1/workflows | jq .
```

### 4c. Get a single workflow definition

```bash
curl -s -b cookies.txt https://pm.kpbc.ca/api/v1/workflows/WORKFLOW_ID | jq .
```

### 4d. Enable/disable a workflow

```bash
curl -s -b cookies.txt -X PATCH -H 'Content-Type: application/json' \
  -d '{"enabled": true}' \
  https://pm.kpbc.ca/api/v1/workflows/WORKFLOW_ID/toggle | jq .
```

### 4e. Trigger a workflow manually

```bash
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"entityType": "task", "entityId": "TASK_ID"}' \
  https://pm.kpbc.ca/api/v1/workflows/WORKFLOW_ID/trigger | jq .
```

Save the returned `execution.id` for verification.

### 4f. List executions

```bash
curl -s -b cookies.txt \
  'https://pm.kpbc.ca/api/v1/workflows/executions?workflowId=WORKFLOW_ID' | jq .
```

### 4g. Get execution detail

```bash
curl -s -b cookies.txt \
  https://pm.kpbc.ca/api/v1/workflows/executions/EXECUTION_ID | jq .
```

Check that `status` is `completed`, `running`, or `waiting` as expected.

### 4h. Clean up test workflow

```bash
curl -s -b cookies.txt -X DELETE \
  https://pm.kpbc.ca/api/v1/workflows/WORKFLOW_ID | jq .
```

Requires admin scope.

---

## 5. Testing DAG Features: Conditions, Approval Gates, Resume

### 5a. Workflow with a condition node

Create a workflow that branches based on a condition:

```bash
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{
    "name": "Conditional Workflow",
    "nodes": [
      {"nodeType": "trigger", "name": "Start", "config": {"event": "task.updated"}},
      {"nodeType": "condition", "name": "Is high priority?", "config": {"field": "priority", "operator": "eq", "value": "high"}},
      {"nodeType": "action", "name": "Escalate", "config": {"action": "notify", "channel": "email"}},
      {"nodeType": "action", "name": "Log only", "config": {"action": "log"}}
    ],
    "edges": [
      {"sourceIndex": 0, "targetIndex": 1},
      {"sourceIndex": 1, "targetIndex": 2, "conditionExpr": {"result": true}, "label": "yes"},
      {"sourceIndex": 1, "targetIndex": 3, "conditionExpr": {"result": false}, "label": "no"}
    ]
  }' \
  https://pm.kpbc.ca/api/v1/workflows | jq .
```

Trigger it and verify that the execution follows the correct branch by inspecting node statuses in the execution detail.

### 5b. Workflow with an approval gate

Approval nodes pause execution until a human approves or rejects:

```bash
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{
    "name": "Approval Workflow",
    "nodes": [
      {"nodeType": "trigger", "name": "Start", "config": {"event": "task.created"}},
      {"nodeType": "approval", "name": "Manager approval", "config": {"approvers": ["admin"]}},
      {"nodeType": "action", "name": "Proceed", "config": {"action": "set_field", "field": "status", "value": "approved"}}
    ],
    "edges": [
      {"sourceIndex": 0, "targetIndex": 1},
      {"sourceIndex": 1, "targetIndex": 2}
    ]
  }' \
  https://pm.kpbc.ca/api/v1/workflows | jq .
```

### 5c. Trigger and verify waiting state

After triggering, the execution should pause at the approval node:

```bash
# Trigger
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"entityType": "task", "entityId": "TASK_ID"}' \
  https://pm.kpbc.ca/api/v1/workflows/WORKFLOW_ID/trigger | jq .

# Check execution — status should be "waiting"
curl -s -b cookies.txt \
  https://pm.kpbc.ca/api/v1/workflows/executions/EXECUTION_ID | jq .
```

### 5d. Resume a waiting execution

Supply the approval node ID and the result (approved/rejected):

```bash
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"nodeId": "APPROVAL_NODE_ID", "result": {"approved": true}}' \
  https://pm.kpbc.ca/api/v1/workflows/executions/EXECUTION_ID/resume | jq .
```

After resuming, re-fetch the execution detail to confirm status changed to `completed` (or continued to the next node).

---

## 5e. Testing Event-Driven Triggers

Workflows now fire automatically on task and project lifecycle events. No manual trigger is needed.

### Test: Task update triggers workflow

Update a task's status and verify a workflow execution was created:

```bash
# Update a task status to trigger status_change workflows
curl -s -b cookies.txt -X PATCH -H 'Content-Type: application/json' \
  -d '{"status": "completed"}' \
  https://pm.kpbc.ca/api/v1/schedules/SCHEDULE_ID/tasks/TASK_ID | jq .

# Check workflow executions — should see a new execution
curl -s -b cookies.txt \
  'https://pm.kpbc.ca/api/v1/workflows/executions?entityId=TASK_ID' | jq .
```

### Test: Priority escalation triggers notification

Change a task priority to `urgent` and verify the "On task marked urgent" workflow fires:

```bash
curl -s -b cookies.txt -X PATCH -H 'Content-Type: application/json' \
  -d '{"priority": "urgent"}' \
  https://pm.kpbc.ca/api/v1/schedules/SCHEDULE_ID/tasks/TASK_ID | jq .

# Check notifications for the project manager
curl -s -b cookies.txt https://pm.kpbc.ca/api/v1/notifications | jq .
```

### Test: New task triggers task_created workflows

Create a task and verify `task_created` trigger workflows execute:

```bash
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name": "New event test task", "scheduleId": "SCHEDULE_ID", "status": "pending"}' \
  https://pm.kpbc.ca/api/v1/schedules/SCHEDULE_ID/tasks | jq .
```

### Test: Overdue scanner

The overdue scanner runs every 15 minutes (configurable via `AGENT_OVERDUE_SCAN_MINUTES`). To verify:

1. Create a task with `endDate` in the past
2. Wait for the next scanner cycle (or restart the server)
3. Check `workflow_executions` table for a `date_passed` trigger execution

---

## 5b. Testing Dependency Validation

Tasks support up to 20 predecessors via the `dependencies[]` array. The server enforces dependency rules on all create/update task requests. All tests require an authenticated session (see section 3).

The legacy single `dependency` field is still accepted for backward compatibility, but the preferred format is:

```json
{
  "dependencies": [
    { "dependencyId": "TASK_ID", "dependencyType": "FS", "lagDays": 0 },
    { "dependencyId": "TASK_ID_2", "dependencyType": "SS", "lagDays": 2 }
  ]
}
```

### Self-reference (expect 400)

```bash
curl -s -b cookies.txt -X PUT \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks/$TASK_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"dependencies\":[{\"dependencyId\":\"$TASK_ID\"}]}"
# Expected: {"error":"Validation error","message":"A task cannot depend on itself"}
```

### Nonexistent dependency (expect 400)

```bash
curl -s -b cookies.txt -X PUT \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks/$TASK_ID" \
  -H 'Content-Type: application/json' \
  -d '{"dependencies":[{"dependencyId":"00000000-0000-0000-0000-000000000000"}]}'
# Expected: {"error":"Validation error","message":"Dependency task '...' not found"}
```

### Circular dependency (expect 400)

```bash
# First set A→B (should succeed)
curl -s -b cookies.txt -X PUT \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks/$TASK_A" \
  -H 'Content-Type: application/json' \
  -d "{\"dependencies\":[{\"dependencyId\":\"$TASK_B\"}]}"

# Then try B→A (should fail with 400)
curl -s -b cookies.txt -X PUT \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks/$TASK_B" \
  -H 'Content-Type: application/json' \
  -d "{\"dependencies\":[{\"dependencyId\":\"$TASK_A\"}]}"
# Expected: {"error":"Validation error","message":"Circular dependency detected..."}
```

### Cross-schedule dependency (expect 400)

```bash
curl -s -b cookies.txt -X PUT \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks/$TASK_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"dependencies\":[{\"dependencyId\":\"$TASK_IN_OTHER_SCHEDULE\"}]}"
# Expected: {"error":"Validation error","message":"Dependency must be in the same schedule"}
```

### Max 20 predecessors (expect 400)

```bash
# Create a task with 21 dependencies — should fail
curl -s -b cookies.txt -X PUT \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks/$TASK_ID" \
  -H 'Content-Type: application/json' \
  -d '{"dependencies":[...21 items...]}'
# Expected: 400 validation error (max 20)
```

### Cascade cleanup on delete

```bash
# Set A→B, then delete B. Junction table rows are cascade-deleted automatically:
curl -s -b cookies.txt -X DELETE \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks/$TASK_B"
# Then GET task A and confirm B is removed from its dependencies array
```

### Multiple predecessors

```bash
# Create a task with two predecessors (FS and SS with 2-day lag)
curl -s -b cookies.txt -X POST \
  "https://pm.kpbc.ca/api/v1/schedules/$SCHED/tasks" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Integration Testing",
    "dependencies": [
      { "dependencyId": "'$TASK_A'", "dependencyType": "FS", "lagDays": 0 },
      { "dependencyId": "'$TASK_B'", "dependencyType": "SS", "lagDays": 2 }
    ]
  }'
# Expected: 201 with dependencies array in response
```

---

## 6. Database Verification

The database is MariaDB hosted on TMD Hosting. There is no local database instance. All database verification is done via SSH.

### Connect to the database

```bash
ssh YOUR_USER@pm.kpbc.ca
mariadb -u DB_USER -p DB_NAME
```

### Useful queries

**Check workflow definitions:**

```sql
SELECT id, name, is_enabled, created_at FROM wf_definitions ORDER BY created_at DESC LIMIT 10;
```

**Check workflow executions:**

```sql
SELECT id, workflow_id, status, entity_type, entity_id, started_at, finished_at
FROM wf_executions ORDER BY started_at DESC LIMIT 10;
```

**Check execution node states:**

```sql
SELECT en.id, en.execution_id, n.name, n.node_type, en.status, en.started_at, en.finished_at
FROM wf_execution_nodes en
JOIN wf_nodes n ON n.id = en.node_id
WHERE en.execution_id = 'EXECUTION_ID'
ORDER BY en.started_at;
```

**Check users:**

```sql
SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 10;
```

**Check projects:**

```sql
SELECT id, name, status, created_at FROM projects ORDER BY created_at DESC LIMIT 10;
```

### Verify a migration ran

```sql
SHOW TABLES LIKE 'wf_%';
DESCRIBE wf_definitions;
```

### Verify the tasks end_date index

```sql
SHOW INDEX FROM tasks WHERE Key_name = 'idx_tasks_end_date';
SELECT * FROM _migrations WHERE name LIKE '015%';
```

---

## 7. Testing the Agentic Pipeline

### Running Agent Unit Tests

```bash
npx vitest run src/server/__tests__/services/agents/
```

This runs 19 test files with 223+ tests covering:

| Test File | What It Tests |
|-----------|--------------|
| `ConflictResolver.test.ts` | Staleness detection, entity conflict checks, stale proposal sweep |
| `ProposalRateLimiter.test.ts` | 4-tier rate limiting (agent/all-agents x 24h/7d) |
| `DegradationHandler.test.ts` | Circuit breaker states, DB health check, scan scope recommendation |
| `KillSwitchService.test.ts` | Global/agent/project kill switches, audit logging |
| `AgentFeedbackService.test.ts` | Feedback submission, health snapshots, aggregate stats |
| `ScopeCreepAgent.test.ts` | Guard chain (budget/kill switch/rate limit/breaker), indicator detection |
| `BudgetIntelligenceAgent.test.ts` | Guard chain, EVM indicator thresholds, proposal creation, error handling |
| `ResourceOptimizationAgent.test.ts` | Guard chain, workload indicator detection, proposal creation, error handling |
| `CrossProjectIntelligenceAgent.test.ts` | Guard chain, portfolio indicator gathering, cross-project pattern detection, proposal creation |
| `RiskEscalationAgent.test.ts` | Guard chain, compound risk detection (2+ agent flags), flag distribution, escalation proposal |
| `StakeholderCommunicationAgent.test.ts` | Guard chain, snapshot gathering, EVM computation, report generation, proposal creation |
| `ProjectHygieneAgent.test.ts` | Guard chain, stale task detection, missing data, abandoned sprints, zero-progress tasks |
| `DependencyRiskAgent.test.ts` | Guard chain, dependency graph traversal, blocked chains, bottleneck detection |
| `LessonsLearnedAgent.test.ts` | Guard chain, completion threshold, lesson extraction, deduplication |
| `PredictiveAlertingAgent.test.ts` | Guard chain, velocity trend, progress trajectory, risk accumulation |
| `AutonomyService.test.ts` | Tier lookup, auto-execute gates, promotion eligibility, promote/demote |
| `ActionProposalService.test.ts` | Proposal creation via transaction, lifecycle |
| `ActionExecutor.test.ts` | Sequential execution, rollback on failure |
| `ConfidenceCalculator.test.ts` | Score computation, data quality scoring, weight verification |

### Testing Agent Health Endpoint

```bash
# Get agent system health (requires auth token)
curl -s http://pm.kpbc.ca/api/v1/agent/health \
  -H "Cookie: access_token=$TOKEN" | jq .
```

Expected fields: `status`, `claudeApiStatus`, `databaseStatus`, `circuitBreakers`, `killSwitch`, `recommendedScanScope`, `costs`, `pendingProposals`.

### Testing Kill Switch API

```bash
# Get current kill switch state
curl -s http://pm.kpbc.ca/api/v1/agent/kill-switch \
  -H "Cookie: access_token=$TOKEN" | jq .

# Disable all agents globally (admin only)
curl -X POST http://pm.kpbc.ca/api/v1/agent/kill-switch \
  -H "Cookie: access_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "disable"}' | jq .

# Re-enable all agents
curl -X POST http://pm.kpbc.ca/api/v1/agent/kill-switch \
  -H "Cookie: access_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "enable"}' | jq .

# Disable a specific agent
curl -X PUT http://pm.kpbc.ca/api/v1/agent/kill-switch/agent/scope-creep-detection-v1 \
  -H "Cookie: access_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disabled": true}' | jq .
```

### Testing Agent Proposals

```bash
# List proposals
curl -s "http://pm.kpbc.ca/api/v1/agent/proposals?status=pending" \
  -H "Cookie: access_token=$TOKEN" | jq .

# Approve a proposal
curl -X POST http://pm.kpbc.ca/api/v1/agent/proposals/{id}/approve \
  -H "Cookie: access_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Looks good"}' | jq .

# Submit feedback on executed proposal
curl -X POST http://pm.kpbc.ca/api/v1/agent/proposals/{id}/feedback \
  -H "Cookie: access_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outcome": "effective", "comment": "Fixed the delay"}' | jq .
```

### Testing the Agent Proposals UI

1. Log in as a manager or admin.
2. Click **Agent** in the sidebar -- the Agent Proposals page should load.
3. Verify the health banner shows agent system status (healthy/degraded).
4. Use the status tabs to filter proposals by status.
5. Click a proposal row to open the detail modal.
6. In the modal, verify:
   - Summary, reasoning, and confidence breakdown are displayed.
   - Proposed actions are listed with type, target, and values.
   - Pending proposals show Approve/Reject buttons with an optional comment field.
   - Approved proposals show an Execute button (admin only).
   - Executed proposals show Rollback (admin) and Feedback form.
7. Test approve/reject on a pending proposal -- the table should update after the action.
8. Verify non-admin users cannot see Execute/Rollback buttons.
9. Verify member-role users do not see the Agent nav item in the sidebar.

### Database Verification (Agent Tables)

```sql
-- Check agent tables exist
SHOW TABLES LIKE 'agent_%';

-- Check pending proposals
SELECT id, agent_id, status, confidence_score, risk_level, created_at
FROM agent_proposals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;

-- Check agent cost usage
SELECT agent_id, SUM(total_tokens) AS tokens, SUM(estimated_cost_usd) AS cost
FROM agent_cost_ledger WHERE DATE(created_at) = CURDATE() GROUP BY agent_id;

-- Check feedback stats
SELECT p.agent_id, f.outcome, COUNT(*) AS cnt
FROM agent_feedback f JOIN agent_proposals p ON p.id = f.proposal_id
GROUP BY p.agent_id, f.outcome;
```

---

## 8. Known Pre-existing Type Errors (Client)

The client TypeScript compilation (`tsc` in `src/client`) reports several known errors that do not block the Vite build. These are expected and do not need to be fixed for testing.

### ImportMeta.env errors

Files referencing `import.meta.env.VITE_*` may produce errors like:

```
Property 'env' does not exist on type 'ImportMeta'.
```

This is a TypeScript/Vite typing issue. Vite handles `import.meta.env` at build time; the types are not fully declared in the client `tsconfig.json`. The build still emits correctly.

### Unused imports

Some files have unused import warnings from stricter `tsc` checking. These do not affect runtime behavior.

### aiContextBuilder.ts

The file `src/server/services/aiContextBuilder.ts` has 3 pre-existing type errors. The server build still emits output because `noEmit` is not set and these are non-fatal.

---

## Verification Checklist

### Build

- [ ] `npm run build:server` completes with zero errors
- [ ] `npm run build:client` completes (Vite prints bundle summary)
- [ ] `dist/server/index.js` exists after server build
- [ ] `dist/client/index.html` exists after client build

### Authentication

- [ ] POST `/api/v1/auth/login` returns 200 and sets `access_token` / `refresh_token` cookies
- [ ] Authenticated GET `/api/v1/projects` returns data with valid cookie
- [ ] Unauthenticated requests to protected endpoints return 401

### Workflow Engine

- [ ] POST `/api/v1/workflows` creates a definition with nodes and edges
- [ ] GET `/api/v1/workflows` lists definitions
- [ ] POST `/api/v1/workflows/:id/trigger` creates an execution
- [ ] GET `/api/v1/workflows/executions/:id` shows execution with node states
- [ ] Condition nodes route execution to the correct branch
- [ ] Approval nodes pause execution (status = `waiting`)
- [ ] POST `/api/v1/workflows/executions/:id/resume` resumes waiting execution
- [ ] DELETE `/api/v1/workflows/:id` removes test data

### Agentic Pipeline

- [ ] `npx vitest run src/server/__tests__/services/agents/` passes all tests (14 agent test files)
- [ ] GET `/api/v1/agent/health` returns status with `databaseStatus`, `circuitBreakers`, `killSwitch`
- [ ] GET `/api/v1/agent/kill-switch` returns current state
- [ ] POST `/api/v1/agent/kill-switch` with `{"action":"disable"}` blocks agent scans
- [ ] POST `/api/v1/agent/kill-switch` with `{"action":"enable"}` re-enables agents
- [ ] GET `/api/v1/agent/autonomy` returns autonomy configurations
- [ ] GET `/api/v1/agent/autonomy/:agentId/eligibility` returns promotion eligibility stats
- [ ] PUT `/api/v1/agent/autonomy/:agentId` with `{"action":"promote"}` promotes agent to Tier 3 (admin only)
- [ ] PUT `/api/v1/agent/autonomy/:agentId` with `{"action":"demote"}` demotes agent to Tier 2 (admin only)

### Database

- [ ] SSH connection to server works
- [ ] `wf_definitions`, `wf_nodes`, `wf_edges`, `wf_executions`, `wf_execution_nodes` tables exist
- [ ] `agent_proposals`, `agent_proposal_actions`, `agent_feedback`, `agent_cost_ledger`, `agent_confidence_log` tables exist
- [ ] Execution records match API responses
