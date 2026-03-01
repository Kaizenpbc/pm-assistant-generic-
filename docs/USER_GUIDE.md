# PM Assistant -- User Guide

A comprehensive guide for using PM Assistant, an AI-powered enterprise project management platform. This guide covers every feature from initial login through advanced analytics and automation.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Projects](#2-projects)
3. [Schedules and Tasks](#3-schedules-and-tasks)
4. [Views](#4-views)
5. [Critical Path](#5-critical-path)
6. [Baselines](#6-baselines)
7. [Earned Value Management (EVM)](#7-earned-value-management-evm)
8. [Resources](#8-resources)
9. [Workflows](#9-workflows)
10. [Sprints](#10-sprints)
11. [Time Tracking](#11-time-tracking)
12. [Reports](#12-reports)
13. [Monte Carlo Simulation](#13-monte-carlo-simulation)
14. [AI Features](#14-ai-features)
15. [Templates](#15-templates)
16. [Integrations](#16-integrations)
17. [Intake Forms](#17-intake-forms)
18. [Portfolio](#18-portfolio)
19. [Intelligence and Scenarios](#19-intelligence-and-scenarios)
20. [Lessons Learned](#20-lessons-learned)
21. [Settings and Account](#21-settings-and-account)

---

## 1. Getting Started

### Signing Up

1. Navigate to the PM Assistant URL in your browser.
2. On the landing page, click **Sign Up** (or go to `/register`).
3. Enter your full name, email, username, and password.
4. Verify your email address using the link sent to your inbox.

### Logging In

1. Go to the login page (`/login`) and enter your username and password.
2. Click **Sign In**. You will be redirected to the Dashboard.
3. If your session expires, you will be returned to the login page automatically.
4. Use **Forgot Password** if you need to reset your credentials.

### Dashboard Overview

The dashboard you see depends on your role:

- **Executives and Admins** see the **Executive Overview** -- a portfolio-level summary with total projects, active count, budget utilization, on-track percentage, and an AI-generated summary banner.
- **Managers and Members** see the **PM Dashboard** -- a project-centric view with your assigned projects, prediction cards, and quick-access links.

Both dashboards display:

- **Summary cards** -- Total projects, active projects, budget, and on-track metrics.
- **Project list** -- Each project card shows status, priority, progress bar, and budget. Click a card to open the project or click **View Schedule** to jump directly to the schedule.
- **AI Summary Banner** -- An AI-generated daily digest of portfolio health (when AI is enabled).

### Sidebar Navigation

The left sidebar provides access to all areas of the application:

| Menu Item      | Description                                 |
|----------------|---------------------------------------------|
| Dashboard      | Home view with project overview             |
| Projects       | Create and manage projects                  |
| Reports        | Pre-built report templates                  |
| Portfolio      | Cross-project Gantt and portfolio view      |
| Analytics      | Summary analytics and dashboards            |
| Workflows      | DAG-based automation workflows              |
| Intelligence   | Scenario modeling and cross-project analysis|
| Simulation     | Monte Carlo schedule simulation             |
| Meetings       | AI meeting intelligence                     |
| Lessons        | Lessons learned knowledge base              |
| Timesheets     | Time tracking and actual vs. estimated      |
| Integrations   | Jira, GitHub, Slack, Trello connections     |
| Report Builder | Custom report designer                      |
| Intake         | Project intake forms and submissions        |
| Ask AI         | Natural language query interface            |
| Help           | In-app help and user guide                  |
| Account        | Billing and subscription management         |
| Settings       | User preferences and API keys (admin/manager)|

The sidebar can be collapsed using the toggle at the bottom. On mobile devices, it slides in as an overlay.

### Command Palette

Press **Ctrl+K** (or **Cmd+K** on Mac) to open the Command Palette. Type to quickly search and navigate to any page, project, or action.

### Notifications

The bell icon in the top bar shows unread notifications. Click it to view alerts about task changes, workflow approvals, schedule delays, and other events. You can mark individual notifications as read or clear all at once.

---

## 2. Projects

### Creating a Project

1. From the Dashboard, click **Create New Project**.
2. Fill in the project details:
   - **Name** (required) -- A descriptive project name.
   - **Description** -- Overview of the project scope.
   - **Status** -- Planning, Active, On Hold, Completed, or Cancelled.
   - **Priority** -- Low, Medium, High, or Urgent.
   - **Budget Allocated** -- The total budget for the project.
   - **Start Date / End Date** -- Planned project timeline.
   - **Assigned PM** -- The project manager responsible.
3. Click **Create** to save the project.

### Editing a Project

Open a project from the Dashboard or Projects page. Edit any field (name, description, status, priority, budget, dates, assigned PM) and save your changes.

### Deleting a Project

From the project detail view, use the delete option. This action requires appropriate permissions and will remove the project and all associated schedules, tasks, and data.

### Project Detail View

Each project page provides tabs or sections for:

- **Overview** -- Project metadata, progress percentage, budget utilization.
- **Schedule** -- Full schedule management (see Section 3).
- **Resources** -- Team members assigned to the project.
- **Attachments** -- File uploads with version history.
- **Custom Fields** -- User-defined metadata fields.
- **Change Requests** -- Formal change management.
- **Activity** -- Audit trail of all project changes.

---

## 3. Schedules and Tasks

### Creating a Schedule

1. Open a project and navigate to the **Schedule** tab.
2. Click **Create Schedule** or **New Schedule**.
3. Give the schedule a name and save.
4. You can have multiple schedules per project (e.g., baseline schedule, revised schedule).

### Adding Tasks

1. Within a schedule, click **Add Task**.
2. Fill in the task form:
   - **Name** (required) -- Task description.
   - **Status** -- Pending, In Progress, Completed, or Cancelled.
   - **Priority** -- Low, Medium, High, or Urgent.
   - **Start Date / End Date** -- Task timeline.
   - **Estimated Days** -- Duration estimate.
   - **Progress Percentage** -- Current completion (0-100%).
   - **Assigned To** -- Team member responsible.
   - **Description** -- Detailed task notes.
   - **Story Points** -- Agile estimation value.
3. Click **Save** to add the task.

### Task Hierarchy

Tasks can be organized hierarchically:

- Create **parent tasks** (phases or work packages) as top-level items.
- Add **subtasks** under parent tasks to break down work.
- Expand or collapse task groups using the chevron icon.

### Dependencies

Set task dependencies to define execution order:

- **Dependency** -- Select the predecessor task.
- **Dependency Type** -- Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), or Start-to-Finish (SF).
- Dependencies are visualized as connector lines on the Gantt chart and used in critical path analysis.

### Task Activity Panel

Click on any task to view its activity history, including status changes, reassignments, date modifications, and comments.

### Delay Detection

Tasks that are behind schedule are flagged with a delay indicator showing the number of days overdue. The system automatically detects schedule slippage.

### Bulk Operations

Select multiple tasks to perform bulk operations:

- **Bulk Status Update** -- Change the status of many tasks at once.
- **Bulk Update** -- Modify priority, assignee, or dates in batch.

---

## 4. Views

The schedule page offers multiple visualization modes:

### Gantt Chart

The default schedule view. Displays tasks as horizontal bars on a timeline:

- **Bar length** represents task duration (start to end date).
- **Bar color** indicates status (blue for in progress, green for completed, gray for pending).
- **Progress fill** shows completion percentage within each bar.
- **Dependency arrows** connect predecessor and successor tasks.
- **WBS numbering** is displayed in the task list column.
- Hover over a bar to see task details. Click to edit.

### Kanban Board

Drag-and-drop card view organized by status columns:

- **Pending** -- Tasks not yet started.
- **In Progress** -- Active work items.
- **Completed** -- Finished tasks.
- **Cancelled** -- Removed tasks.

Drag a card between columns to update its status. Each card shows the task name, priority badge, assignee, and due date.

### Calendar View

Tasks plotted on a monthly calendar grid. Each day cell shows tasks that are active on that date. Useful for visualizing workload distribution and deadline clustering.

### Table View

A spreadsheet-like view of all tasks with sortable columns for name, status, priority, assignee, dates, progress, and story points.

### Network Diagram

A node-and-edge graph showing task dependencies. Each task appears as a node, with arrows representing dependency relationships. The critical path is highlighted.

---

## 5. Critical Path

The critical path identifies the longest chain of dependent tasks that determines the minimum project duration.

### Viewing the Critical Path

1. Open a project schedule.
2. Navigate to the **Critical Path** view or panel.
3. Tasks on the critical path are highlighted (typically in red or with a special indicator).

### Key Information

- **Critical tasks** -- Any delay to these tasks directly delays the project end date.
- **Float/Slack** -- Non-critical tasks show their available float (how much they can slip without affecting the project end date).
- **Total duration** -- The calculated minimum project duration based on the critical path.

Use critical path analysis to focus management attention on the tasks that matter most to the timeline.

---

## 6. Baselines

Baselines capture a snapshot of the schedule at a point in time, enabling comparison against the current plan.

### Creating a Baseline

1. Open a schedule with defined tasks.
2. Click **Save Baseline** (or use the baselines panel).
3. Enter a baseline name (e.g., "Original Plan", "Rev 2").
4. The system captures a copy of all task dates, durations, and progress at that moment.

### Comparing Baselines

- View baseline bars alongside current task bars on the Gantt chart.
- Compare planned vs. actual dates to identify schedule drift.
- Use baseline data in EVM calculations (planned value is derived from the baseline).

### Managing Baselines

- List all baselines for a schedule.
- Delete baselines that are no longer needed.
- Multiple baselines can exist per schedule for tracking progressive changes.

---

## 7. Earned Value Management (EVM)

EVM provides objective cost and schedule performance measurement.

### EVM Dashboard

Navigate to the EVM section of a project to see:

- **Planned Value (PV)** -- The budgeted cost of work scheduled.
- **Earned Value (EV)** -- The budgeted cost of work actually performed.
- **Actual Cost (AC)** -- The actual cost incurred.

### Key Metrics

| Metric | Formula | Meaning |
|--------|---------|---------|
| SPI (Schedule Performance Index) | EV / PV | > 1.0 = ahead of schedule |
| CPI (Cost Performance Index) | EV / AC | > 1.0 = under budget |
| SV (Schedule Variance) | EV - PV | Positive = ahead |
| CV (Cost Variance) | EV - AC | Positive = under budget |
| EAC (Estimate at Completion) | BAC / CPI | Forecasted total cost |
| ETC (Estimate to Complete) | EAC - AC | Remaining cost forecast |
| TCPI (To-Complete Performance Index) | Remaining work / remaining budget | Required efficiency |

### S-Curve Chart

A visual plot of PV, EV, and AC over time. The S-curve shows:

- Whether the project is ahead or behind schedule (EV vs. PV gap).
- Whether the project is over or under budget (EV vs. AC gap).
- Trend lines for forecasting completion.

### EVM Forecast

The EVM Forecast Dashboard shows:

- **Completion date predictions** based on current SPI.
- **Cost at completion forecasts** based on current CPI.
- **Forecast comparison charts** showing optimistic, most likely, and pessimistic scenarios.
- **AI-generated alerts** when metrics indicate critical or warning thresholds.

### EVM Trend Chart

Track how SPI and CPI change over time to identify whether performance is improving or degrading.

---

## 8. Resources

### Managing Team Members

1. Navigate to the project's **Resources** section.
2. Add team members by assigning them to the project.
3. Set each resource's role, availability, and hourly rate.

### Workload Heatmap

The workload heatmap shows resource utilization across time:

- **Green** -- Under-allocated (available capacity).
- **Yellow** -- Optimally allocated.
- **Red** -- Over-allocated (overloaded).

Hover over a cell to see the specific allocation percentage and assigned tasks for that resource on that date.

### Resource Histogram

A bar chart showing resource demand by time period. Helps identify peaks and valleys in resource requirements.

### Resource Leveling

The resource leveling panel suggests schedule adjustments to resolve over-allocation:

- Review suggested task shifts.
- Accept or reject leveling recommendations.
- Apply changes to smooth resource demand.

### Capacity Chart

Shows planned capacity vs. actual demand for each resource, helping identify where additional resources may be needed.

### Resource Forecast

AI-powered forecasting of future resource needs based on project pipeline and historical data.

### Rebalance Suggestions

The system analyzes workload across resources and suggests task reassignments to balance the team's load more evenly.

---

## 9. Workflows

PM Assistant includes a DAG (Directed Acyclic Graph) workflow engine for automating project processes.

### Creating a Workflow

1. Navigate to **Workflows** in the sidebar.
2. Click **Create Workflow**.
3. Define the workflow:
   - **Name** -- Descriptive workflow name.
   - **Description** -- What this workflow automates.
   - **Project** (optional) -- Scope to a specific project, or leave global.

### Workflow Nodes

Build your workflow by adding nodes of these types:

| Node Type   | Purpose |
|-------------|---------|
| **Trigger** | Starts the workflow (e.g., task status change, schedule event). |
| **Condition** | Evaluates a rule and branches the flow (if/else logic). |
| **Action** | Performs an automated step (e.g., update task status, send notification, assign resource). |
| **Approval** | Pauses execution until a designated approver accepts or rejects. |
| **Delay** | Waits for a specified duration before continuing. |

### Connecting Nodes

- Draw edges between nodes to define the execution flow.
- Edges can have condition expressions that determine which path to follow.
- Edges can be labeled and sorted for readability.
- The graph must be acyclic (no circular loops).

### Positioning

Each node has optional X/Y position coordinates for visual layout in the workflow editor.

### Triggering a Workflow

Workflows can be triggered:

- **Manually** -- By providing an entity type (e.g., "task") and entity ID.
- **Automatically** -- When configured triggers detect matching events.

### Execution History

Each workflow run creates an execution record:

- View the status of each node in the run (pending, running, completed, failed, waiting_approval).
- See timestamps for when each node started and completed.
- Review input/output data for each step.

### Resuming Approvals

When a workflow reaches an **Approval** node:

1. The workflow pauses and a notification is sent to the approver.
2. The approver reviews the context and either approves or rejects.
3. Use the **Resume** action on the paused node, providing the approval result.
4. The workflow continues along the appropriate branch.

---

## 10. Sprints

For teams using agile methodology, PM Assistant supports sprint-based work management.

### Creating a Sprint

1. Open a project and navigate to the sprint panel.
2. Click **Create Sprint**.
3. Fill in:
   - **Name** -- e.g., "Sprint 14".
   - **Goal** -- What the team aims to achieve.
   - **Start Date / End Date** -- Sprint timebox.
   - **Velocity Commitment** -- Target story points.
4. Save the sprint.

### Sprint Planning

The Sprint Planning Panel shows:

- **Backlog** -- Tasks not yet assigned to a sprint.
- **Sprint backlog** -- Tasks added to the current sprint.
- **Story point totals** -- Running count vs. velocity commitment.

Drag tasks from the backlog into the sprint, or use the add/remove buttons. Each task card shows name, status, priority, assignee, and story points.

### Starting a Sprint

Once planning is complete, click **Start Sprint** to begin. The sprint status changes from "planning" to "active".

### Sprint Board

During an active sprint, the sprint board provides a Kanban-style view of sprint tasks organized by status columns. Drag cards to update status.

### Sprint Burndown Chart

Track sprint progress with the burndown chart:

- **Ideal burndown** -- A straight line from total points to zero.
- **Actual burndown** -- The real remaining story points over time.
- If the actual line is above the ideal line, the team is behind pace.

### Velocity Chart

View historical velocity across completed sprints. The chart shows story points completed per sprint, helping calibrate future commitments.

### Completing a Sprint

When the sprint period ends:

1. Click **Complete Sprint**.
2. Review completed vs. incomplete tasks.
3. Incomplete tasks can be moved to the next sprint or back to the backlog.

---

## 11. Time Tracking

### My Timesheet

1. Navigate to **Timesheets** in the sidebar.
2. The **My Timesheet** tab shows a weekly grid.
3. Select a project and schedule.
4. Log hours for each task by day:
   - Enter hours in the grid cells.
   - Add optional notes for each entry.
5. The system tracks total hours per task and per day.

### Project Summary

Switch to the **Project Summary** tab to see:

- **Actual vs. Estimated Chart** -- A comparison of logged hours against original estimates for each task.
- Identifies tasks that are consuming more effort than planned.
- Helps improve future estimation accuracy.

### Time Entries

Each time log entry records:

- The task and schedule.
- Hours worked.
- Date of work.
- Optional description/notes.

---

## 12. Reports

### Pre-Built Reports

Navigate to **Reports** in the sidebar to access standard project reports with pre-configured views and filters.

### Report Builder

For custom reports, use the **Report Builder**:

1. Navigate to **Report Builder** in the sidebar.
2. Click **New Report** to open the report designer.
3. Configure report sections:
   - Choose data sources (tasks, resources, time entries, EVM metrics).
   - Add filters (by project, date range, status, assignee).
   - Select visualization types (tables, bar charts, line charts, pie charts).
   - Arrange sections in the desired order.
4. Save the report template with a name and description.
5. Mark as **Shared** to make it available to other team members.

### Generating Reports

1. From the report list, click **Generate** on any saved template.
2. The Report Preview renders live data into the configured sections.
3. Export or print the generated report as needed.

### Analytics Dashboard

The **Analytics** page provides a summary dashboard with key metrics across all projects, including task completion rates, budget utilization, and schedule adherence.

---

## 13. Monte Carlo Simulation

Monte Carlo simulation uses random sampling to model schedule uncertainty and produce probabilistic forecasts.

### Running a Simulation

1. Navigate to **Simulation** in the sidebar.
2. Select a **Project** and **Schedule**.
3. Configure simulation parameters:
   - **Iterations** -- Number of simulation runs (e.g., 1,000 or 10,000). More iterations produce smoother results.
   - **Uncertainty Model** -- The probability distribution for task duration variability (e.g., triangular, PERT, normal).
4. Click **Run Simulation**.

### Interpreting Results

The simulation produces several outputs:

#### Histogram

A frequency distribution of possible project completion dates. The X-axis shows duration in days; the Y-axis shows the number of iterations that resulted in that duration. The cumulative percentage line shows the probability of finishing by a given date.

#### Confidence Levels

A table of key percentiles:

| Percentile | Meaning |
|------------|---------|
| P50 | 50% chance of completing by this date |
| P80 | 80% chance -- a common planning target |
| P90 | 90% chance -- conservative estimate |

#### Tornado Diagram (Sensitivity Analysis)

Ranks tasks by their impact on overall schedule variance. Tasks at the top of the tornado have the highest correlation with project duration -- they are your biggest sources of risk.

#### Criticality Index

Shows how often each task appeared on the critical path across all iterations (as a percentage). Tasks with high criticality are frequently critical even when durations vary.

#### Cost Forecast

If cost data is available, the simulation also produces probabilistic cost forecasts (P50, P80, P90, mean, and standard deviation).

#### Statistics

- **Mean duration** -- The average project duration across all iterations.
- **Standard deviation** -- The spread of possible outcomes.
- **Min/Max** -- The best-case and worst-case durations observed.

---

## 14. AI Features

PM Assistant integrates AI capabilities throughout the platform (requires AI to be enabled in your environment).

### Natural Language Queries (Ask AI)

1. Navigate to **Ask AI** in the sidebar.
2. Type a question in plain English, such as:
   - "Which tasks are overdue across all projects?"
   - "What is the budget utilization for Project Alpha?"
   - "Show me a breakdown of task status by assignee."
3. The AI returns a written answer, often accompanied by auto-generated charts (bar, line, pie, or doughnut).
4. **Suggested follow-ups** appear below the answer for deeper exploration.

### AI Chat Panel

A persistent chat panel accessible from any page:

- Click the AI chat icon to open the side panel.
- Ask questions about the current context (project, schedule, task).
- The AI is aware of the page you are on and can provide contextual answers.
- Includes **Quick Actions** for common operations.

### AI Task Breakdown

1. Open a project schedule.
2. Click **AI Task Breakdown** in the action bar.
3. Provide a brief project description.
4. The AI generates a structured set of tasks with suggested durations, dependencies, and assignments.
5. Review, adjust, and save the generated tasks.

### AI Task Prioritization

The Task Prioritization Panel analyzes your backlog and suggests an optimal task ordering based on dependencies, deadlines, resource availability, and priority.

### Meeting Intelligence

1. Navigate to **Meetings** in the sidebar.
2. Paste or type a meeting transcript.
3. Select the associated project and schedule.
4. Click **Process**. The AI extracts:
   - **Summary** -- Concise meeting recap.
   - **Action items** -- Tasks identified from discussion, with suggested assignees and due dates.
   - **Decisions** -- Key decisions recorded.
   - **Risks** -- Potential issues mentioned.
5. Action items can be converted directly into schedule tasks.

### AI Summary Banner

On the Executive Dashboard, an AI-generated banner provides a daily portfolio health summary, highlighting projects that need attention.

### Prediction Cards

The dashboard displays AI-generated prediction cards forecasting project outcomes, risk levels, and recommended actions.

### Auto-Reschedule

When delays are detected, the AI can suggest schedule adjustments that minimize overall project impact. Review and accept or reject proposed changes.

---

## 15. Templates

Templates let you save and reuse project structures.

### Saving a Template

1. Open a project with a well-defined schedule.
2. Click **Save as Template**.
3. Enter a template name and description.
4. The template captures the full task hierarchy, dependencies, durations, and structure (but not specific dates or assignments).

### Using a Template

1. When creating a new project or schedule, click **Use Template** or open the **Template Picker**.
2. Browse available templates. Each shows a preview card with the template name, description, and task count.
3. Click **Preview** to see the full task structure before applying.
4. Click **Apply** to populate your schedule with the template's tasks.

### Customizing a Template

After selecting a template, the **Template Customize Form** lets you:

- Adjust task names and durations.
- Remove tasks you do not need.
- Set a project start date (all task dates shift accordingly).

---

## 16. Integrations

Connect PM Assistant to external tools for bidirectional synchronization.

### Supported Providers

| Provider | Capability |
|----------|-----------|
| **Jira** | Sync tasks with Jira issues. Import/export task status, priority, and assignments. |
| **GitHub** | Link GitHub issues and pull requests to project tasks. Track development progress. |
| **Slack** | Send project notifications, alerts, and status updates to Slack channels. |
| **Trello** | Sync cards with project tasks. |

### Setting Up an Integration

1. Navigate to **Integrations** in the sidebar.
2. Click **Configure** on the desired provider.
3. In the configuration modal, enter the required credentials:
   - **Jira** -- Server URL, API token, project key.
   - **GitHub** -- Repository, personal access token.
   - **Slack** -- Webhook URL or OAuth token, channel.
   - **Trello** -- API key, board ID.
4. Click **Save** to create the integration.

### Syncing

- Click **Sync Now** to manually trigger a synchronization.
- View the **Sync Log** panel to see a history of sync operations, including timestamps, status, and any errors.
- Integrations can be enabled/disabled with a toggle without deleting the configuration.

---

## 17. Intake Forms

Intake forms provide a structured way to collect and process new project requests.

### Designing a Form

1. Navigate to **Intake** in the sidebar.
2. On the **Forms** tab, click **New Form**.
3. Use the **Intake Form Designer** to:
   - Add fields (text, number, date, dropdown, etc.).
   - Set required/optional flags.
   - Configure validation rules.
   - Arrange field order.
4. Save the form.

### Submitting a Request

1. On the **Submissions** tab (or via a shared link), open a form.
2. Fill in all required fields.
3. Click **Submit**. The submission enters the review pipeline.

### Reviewing Submissions

Submissions flow through a status pipeline:

- **Submitted** -- Awaiting review.
- **Under Review** -- Being evaluated.
- **Approved** -- Accepted for project creation.
- **Rejected** -- Declined with reason.
- **Converted** -- Turned into an active project.

Reviewers can filter by status, open the Review Panel for each submission, and take action.

---

## 18. Portfolio

The **Portfolio** page provides a cross-project view of all active work.

### Portfolio Gantt

A multi-project Gantt chart showing:

- Each project as a parent row with its tasks as children.
- Aggregated progress and date ranges.
- Color-coded status indicators.

Click on a project row to navigate to its detail page.

### Portfolio Overview

Summary metrics across all projects, including total budget, overall progress, and project count by status.

---

## 19. Intelligence and Scenarios

### Scenario Modeling

Navigate to **Intelligence** in the sidebar to access:

- **Portfolio Risk Heatmap** -- A matrix showing each project's health score, risk level, budget utilization, and progress. Color-coded for quick identification of problem areas.
- **Budget Reallocation** -- Identifies projects with surplus budget and those in deficit, with recommendations for reallocation.
- **Resource Conflicts** -- Flags resources assigned to overlapping tasks across projects.
- **Anomaly Detection** -- AI identifies unusual patterns (sudden cost spikes, schedule anomalies, performance outliers) with severity ratings and recommendations.

---

## 20. Lessons Learned

### Recording Lessons

1. Navigate to **Lessons** in the sidebar.
2. Click **New Lesson**.
3. Fill in:
   - **Title** -- Brief description.
   - **Description** -- What happened.
   - **Category** -- e.g., Planning, Execution, Communication, Risk.
   - **Impact** -- Positive, Negative, or Neutral.
   - **Recommendation** -- What to do differently.
   - **Project** (optional) -- Associate with a specific project.
4. Save the lesson.

### Pattern Detection

The AI analyzes your lessons learned database and identifies recurring patterns:

- **Pattern cards** show the title, description, frequency, related project types, and recommendations.
- Use patterns to proactively apply learned improvements to new projects.

---

## 21. Settings and Account

### Account and Billing

Navigate to **Account** in the sidebar to manage:

- Subscription plan and billing details.
- Payment method.
- Usage and limits.

### Settings (Admin/Manager)

Navigate to **Settings** to configure:

- **User management** -- Add, edit, or deactivate users. Assign roles (admin, executive, manager, member).
- **API keys** -- Generate and manage API keys for programmatic access.
- **Custom fields** -- Define organization-wide custom fields that appear on tasks and projects.
- **Notifications** -- Configure notification preferences and channels.

### User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features, user management, and settings. |
| **Executive** | Read-only portfolio view, dashboards, and reports. |
| **Manager** | Create and manage projects, schedules, resources, and workflows. |
| **Member** | View assigned projects, update tasks, log time. |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K / Cmd+K | Open Command Palette |

---

## Tips

- **Save often** -- Always click Save after modifying schedules or tasks. Unsaved changes are lost on page refresh.
- **Use the Command Palette** -- Ctrl+K is the fastest way to navigate anywhere in the application.
- **Check notifications** -- The bell icon alerts you to approvals, delays, and assignment changes.
- **Leverage AI** -- Use Ask AI for quick data lookups, and AI Task Breakdown when starting a new project.
- **Set baselines early** -- Create a baseline as soon as the initial plan is approved, before work begins.
- **Review EVM weekly** -- SPI and CPI trends provide early warning of schedule and cost problems.

---

## Need Help?

- **In-app help** -- Navigate to the Help page from the sidebar.
- **Administrators** -- See the [Admin Manual](./ADMIN_MANUAL.md) for system configuration and deployment.
- **API access** -- Generate an API key in Settings to integrate with external tools.
