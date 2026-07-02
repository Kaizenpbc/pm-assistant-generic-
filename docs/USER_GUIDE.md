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
21. [Agent Proposals](#21-agent-proposals)
22. [Settings and Account](#22-settings-and-account)
23. [Dark Mode, Language, and Time Zone](#23-dark-mode-language-and-time-zone)
24. [Goals / OKR Tracking](#24-goals--okr-tracking)
25. [Bulk CSV Import](#25-bulk-csv-import)

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

Click the **gear icon** next to the dashboard title to customize which widgets are visible. Toggle widgets on/off — your selections are saved automatically and persist across sessions. Available widgets include Recent Activity, Resource Utilization, and Project Burndown progress bars.

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

#### Real-Time Presence

When other users are viewing the same project, their avatar circles appear in the project header next to the action buttons. Each circle shows the user's initials with a tooltip displaying their username. This helps teams coordinate and avoid conflicting edits.

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
   - **Recurrence** -- Set a recurring schedule (Daily, Weekly, Biweekly, or Monthly). For Weekly/Biweekly, select specific days. Recurring templates auto-generate task instances within a 14-day horizon.
3. Click **Save** to add the task.

### Task Hierarchy

Tasks can be organized hierarchically:

- Create **parent tasks** (phases or work packages) as top-level items.
- Add **subtasks** under parent tasks to break down work.
- Expand or collapse task groups using the chevron icon.

### Dependencies

Set task dependencies to define execution order:

- **Dependency** -- Select the predecessor task. In Table view, you can also type the predecessor's row number directly (e.g. `3`, `5SS`, `7FS+2d`).
- **Dependency Type** -- Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), or Start-to-Finish (SF).
- **Lag** -- Optional number of days to add between the two tasks (e.g., a 2-day lag on FS means the successor starts 2 days after the predecessor finishes).
- Dependencies are displayed in compact row-number format with a health dot indicating predecessor status (green = done, yellow = in progress, red = overdue).
- Gantt dependency arrows are colour-coded by predecessor health and used in critical path analysis.
- **Validation** -- The server enforces dependency rules: no self-references, no circular dependencies (A→B→C→A), dependencies must exist and be in the same schedule. Invalid dependencies return an error message explaining the issue.
- **Orphan cleanup** -- Deleting a task automatically clears any dependencies that pointed to it.

### Task Activity Panel

Click on any task to view its activity history, including status changes, reassignments, date modifications, and comments.

**@Mentions in comments** -- When writing a comment, type `@` to open an autocomplete list of project members. Selecting a name inserts the mention. The mentioned user receives an in-app notification linking to that task.

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
- **Row numbers (#)** are displayed in the left panel instead of WBS, providing a sequential task index.
- **Predecessor column (Pred)** in the left panel shows dependencies in compact row-number format (e.g. "3", "7SS+2d") with a colour-coded health dot: green (predecessor done), yellow (in progress), red (overdue).
- **Dependency arrows** connect predecessor and successor tasks, colour-coded by predecessor health: green arrows for completed predecessors, yellow for in-progress, red for overdue.
- **Drag-and-drop rescheduling**: Drag a bar to move the task to new dates. Drag the right edge to resize (change end date only). Changes automatically cascade through dependencies.
- **Recurring task indicator**: Template tasks display a repeat icon on their bar.
- **Milestones**: Tasks marked as milestones appear as diamonds instead of bars.
- **PDF Export**: Click the **Print / Export PDF** button in the toolbar to open a print-optimised Gantt ready for saving as PDF.
- Hover over a bar to see task details including predecessor info (row number, task name, and health status). Click to edit.

### Kanban Board

Drag-and-drop card view organized by status columns:

- **Pending** -- Tasks not yet started.
- **In Progress** -- Active work items.
- **Completed** -- Finished tasks.
- **Cancelled** -- Removed tasks.

Drag a card between columns to update its status. Each card shows the task name, priority badge, assignee, and due date.

**WIP Limits** -- Each column supports a configurable Work-In-Progress limit set from the Kanban toolbar. When a column reaches its limit, the column header turns amber to signal congestion. Limits are stored in localStorage per schedule.

### Calendar View

Tasks plotted on a monthly calendar grid. Each day cell shows tasks that are active on that date. Useful for visualizing workload distribution and deadline clustering.

### Table View

A spreadsheet-like view of all tasks with inline editing. Click the **Columns** button (gear icon) to open the column picker. Choose from 22 columns organized into four groups:

- **Standard** -- # (row number, always visible), Name, Status, Priority, Start Date, End Date, Progress, Assigned To (visible by default, inline-editable)
- **Scheduling (CPM)** -- Duration, Early Start, Early Finish, Late Start, Late Finish, Total Float, Free Float, Critical (read-only; enabling any of these triggers CPM computation automatically)
- **Baseline** -- Baseline Start, Baseline End, Start Variance, End Variance (read-only; populated when a baseline comparison is active)
- **Other** -- Predecessor (inline-editable), WBS (read-only; auto-computed from task hierarchy)

The **# column** always appears as the first column and cannot be toggled off. It shows sequential row numbers (1, 2, 3...) based on the current sort order.

The **Predecessor column** displays dependencies in MS Project-style row-number format:
- `3` — Finish-to-Start on row 3 (FS is default, omitted)
- `7SS` — Start-to-Start on row 7
- `3FS+2d` — Finish-to-Start on row 3 with 2-day lag

Each predecessor shows a **health dot**: green (predecessor completed), yellow (in progress), red (overdue). Hover to see the full predecessor task name.

**Inline predecessor editing**: Click the Predecessor cell and type a row number with optional type and lag. Press Enter to save. Invalid inputs (bad row number, self-reference) show a red error. Clear the field to remove the dependency.

Column selections are saved per schedule and persist across page reloads. All visible columns support sorting. Bulk select, status/priority/assignee changes, and inline cell editing continue to work on the standard columns.

#### Saved Views

Click the **Views** button next to the Columns picker to save and load named view configurations. Each saved view stores the current column selection and sort order. You can:

- **Save** a new view by entering a name and clicking Save
- **Load** a saved view by clicking its name in the dropdown
- **Update** the active view if you've changed columns or sorting since loading it
- **Delete** a view by clicking the trash icon

Saved views are stored per schedule in your browser's localStorage.

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

AI-powered forecasting of future resource bottlenecks based on current task assignments and capacity (configurable up to 8 weeks ahead).

### Rebalance Suggestions

The system analyzes workload across resources and suggests task reassignments to balance the team's load more evenly.

### Resource Availability Calendar

Each resource has an availability calendar in the Team tab. Use it to define when a resource is unavailable or has reduced hours:

1. Select a resource from the dropdown in the Team tab.
2. Click **Add Block** to define an availability entry.
3. Set the date range, type (Vacation, Holiday, Unavailable, or Reduced Hours), and optional note.
4. For Reduced Hours, specify the hours per day available.

The calendar displays a color-coded month view: red for vacation, blue for holiday, gray for unavailable, amber for reduced hours. Navigate months with the arrow buttons. Existing blocks appear in a list below the calendar and can be deleted.

Workload calculations automatically account for availability — if a resource has vacation during a week, their effective capacity is reduced proportionally.

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
| **Trigger** | Starts the workflow (e.g., task status change, priority escalation, task creation, overdue detection). |
| **Condition** | Evaluates a rule and branches the flow (if/else logic). |
| **Action** | Performs an automated step (e.g., update task status, send notification, invoke agent). |
| **Approval** | Pauses execution until a designated approver accepts or rejects. |
| **Delay** | Waits for a specified duration before continuing. |
| **Agent** | Invokes an AI agent capability (e.g., auto-reschedule) with retry logic. |

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
- **Automatically on task events** -- Creating or updating a task fires matching triggers (status_change, task_created, priority_change, assignment_change, dependency_change).
- **Automatically on project events** -- Budget or status changes on projects fire budget_threshold and project_status_change triggers.
- **Automatically by overdue scanner** -- A 15-minute cron scans for newly-overdue tasks and fires date_passed triggers.

All automatic triggers are non-blocking and will not slow down the originating operation.

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

**Voice input and spoken replies**

- **Speak your message:** If your browser supports it, a **microphone** button appears next to the chat input. Click it, speak your question (e.g. “What projects are in trouble?” or “What’s my portfolio spend to date?”), and your words are sent as a normal chat message. Click the mic again to stop listening.
- **Speak replies:** Check **Speak replies** below the input to have the AI’s answers read aloud when each reply is complete. Uncheck to turn this off. The welcome message is never spoken.
- Voice uses the same AI chat as typing: you can say anything you could type and get the same smart, contextual answer.

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

### Task Slip Predictions

In the **AI Insights** tab of any project, the Task Slip Predictions section shows which tasks are most likely to slip. Each task is scored (0-100%) based on:

- Whether it's already overdue
- Progress gap (actual vs expected)
- Incomplete predecessor tasks
- Task duration (longer = higher risk)

Tasks are shown sorted by slip probability with color-coded bars and suggested actions.

### Scope Creep Detector

Also in the **AI Insights** tab, the Scope Creep Detector compares the current project state against its baseline. It shows:

- New tasks added since the baseline
- Estimate growth (total days added)
- Open change requests
- Schedule health percentage

A severity badge (Low/Medium/High/Critical) flags the degree of scope drift. Create a baseline first to enable this feature.

### Status Report Generator

Click the **Status Report** button in the project header to generate an AI-powered weekly status report. The report opens in a modal with formatted sections (Executive Summary, Key Metrics, Risks, Milestones, Recommendations). You can copy the report to clipboard or download it as a markdown file.

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

## 21. Agent Proposals

AI agents continuously monitor your projects for schedule delays, scope creep, and other issues. When an agent detects something actionable, it creates a **proposal** -- a recommended set of changes for human review.

Access the Agent Proposals page from the **Agent** link in the sidebar (visible to managers and admins).

### Viewing Proposals

The proposals page shows:

- **Health banner** -- Current agent system status, scan scope, daily cost, and pending proposal count.
- **Status tabs** -- Filter by All, Pending, Approved, Executed, Rejected, or Expired.
- **Proposals table** -- Each row shows the agent name, title, status badge, risk level, confidence score, and age.

Click any proposal row to open the detail modal.

### Proposal Detail

The detail modal displays:

- **Summary** -- A brief description of what the agent found and recommends.
- **Reasoning** -- The agent's full chain-of-thought explaining why it made this recommendation.
- **Confidence breakdown** -- Scores for data quality, historical accuracy, and model certainty.
- **Proposed actions** -- The specific changes the agent wants to make (e.g., move task dates, create change requests, send notifications). Each action shows its type, target entity, and proposed values.

### Reviewing Proposals

For **pending** proposals:

1. Read the reasoning and proposed actions carefully.
2. Optionally add a comment.
3. Click **Approve** to advance the proposal, or **Reject** to dismiss it.

### Executing Proposals

After approval, an admin can click **Execute Proposal** to apply all proposed actions to the project. Each action is executed in order with rollback support if any step fails.

### Rollback

If an executed proposal caused unintended effects, admins can click **Rollback** to reverse all changes to their original state.

### Providing Feedback

After a proposal has been executed, you can submit feedback on whether it was effective. Choose from:

- **Effective** -- The changes solved the problem.
- **Partially effective** -- Helped but didn't fully resolve the issue.
- **Ineffective** -- No meaningful impact.
- **Made worse** -- The changes had a negative effect.

Feedback improves future agent confidence scoring and proposal quality.

### Risk Levels

Each proposal has a risk level that determines its approval requirements:

| Risk Level | Meaning | Examples |
|------------|---------|----------|
| **Low** | Read-only analysis, notifications | Pattern detection, risk aggregation |
| **Medium** | Modifying task dates, updating progress | Moving a due date, adjusting estimates |
| **High** | Resource changes, dependency modifications | Reassigning team members, adding dependencies |
| **Critical** | Budget or scope changes | Reallocating budget, removing milestones |

---

## 22. Settings and Account

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
- **Language** -- Select your preferred display language (English, French, or Spanish). The change applies instantly without a page reload.
- **Time Zone** -- Set your IANA timezone (e.g., `America/Toronto`). All dates in the application are displayed in this timezone.

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

## 23. Dark Mode, Language, and Time Zone

### Dark Mode

Click the **dark mode toggle** (sun/moon icon) in the TopBar to switch between light and dark themes. The choice is saved and applied automatically on your next visit.

### Language

Open **Settings → Language** and choose from **English**, **French (Français)**, or **Spanish (Español)**. The interface updates immediately; no page reload is required.

### Time Zone

Open **Settings → Preferences** and enter your IANA timezone string (e.g., `America/New_York`, `Europe/Paris`). All task dates, due dates, and timestamps across the application will display in that timezone. Saved via `PUT /api/v1/users/me/preferences`.

---

## 24. Goals / OKR Tracking

The **Goals** page (sidebar link) lets teams track strategic Objectives and Key Results alongside project execution.

### Creating an Objective

1. Click **New Objective**.
2. Enter a title, description, owner, and time period (e.g., Q3 2026).
3. Save. The objective appears in the goals list.

### Adding Key Results

1. Open an objective.
2. Click **Add Key Result**.
3. Enter a title, target value, current value, and unit (e.g., "Revenue", 1000000, 750000, "USD").
4. Progress is calculated automatically as `current / target × 100%`.

### Linking to Projects

In the objective detail panel, use **Link Project** to associate one or more projects. This surfaces the objective on the project overview so teams can see how their work maps to strategic goals.

---

## 25. Bulk CSV Import

You can import tasks into any schedule from a CSV file without entering them one by one.

1. Open a schedule and click **Import CSV** in the toolbar.
2. Either **drag-and-drop** a `.csv` file into the upload area or **paste CSV text** directly.
3. The **Column Mapping** step lets you match each CSV column to a task field (name, start date, end date, estimated days, status, priority, assignee). Required: name.
4. The **Preview** table shows the parsed rows with any validation warnings highlighted.
5. Click **Import** to create all valid tasks. A summary shows how many rows were imported and any rows skipped due to errors.

Accepted date formats: `YYYY-MM-DD` and `MM/DD/YYYY`. Unrecognised status or priority values default to `pending` and `medium` respectively.

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
