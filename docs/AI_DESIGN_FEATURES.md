# AI Design Features - PM Assistant

**Created:** February 7, 2026
**LLM Provider:** Claude API (Anthropic)
**Approach:** Retrofit into existing application — UI redesigned to be AI-centric
**Architecture Principle:** Build foundational AI layer first, then layer capabilities on top

---

## Priority Order Rationale

Features are ordered by **developer build efficiency**:
- Phase 0 establishes the new UI shell so every subsequent feature drops into the right layout
- Foundation layers come first (everything else depends on them)
- Each phase unlocks the next
- External API integrations are abstracted early so they can be swapped
- High-value PM features ship as soon as the foundation supports them

---

## Phase 0: UI Architecture Redesign (AI-Centric)

> Restructure the frontend layout so AI is the core interaction model, not a bolted-on modal.

### Design Philosophy

The current UI is **dashboard-table-centric**: a giant 18-column project table with 15+ scattered AI action buttons that open disconnected modals. The redesign makes **AI the primary interaction layer** — the assistant is always present, insights surface automatically, and data views support the AI rather than the other way around.

**Principles:**
- AI is ambient, not hidden behind clicks
- Risks and insights surface proactively (push, not pull)
- Every page is context-aware — the AI panel knows what you're looking at
- Clean, focused layouts — remove button clutter, let AI handle complexity
- Role-adaptive — Minister sees national view, PM sees project detail, Citizen sees public info

### 0.1 New Application Shell & Layout

**Current:** Simple header with action buttons, full-width content area, modals for everything.

**New:** Three-column responsive layout:

```
+------------------+------------------------+--------------------+
|                  |                        |                    |
|    Sidebar Nav   |    Main Content        |   AI Panel         |
|    (collapsible) |    (context pages)     |   (collapsible)    |
|                  |                        |                    |
|  - Dashboard     |                        |  - Chat input      |
|  - Projects      |                        |  - Context cards   |
|  - Risks         |                        |  - Quick actions   |
|  - Reports       |                        |  - Suggestions     |
|  - Settings      |                        |                    |
|                  |                        |                    |
+------------------+------------------------+--------------------+
```

**Responsive behavior:**
- Desktop (>1280px): All three columns visible
- Tablet (768-1280px): Sidebar collapsed to icons, AI panel as overlay
- Mobile (<768px): Bottom nav, AI panel as full-screen sheet

**Components:**
- `AppLayout.tsx` — New root layout replacing current AppShell
- `Sidebar.tsx` — Persistent navigation with role-based menu items
- `AIChatPanel.tsx` — Always-visible AI assistant (replaces AIAssistant modal)
- `TopBar.tsx` — Breadcrumbs, search, user menu, notification bell

### 0.2 Redesigned Dashboard

**Current:** 4 stat cards + 18-column sticky table + 15 action buttons in header.

**New:** AI-first dashboard with layered information:

```
+------------------------------------------------------------------+
|  AI Summary Banner                                                |
|  "3 projects at risk this week. Region 5 bridge delayed by       |
|   weather. Budget alert on Highway Project."                     |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+ +------------------+ +------------------+   |
|  | Risk Alerts (3)  | | Weather Forecast | | Budget Health    |   |
|  | Critical: 1      | | Rain in Region 5 | | 2 over budget   |   |
|  | High: 2          | | Clear elsewhere  | | 8 on track      |   |
|  +------------------+ +------------------+ +------------------+   |
|                                                                    |
|  Active Projects                                    [+ New] [Grid/List] |
|  +-------------+ +-------------+ +-------------+ +-------------+ |
|  | Project Card | | Project Card | | Project Card | | Project Card | |
|  | Progress bar | | Progress bar | | Progress bar | | Progress bar | |
|  | Risk badge   | | Risk badge   | | Risk badge   | | Risk badge   | |
|  | AI status    | | AI status    | | AI status    | | AI status   | |
|  +-------------+ +-------------+ +-------------+ +-------------+ |
+------------------------------------------------------------------+
```

