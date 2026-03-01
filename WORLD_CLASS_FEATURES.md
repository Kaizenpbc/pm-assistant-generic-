# World-Class Features Roadmap

## Vision
Build an AI-native project management platform that combines the scheduling power of Primavera P6, the usability of Monday.com/Smartsheet, and AI capabilities that no competitor offers.

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
- Near-critical path identification (float < N days)
- Recalculate on any schedule change
- **Benchmark:** Primavera P6, MS Project

### 1.2 Baseline Management
- Save schedule baseline snapshots (planned start, planned end, planned cost)
- Compare baseline vs actual on Gantt (dual bars)
- Schedule variance (SV) and cost variance (CV) per task
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

### 1.4 Kanban Board View
- Toggle between Gantt / Kanban / Table views
- Columns by status (Pending, In Progress, Completed, Cancelled)
- Drag-and-drop cards between columns
- Card shows: task name, assignee, priority, due date, progress
- Swimlanes by assignee or priority (optional)
- Filter and search within Kanban
- **Benchmark:** Monday.com, Jira, Asana

### 1.5 Resource Pool & Workload View
- Resource pool: list all team members with roles and capacity
- Assign resources to tasks with effort hours
- Workload heatmap: visual capacity per person per week
- Over-allocation detection and warnings
- Resource utilization percentage
- **Benchmark:** MS Project, Wrike, Asana

### 1.6 Comments & Activity Feed
- Comment thread on each task
- @mention team members in comments
- Activity feed: auto-log all changes (status, assignee, dates, etc.)
- Timestamp and user attribution
- **Benchmark:** All top tools

### 1.7 Export Capabilities
- Export Gantt chart to PDF
- Export project data to Excel/CSV
- Export reports to PDF
- Print-friendly layouts
- **Benchmark:** All top tools

---

## Priority 2: Competitive Differentiators

### 2.1 Auto-Scheduling Engine
- Move one task -> cascade all dependent tasks automatically
- Respect dependency types (FS, SS, FF, SF) with lag/lead
- Resource constraint-aware scheduling
- **Benchmark:** MS Project, Primavera P6

### 2.2 Workflow Automation Builder (DAG Engine)
- Declarative DAG-based workflow engine with DB persistence
- Node types: trigger, condition, action, approval gate, delay
- Triggers: status_change, progress_threshold, date_passed, manual
- Conditions: field-based evaluation with operators (equals, greater_than, contains, etc.)
- Actions: update_field, log_activity, send_notification
- Approval gates: pause execution until resumed via API/UI
- Multi-step workflows with branching (yes/no edges on conditions)
- Persistent execution history with per-node status tracking
- Cycle protection, graceful degradation, audit integration
- 5 DB tables: workflow_definitions, workflow_nodes, workflow_edges, workflow_executions, workflow_node_executions
- **Benchmark:** Monday.com, Wrike, Smartsheet (exceeds with DAG support + approval gates)

### 2.3 Custom Dashboards
- Drag-and-drop widget builder
- Widget types: charts, KPIs, tables, Gantt, calendar
- Personal and shared dashboards
- Real-time data refresh
- **Benchmark:** Monday.com, Smartsheet

### 2.4 Real-Time Collaboration
- Multi-user presence indicators
- Real-time task updates (WebSocket)
- Conflict resolution for simultaneous edits
- **Benchmark:** Monday.com, Smartsheet

### 2.5 Calendar & Table Views
- Calendar view with task bars across dates
- Table view with inline editing (spreadsheet-like)
- Column customization and sorting
- **Benchmark:** Smartsheet, Monday.com

### 2.6 Portfolio-Level Gantt
- Program view: multiple projects on one timeline
- Cross-project dependency linking
- Portfolio milestone tracking
- **Benchmark:** Primavera P6, Smartsheet

### 2.7 Advanced Security
- SSO (SAML 2.0 / OAuth)
- Granular role-based permissions (project-level, field-level)
- Audit trail UI with search and filter
- Data encryption at rest and in transit
- **Benchmark:** Enterprise tools

---

## Priority 3: AI Moat (What Nobody Else Has)

### 3.1 AI Auto-Rescheduling
- Detect delays automatically
- AI proposes new schedule minimizing total project impact
- One-click accept or modify AI suggestion
- Learns from accepted/rejected proposals

### 3.2 Predictive Resource Optimizer
- AI predicts resource bottlenecks 2-4 weeks ahead
- Suggests team rebalancing before burnout occurs
- Skill-based matching for task assignment
- Capacity forecasting

### 3.3 Natural Language Queries with Charts
- "Which projects are at risk of missing Q3 deadline?" -> instant answer with chart
- "Show me resource utilization for last month" -> auto-generated visualization
- "Compare Project A vs Project B" -> side-by-side analysis
- Deep integration with all project data

### 3.4 AI Meeting Minutes -> Auto-Update Project
- Upload meeting recording or transcript
- AI extracts action items, decisions, risks
- Auto-creates/updates tasks in the schedule
- Flags new risks and adjusts timeline

### 3.5 AI Lessons Learned Engine
- Learns from every completed project
- Pattern recognition across project types
- Auto-suggests risk mitigations from past projects
- Improves estimation accuracy over time
- Knowledge base that grows smarter

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
- Weekly timesheet view per resource
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
| Notification System | Not Started | P4 |
| File Attachments & Documents | Not Started | P4 |
| Time Tracking & Timesheets | Not Started | P4 |
| Project Templates | Not Started | P4 |
| Custom Fields | Not Started | P4 |
| Network Diagram View | Not Started | P4 |
| Burndown/Burnup Charts | Not Started | P4 |
| External Integrations | Not Started | P5 |
| Client/Stakeholder Portal | Not Started | P5 |
| Approval Workflows & Change Requests | Not Started | P5 |
| Resource Leveling | Not Started | P5 |
| Sprint Planning / Agile Mode | Not Started | P5 |
| Custom Report Builder | Not Started | P5 |
| Project Intake Forms | Not Started | P5 |