**Key changes:**
- Replace 18-column table with **project cards** (grid/list toggle)
- AI Summary Banner at top — auto-generated, highlights what needs attention today
- Prediction cards row — risks, weather, budget at a glance
- Remove 15 scattered action buttons — those actions move to AI panel context menu
- Each project card shows AI-generated health indicator and top risk

**Components:**
- `AISummaryBanner.tsx` — AI-generated daily briefing
- `PredictionCards.tsx` — Row of forecast cards (risk, weather, budget)
- `ProjectCardGrid.tsx` — Card-based project list (replaces table)
- `ProjectCard.tsx` — Redesigned card with AI health indicator

### 0.3 Redesigned Project Detail Page

**Current:** 9 tabs (mostly placeholder), 4 context cards, 8 smart tool buttons.

**New:** Focused layout with real AI content:

```
+------------------------------------------------------------------+
|  Project Header: Name, Status, Health Score (AI), Key Dates      |
+------------------------------------------------------------------+
|  Tabs: Overview | Schedule | Risks & Predictions | Activity      |
+------------------------------------------------------------------+
|                                                                    |
|  [Overview Tab]                                                   |
|  +------------------+ +------------------+ +------------------+   |
|  | Progress         | | Budget Forecast  | | Timeline Risk    |   |
|  | 45% complete     | | Predicted: $1.2M | | 3 days late      |   |
|  | AI: on track     | | AI: 12% over     | | AI: recoverable  |   |
|  +------------------+ +------------------+ +------------------+   |
|                                                                    |
|  AI Insights Feed                                                 |
|  - "Foundation phase completed 2 days early. Recommend pulling   |
|     Phase 2 start date forward."                                 |
|  - "Resource conflict: John assigned to 3 tasks next week."     |
|  - "Weather risk: Heavy rain forecast Feb 15-22, affects         |
|     outdoor tasks."                                              |
+------------------------------------------------------------------+
```

**Tab changes:**
| Current Tab | Action |
|-------------|--------|
| Overview | Keep — redesign with AI insight cards |
| Schedule | Keep — add weather overlay and AI optimization suggestions |
| RAID | Merge into → **Risks & Predictions** (AI-powered) |
| Analytics | Merge into Overview cards |
| Health | Merge into Overview header (health score badge) |
| Resources | Move to AI panel context (ask "who is overloaded?") |
| Risks | Merge into → **Risks & Predictions** |
| Checklist | Move to AI panel (AI generates checklists on demand) |
| AI Tasks | Remove — AI task breakdown available through AI panel |

**Result:** 9 tabs → 4 tabs (Overview, Schedule, Risks & Predictions, Activity)

**Components:**
- `ProjectHeader.tsx` — Project name, status, AI health score badge
- `AIInsightFeed.tsx` — Scrollable list of AI-generated observations
- `ForecastCard.tsx` — Budget/timeline/resource prediction with confidence
- `RiskPredictionPanel.tsx` — Risk register with AI severity scoring
- `WeatherOverlay.tsx` — Weather forecast overlay on schedule Gantt chart

### 0.4 AI Chat Panel (Persistent)

**Current:** `AIAssistant.tsx` is a modal that opens per-action, no persistence, hardcoded responses.

**New:** Always-visible side panel, context-aware, with real Claude responses:

```
+-----------------------------+
|  AI Assistant        [_] [x]|
+-----------------------------+
|  Context: Dashboard         |
|  Viewing: All Projects      |
+-----------------------------+
|                             |
|  Bot: Good morning. 3       |
|  projects need attention    |
|  today. Region 5 bridge     |
|  has a weather risk...      |
|                             |
|  You: What should I focus   |
|  on today?                  |
|                             |
|  Bot: Based on your         |
|  projects, I recommend:     |
|  1. Review Region 5 delay   |
|  2. Approve Phase 2 budget  |
|  3. Check resource conflict |
|     on Highway Project      |
|                             |
+-----------------------------+
|  Quick Actions:             |
|  [Create Project] [Report]  |
|  [Risk Scan] [Optimize]     |
+-----------------------------+
|  Type a message...    [Send]|
+-----------------------------+
```

**Features:**
- Persists across page navigation (conversation continues)
- Context-aware: knows which page/project you're viewing
- Quick action buttons change based on context (dashboard vs project vs schedule)
- Streaming responses (typewriter effect as Claude responds)
- Can reference and link to specific projects, tasks, risks in responses
- Conversation history saved per user (database-backed)
- Collapsible to icon-only mode for more screen space

**Components:**
- `AIChatPanel.tsx` — Main panel container with collapse/expand
- `AIChatMessages.tsx` — Message list with streaming support
- `AIChatInput.tsx` — Input with send button and quick actions
- `AIChatContext.tsx` — Context display bar (what page/project is active)
- `QuickActions.tsx` — Context-sensitive action buttons

### 0.5 Risk & Alert System UI

**Current:** No persistent alert system. Risks are in a RAID tab that's mostly placeholder.

**New:** Proactive alert system that surfaces risks without user action:

```
+--------------------------------------------------+
|  🔴 Critical: Region 5 Bridge — weather delay     |  [View] [Dismiss]
|  🟡 Warning: Highway Project — budget 87% spent   |  [View] [Dismiss]
|  🔵 Info: 3 tasks completed ahead of schedule     |  [View] [Dismiss]
+--------------------------------------------------+
```

**Features:**
- Notification bell in top bar with unread count
- Alert dropdown with categorized notifications (critical, warning, info)
- Each alert links to the relevant project/task
- AI-generated alert descriptions (not just "budget exceeded" but "budget at 87% with 40% work remaining — projected 15% overrun")
- Alerts generated by background risk scanning (Phase 3)
- User can dismiss, snooze, or escalate alerts

**Components:**
- `NotificationBell.tsx` — Top bar icon with unread count
- `AlertDropdown.tsx` — Notification list dropdown
- `AlertBanner.tsx` — Page-level critical alert banner
- `AlertItem.tsx` — Single alert with actions

### 0.6 Role-Adaptive Views

**Current:** Same dashboard for all roles, some buttons hidden by role check.

**New:** Fundamentally different experiences per role:

**Minister View:**
- National overview map with region health indicators
- Cross-region comparison charts
- AI-generated national briefing
- Portfolio-level risk heat map
- No project-level detail (drill down to region first)

**REO View:**
- Region-focused dashboard
- Projects in their region only
- Regional risk and weather forecasts
- Citizen issue queue (future)
- AI regional briefing

**PM View:**
- Project-focused dashboard (their assigned projects)
- Detailed task and schedule management
- AI assistant tuned for execution questions
- Resource and budget tracking

**Citizen View:**
- Public region information
- Project transparency (status, timeline)
- Issue reporting (future)
- No management capabilities

**Components:**
- `MinisterDashboard.tsx` — National overview with region map
- `REODashboard.tsx` — Regional focus with project list
- `PMDashboard.tsx` — Project execution focus
- `CitizenPortal.tsx` — Public-facing information view
- Dashboard router selects component based on `user.role`

### 0.7 Report Views

**Current:** No report pages exist.

**New:** Dedicated report section for AI-generated reports:

- Weekly/monthly status reports (auto-generated by AI)
- Risk assessment reports
- Budget forecast reports
- Resource utilization reports
- Export to PDF
- Report scheduling (auto-generate every Monday)
- Report history and comparison

**Components:**
- `ReportsPage.tsx` — Report list and generation
- `ReportViewer.tsx` — View a generated report
- `ReportScheduler.tsx` — Configure automatic report generation

### 0.8 Design System Updates

**Keep:**
- Tailwind CSS (utility-first approach)
- Lucide React icons
- Blue/gray color palette
- Responsive grid system

**Add:**
- CSS custom properties for theme tokens (prep for dark mode later)
- Consistent spacing scale documented
- AI-specific colors: confidence indicators (green/yellow/red gradient)
- Streaming text animation styles
- Skeleton loaders for AI loading states
- Pulse/glow animation for new AI insights

**New Tailwind config additions:**
```js
// AI-specific colors
colors: {
  ai: {
    primary: '#6366f1',    // Indigo for AI elements
    surface: '#eef2ff',    // Light indigo background
    border: '#c7d2fe',     // Indigo border
  },
  confidence: {
    high: '#22c55e',       // Green
    medium: '#f59e0b',     // Amber
    low: '#ef4444',        // Red
  },
  risk: {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  }
}
```

---

## Phase 0 Deliverables Summary

| Component | Replaces | Purpose |
|-----------|----------|---------|
| `AppLayout.tsx` | `AppShell.tsx` | Three-column layout shell |
| `Sidebar.tsx` | Header action buttons | Persistent navigation |
| `TopBar.tsx` | Current header | Breadcrumbs, search, alerts, user menu |
| `AIChatPanel.tsx` | `AIAssistant.tsx` modal | Always-visible AI assistant |
| `AISummaryBanner.tsx` | — | AI daily briefing on dashboard |
| `PredictionCards.tsx` | — | Risk/weather/budget forecast cards |
| `ProjectCardGrid.tsx` | 18-column table | Card-based project list |
| `AIInsightFeed.tsx` | — | Scrollable AI observations |
| `NotificationBell.tsx` | — | Alert system with unread count |
| `AlertDropdown.tsx` | — | Alert notification list |
| `MinisterDashboard.tsx` | — | Role: national overview |
| `REODashboard.tsx` | — | Role: regional focus |
| `PMDashboard.tsx` | `DashboardPage.tsx` | Role: project execution |
| `CitizenPortal.tsx` | `RegionInfoPage.tsx` | Role: public view |
| `ReportsPage.tsx` | — | AI-generated reports |
| `ForecastCard.tsx` | — | Prediction display with confidence |
| `RiskPredictionPanel.tsx` | RAID tab | AI risk register |
| `WeatherOverlay.tsx` | — | Weather on Gantt chart |

**Note:** Phase 0 builds the **shell and layout** with placeholder data. Real AI data flows in as Phases 1-5 are completed. This means the UI is ready to receive AI content the moment the backend produces it.

---

## Phase 1: AI Foundation Layer (Build First)

> Everything depends on this. No AI features work without it.

### 1.1 Claude API Integration Service

**What:** A clean, reusable service layer for calling Claude API from the backend.

**Why first:** Every AI feature in Phases 2-5 calls through this layer. Build it once, use it everywhere.

**Details:**
- Anthropic SDK integration (`@anthropic-ai/sdk`)
- Configuration: API key, model selection, token limits, temperature via environment variables
- Request/response abstraction so the LLM provider can be swapped later (Claude today, OpenAI tomorrow)
- Structured output parsing (JSON mode for reliable data extraction)
- Prompt template management system (versioned prompts stored as templates, not hardcoded strings)
- Rate limiting and retry logic with exponential backoff
- Token usage tracking and cost monitoring per request
- Streaming support for long-running AI responses
- Error handling with graceful fallbacks (if AI is down, app still works)

**Config additions:**
```
ANTHROPIC_API_KEY=
AI_MODEL=claude-sonnet-4-5-20250929
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.3
AI_ENABLED=true  # Kill switch to disable all AI features
```

**Database additions:**
```sql
CREATE TABLE ai_usage_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    feature VARCHAR(100),        -- e.g., 'task_breakdown', 'risk_assessment'
    model VARCHAR(100),
    input_tokens INT,
    output_tokens INT,
    cost_estimate DECIMAL(10,6),
    latency_ms INT,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 AI Context Builder

**What:** A service that assembles rich project context for every AI call.

**Why:** Claude gives better answers when it understands the full project. Every AI feature needs project context.

**Details:**
- Pulls project metadata, tasks, schedules, team, budget, history into a structured context object
- Compresses context intelligently to fit token limits (summarize old data, keep recent data detailed)
- Builds role-aware context (PM sees different AI insights than Minister)
- Caches assembled context to avoid redundant DB queries
- Includes region-specific context (local conditions, regulatory requirements)

### 1.3 External Data Provider Abstraction

**What:** A pluggable adapter pattern for external data sources (weather, economics, supply chain).

**Why:** AI predictions are only as good as their input data. Build the abstraction now so any data source can plug in later.

**Details:**
- `DataProvider` interface: `{ fetchData(params): Promise<ExternalData> }`
- Weather provider adapter (pluggable - OpenWeatherMap, WeatherAPI, AccuWeather, or any provider)
- Placeholder adapters for future sources (supply chain, economic indicators, resource markets)
- Response normalization (every provider returns the same shape)
- Caching layer (weather doesn't change every second)
- Fallback behavior when external APIs are unavailable
- Configuration per provider (API keys, refresh intervals, region mappings)

**Config additions:**
```
WEATHER_API_PROVIDER=openweathermap  # or weatherapi, accuweather, etc.
WEATHER_API_KEY=
WEATHER_CACHE_MINUTES=60
```

**Database additions:**
```sql
CREATE TABLE external_data_cache (
    id VARCHAR(36) PRIMARY KEY,
    provider VARCHAR(100),
    data_type VARCHAR(100),      -- 'weather_forecast', 'supply_price', etc.
    region_id VARCHAR(36),
    query_params JSON,
    response_data JSON,
    fetched_at TIMESTAMP,
    expires_at TIMESTAMP,
    INDEX idx_provider_type (provider, data_type),
    INDEX idx_region (region_id),
    INDEX idx_expires (expires_at)
);
```

---

## Phase 2: Replace Fake AI with Real AI

> Retrofit existing "AI" features with actual Claude-powered intelligence.

### 2.1 Intelligent Task Breakdown (Replace Current Stub)

**What:** Replace the keyword-matching + hardcoded templates with Claude-powered project analysis.

**Current state:** `aiTaskBreakdown.ts` uses `string.includes()` and returns from 6 hardcoded template lists.

**New behavior:**
- PM describes project in natural language
- Claude analyzes description, asks clarifying questions if needed
- Generates tailored task breakdown specific to THIS project (not generic templates)
- Estimates durations based on project context, team size, complexity
- Suggests dependencies based on actual task relationships
- Assigns complexity and risk levels with reasoning
- Considers region-specific factors (climate, regulations, logistics)
- Output validated against Zod schema before returning to client

**Prompt strategy:** System prompt includes project management best practices, PMBOK framework, and construction/infrastructure domain knowledge relevant to government projects.

### 2.2 Smart Dependency Detection (Replace Current Stub)

**What:** Replace hardcoded "planning before design" rules with context-aware dependency analysis.

**Current state:** `generateDependencySuggestions()` uses hardcoded category keyword rules.

**New behavior:**
- Claude reads all tasks in a project and identifies logical dependencies
- Considers resource sharing (same person can't do two tasks simultaneously)
- Identifies critical path and flags it
- Explains WHY each dependency exists (not just "planning before design")
- Suggests parallel tracks where tasks can run concurrently
- Detects circular dependency risks before they happen

### 2.3 Schedule Optimization (Replace Current Stub)

**What:** Implement the completely stubbed `optimizeSchedule()` endpoint.

**Current state:** Returns empty arrays with a TODO comment.

**New behavior:**
- Analyzes current schedule for inefficiencies
- Identifies resource over-allocation and suggests leveling
- Finds schedule compression opportunities (fast-tracking, crashing)
- Suggests task reordering to reduce total project duration
- Considers resource availability and constraints
- Provides before/after comparison with improvement metrics
- Claude explains each optimization recommendation

### 2.4 Project Insights (Replace Current Stub)

**What:** Implement the completely stubbed `generateProjectInsights()` endpoint.

**Current state:** Returns empty objects with a TODO comment.

**New behavior:**
- Analyzes project health based on task completion rates, budget burn, and schedule variance
- Generates natural language summary of project status
- Identifies trends (is the project accelerating or decelerating?)
- Compares against similar past projects if historical data exists
- Provides actionable recommendations (not just "project is behind")
- Risk indicators with severity and suggested mitigations

---

## Phase 3: Predictive Intelligence (New Capabilities)

> This is where the app starts doing things no traditional PM tool can do.

### 3.1 Risk Prediction Engine

**What:** Proactive risk identification and scoring using AI + external data.

**Why:** PMs currently discover risks reactively. This flips it to proactive.

**Details:**
- Continuous background risk scanning for active projects
- Multi-factor risk scoring:
  - **Schedule risk:** Tasks behind schedule, dependency chain fragility, critical path slack
  - **Resource risk:** Overallocation, single points of failure, skill gaps
  - **Budget risk:** Burn rate vs. progress, cost variance trends
  - **External risk:** Weather impact on outdoor work, supply chain delays
  - **Scope risk:** Requirement changes, task additions mid-project
- Claude synthesizes all risk factors into prioritized risk register
- Risk evolution tracking (is a risk growing or shrinking?)
- Automated risk alerts when thresholds are crossed
- Suggested mitigation strategies for each risk

**Database additions:**
```sql
CREATE TABLE ai_risk_assessments (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    risk_type ENUM('schedule', 'resource', 'budget', 'weather', 'supply_chain', 'scope', 'quality', 'external'),
    severity ENUM('low', 'medium', 'high', 'critical'),
    probability DECIMAL(3,2),        -- 0.00 to 1.00
    impact_score INT,                -- 1-100
    overall_risk_score INT,          -- 1-100 (probability x impact)
    title VARCHAR(255),
    description TEXT,
    affected_tasks JSON,             -- Array of task IDs
    data_sources JSON,               -- What data informed this risk
    ai_reasoning TEXT,               -- Claude's explanation
    suggested_mitigations JSON,      -- Array of mitigation strategies
    status ENUM('identified', 'monitoring', 'mitigating', 'resolved', 'accepted') DEFAULT 'identified',
    identified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_project_severity (project_id, severity),
    INDEX idx_status (status),
    INDEX idx_risk_score (overall_risk_score DESC)
);
```

### 3.2 Weather Impact Analysis

**What:** Correlate weather forecasts with project schedules to predict delays.

**Details:**
- Fetch weather forecasts for project regions via pluggable weather API
- Identify outdoor/weather-sensitive tasks (construction, surveying, transport)
- Claude analyzes which tasks are affected by upcoming weather conditions
- Predict delay days based on weather severity and task type
- Suggest schedule adjustments (move indoor tasks forward during bad weather)
- Historical weather pattern analysis for long-term planning
- Configurable weather sensitivity per task type (heavy rain stops concrete pouring, light rain doesn't stop painting indoors)

**Output example:**
```json
{
  "project": "Region 5 Bridge Construction",
  "weather_risks": [
    {
      "period": "Feb 15-22",
      "condition": "Heavy rainfall (120mm expected)",
      "affected_tasks": ["Foundation Pouring", "Steel Erection"],
      "estimated_delay_days": 5,
      "recommendation": "Accelerate indoor prefab work this week, reschedule foundation pour to Feb 23",
      "confidence": 0.78
    }
  ]
}
```

### 3.3 Resource Conflict Prediction

**What:** Detect and predict resource bottlenecks before they happen.

**Details:**
- Analyze resource allocation across ALL projects (not just one)
- Detect when the same person/team is over-committed in future weeks
- Predict skill shortages based on upcoming task requirements
- Suggest resource rebalancing across projects
- "What happens if Person X is unavailable for 2 weeks?" scenario modeling
- Flag single points of failure (only one person can do a critical task)

### 3.4 Budget Overrun Forecasting

**What:** Predict budget outcomes based on spending patterns and progress.

**Details:**
- Track actual vs. planned spending over time
- Calculate Earned Value metrics (CPI, SPI, EAC, ETC) and have Claude interpret them
- Predict final project cost based on current burn rate and remaining work
- Identify cost drivers (which tasks are over budget and why)
- Compare against similar completed projects
- Early warning when a project is trending toward overrun
- Suggest corrective actions (reduce scope, increase efficiency, reallocate budget)

---

## Phase 4: AI-Powered PM Workflows

> Automate the tedious parts of project management.

### 4.1 Natural Language Project Creation

**What:** PM describes project in plain English, AI creates the full project structure.

**Details:**
- Conversational interface: "Build a 2km road in Region 3, budget $500K, needs to be done by December"
- Claude creates: project record, phases, task breakdown, schedule, dependencies, milestones
- PM reviews and adjusts before confirming
- Learns from PM's adjustments to improve future suggestions
- Handles follow-up: "Actually, add a drainage component too"

### 4.2 AI Status Report Generator

**What:** Automatically generate weekly/monthly project status reports.

**Details:**
- Pulls all project data (task progress, budget, risks, recent activity)
- Claude generates executive summary tailored to audience:
  - Minister: high-level, multi-region summary
  - REO: regional detail with action items
  - PM: detailed technical status with blockers
- Highlights what changed since last report
- Includes risk callouts and recommended actions
- Export to PDF/email format

### 4.3 Meeting Notes to Tasks

**What:** Upload meeting notes or minutes, AI extracts action items and creates tasks.

**Details:**
- Accept text input (paste meeting notes) or file upload
- Claude identifies: action items, owners, deadlines, decisions made
- Maps action items to existing projects and creates tasks
- Links related tasks and updates dependencies
- Flags items that don't map to any existing project (new project needed?)

### 4.4 Conversational Project Query ("Ask Your Project")

**What:** PMs can ask questions about their projects in natural language.

**Details:**
- "Which tasks are at risk this week?"
- "Who is overloaded right now?"
- "What's blocking the foundation work?"
- "Compare Region 3 vs Region 7 project progress"
- "What should I focus on today?"
- Context-aware: Claude knows the PM's projects, role, and region
- Can drill down: "Tell me more about that risk" (maintains conversation context)
- Backed by real data queries, not hallucinated answers

**Database additions:**
```sql
CREATE TABLE ai_conversations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36),          -- NULL for cross-project queries
    context_type ENUM('project', 'portfolio', 'region', 'system'),
    messages JSON,                    -- Array of {role, content, timestamp}
    token_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_project (project_id)
);
```

---

## Phase 5: Learning & Advanced Intelligence

> The system gets smarter over time.

### 5.1 Historical Learning System (Replace Current Stub)

**What:** Replace the in-memory-only learning stub with real persistent learning.

**Current state:** `aiLearning.ts` never saves data, all methods return original values unchanged.

**New behavior:**
- Persist all PM feedback on AI suggestions (accepted, modified, rejected)
- Track actual vs. estimated task durations after project completion
- Build accuracy profiles per project type, region, and team
- Feed historical patterns back into AI prompts for better predictions
- Dashboard showing AI accuracy metrics over time

**Database additions:**
```sql
CREATE TABLE ai_feedback (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36),
    feature VARCHAR(100),            -- 'task_breakdown', 'risk_prediction', etc.
    suggestion_data JSON,            -- What the AI suggested
    user_action ENUM('accepted', 'modified', 'rejected'),
    modified_data JSON,              -- What the user changed it to (if modified)
    feedback_text TEXT,              -- Optional user comment
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_feature (feature),
    INDEX idx_action (user_action)
);

CREATE TABLE ai_accuracy_tracking (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36),
    metric_type ENUM('duration_estimate', 'cost_estimate', 'risk_prediction', 'dependency_accuracy'),
    predicted_value DECIMAL(10,2),
    actual_value DECIMAL(10,2),
    variance_pct DECIMAL(5,2),
    project_type VARCHAR(100),
    region_id VARCHAR(36),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_metric (metric_type),
    INDEX idx_project_type (project_type),
    INDEX idx_region (region_id)
);
```

### 5.2 What-If Scenario Modeling

**What:** PMs can model scenarios and see predicted outcomes.

**Details:**
- "What if we add 3 more workers to Region 5?"
- "What if the budget is cut by 20%?"
- "What if monsoon season extends 2 weeks?"
- "What if we delay Phase 2 by a month?"
- Claude models the cascading effects across tasks, schedule, budget, and resources
- Side-by-side comparison of scenarios
- Saves scenarios for review and decision-making

### 5.3 Cross-Project Intelligence

**What:** AI insights across the entire project portfolio.

**Details:**
- Detect resource conflicts between projects in the same region
- Identify projects that could share resources or learnings
- Portfolio-level risk heat map
- Budget reallocation suggestions across projects
- "Project X succeeded with this approach, Project Y (similar scope) should consider the same"
- Minister-level dashboard: AI-generated national project health summary

### 5.4 Anomaly Detection

**What:** Automatically detect unusual patterns that might indicate problems.

**Details:**
- Sudden drop in task completion rate
- Unusual budget spending patterns (spike or flatline)
- Tasks that keep getting rescheduled
- Projects where no one has logged activity in X days
- Cost anomalies compared to similar projects
- Claude explains what the anomaly might mean and recommends investigation

---

## Summary: Build Order & Dependencies

```
Phase 0 (UI Redesign)
========================
0.1 App Shell & Layout ----+
0.2 Dashboard Redesign     |
0.3 Project Detail Redesign|---> Ready to receive AI data
0.4 AI Chat Panel          |
0.5 Alert System UI        |
0.6 Role-Adaptive Views    |
0.7 Report Views           |
0.8 Design System Updates -+

        |
        v

Phase 1 (Foundation)          Phase 2 (Replace Stubs)       Phase 3 (Predictions)
========================      ========================      ========================
1.1 Claude API Service   ---> 2.1 Task Breakdown       ---> 3.1 Risk Engine
1.2 Context Builder      ---> 2.2 Dependency Detection  ---> 3.2 Weather Impact
1.3 Data Provider Layer  ---> 2.3 Schedule Optimization ---> 3.3 Resource Prediction
                              2.4 Project Insights      ---> 3.4 Budget Forecasting

Phase 4 (Workflows)           Phase 5 (Learning)
========================      ========================
4.1 NL Project Creation       5.1 Historical Learning
4.2 Status Reports            5.2 What-If Scenarios
4.3 Meeting -> Tasks          5.3 Cross-Project Intel
4.4 Ask Your Project          5.4 Anomaly Detection
```

**Phase 0** builds the UI shell with placeholder data — can run in parallel with Phase 1.
**Phase 1** must be complete before Phases 2-5.
**Phases 2-4** can be worked on in parallel once Phase 1 is done.
**Phase 5** benefits from data accumulated during Phases 2-4.

---

## Non-Functional Requirements (All Phases)

- **Graceful degradation:** If Claude API is down, app works normally without AI features
- **Cost control:** Token budget per user/project, usage dashboard for admins
- **Latency:** AI responses should target <5s for interactive features, background tasks can be async
- **Privacy:** No sensitive project data sent to AI without user consent configuration
- **Audit trail:** Every AI interaction logged (who asked, what context, what was returned)
- **Prompt versioning:** All prompts version-controlled, A/B testable
- **Feature flags:** Each AI feature can be toggled independently
