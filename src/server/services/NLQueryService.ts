import Anthropic from '@anthropic-ai/sdk';
import { claudeService } from '../services/claudeService';
import { ProjectService } from '../services/ProjectService';
import { ScheduleService } from '../services/ScheduleService';
import { ResourceService } from '../services/ResourceService';
import { CriticalPathService } from '../services/CriticalPathService';
import { SCurveService } from '../services/SCurveService';
import { config } from '../config';
import {
  NLQueryAIResponseSchema,
  type NLQueryResult,
  type NLQueryAIResponse,
} from '../schemas/nlQuerySchemas';

// ---------------------------------------------------------------------------
// System prompt for the tool-loop phase (data gathering)
// ---------------------------------------------------------------------------

const TOOL_LOOP_SYSTEM_PROMPT = `You are an expert project management analytics assistant embedded in a PM application.
Your job is to answer the user's natural-language questions about their projects, schedules, resources, budgets, and risks.

IMPORTANT INSTRUCTIONS:
1. **Always use the available tools** to gather real, up-to-date data before answering. Never fabricate numbers.
2. Start broad (e.g. list_projects or aggregate_portfolio_stats) then drill into specifics as needed.
3. If the user mentions a specific project, use get_project_details to fetch its data.
4. For budget/EVM questions, use get_evm_metrics. For schedule risk, use get_critical_path.
5. For resource questions, use get_resource_workload.
6. Provide specific numbers, percentages, and dates drawn from tool results.
7. After gathering all necessary data, write a thorough, well-structured answer in markdown.
8. Suggest relevant charts to visualize the data (bar, line, pie, horizontal_bar).
9. Suggest 2-4 follow-up questions the user might want to ask next.

You have access to READ-ONLY tools. You cannot modify any project data.`;

// ---------------------------------------------------------------------------
// System prompt for the structuring phase (JSON output)
// ---------------------------------------------------------------------------

const STRUCTURING_SYSTEM_PROMPT = `You are a data formatting assistant. You will receive a natural-language answer about project management data.
Your job is to re-format it into a structured JSON object with these fields:

- "answer": The full markdown-formatted answer (preserve all detail, numbers, and formatting).
- "charts": An array of chart specifications. Each chart has:
    - "type": one of "bar", "line", "pie", "horizontal_bar"
    - "title": descriptive chart title
    - "data": array of { "label": string, "value": number, "color"?: string, "group"?: string }
    - "xAxisLabel"?: string
    - "yAxisLabel"?: string
  Only include charts when the data naturally lends itself to visualization. Use an empty array if no chart is appropriate.
- "suggestedFollowUps": An array of 2-4 follow-up question strings.

Return ONLY valid JSON. No markdown fences, no explanation.`;

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic.Tool format)
// ---------------------------------------------------------------------------

function buildToolDefinitions(): Anthropic.Tool[] {
  return [
    {
      name: 'list_projects',
      description:
        'List all projects in the portfolio with their name, status, priority, budget, and dates. Use this to get an overview or when the user asks about multiple projects.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_project_details',
      description:
        'Get detailed information about a specific project including its schedules and all tasks. Use this when the user asks about a particular project.',
      input_schema: {
        type: 'object' as const,
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to look up',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'list_tasks',
      description:
        'List all tasks for a given schedule, including status, progress, dates, and dependencies.',
      input_schema: {
        type: 'object' as const,
        properties: {
          scheduleId: {
            type: 'string',
            description: 'The schedule ID whose tasks to list',
          },
        },
        required: ['scheduleId'],
      },
    },
    {
      name: 'get_resource_workload',
      description:
        'Get resource workload and utilization data for a project, including weekly allocations and over-allocation flags.',
      input_schema: {
        type: 'object' as const,
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to compute workload for',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_evm_metrics',
      description:
        'Get Earned Value Management (EVM) metrics for a project: S-curve data points (PV, EV, AC over time) plus computed CPI, SPI, and EAC. Use for budget and schedule performance questions.',
      input_schema: {
        type: 'object' as const,
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to compute EVM metrics for',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_critical_path',
      description:
        'Calculate the critical path for a schedule using CPM. Returns critical tasks, float values, and total project duration in days.',
      input_schema: {
        type: 'object' as const,
        properties: {
          scheduleId: {
            type: 'string',
            description: 'The schedule ID to analyse',
          },
        },
        required: ['scheduleId'],
      },
    },
    {
      name: 'aggregate_portfolio_stats',
      description:
        'Aggregate high-level portfolio statistics: total projects, total budget allocated & spent, status breakdown, priority breakdown, and project type breakdown. Use for portfolio-level or dashboard-level questions.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Tool execution dispatcher
// ---------------------------------------------------------------------------

async function executeToolFn(
  toolName: string,
  toolInput: Record<string, any>,
): Promise<string> {
  const projectService = new ProjectService();
  const scheduleService = new ScheduleService();
  const resourceService = new ResourceService();
  const criticalPathService = new CriticalPathService();
  const sCurveService = new SCurveService();

  switch (toolName) {
    // ----- list_projects -----
    case 'list_projects': {
      const projects = await projectService.findAll();
      const summary = projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        projectType: p.projectType,
        budgetAllocated: p.budgetAllocated,
        budgetSpent: p.budgetSpent,
        currency: p.currency,
        startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
      }));
      return JSON.stringify(summary, null, 2);
    }

    // ----- get_project_details -----
    case 'get_project_details': {
      const projectId = toolInput.projectId as string;
      const project = await projectService.findById(projectId);
      if (!project) return JSON.stringify({ error: `Project ${projectId} not found` });

      const schedules = await scheduleService.findByProjectId(projectId);
      const schedulesWithTasks = [];
      for (const sch of schedules) {
        const tasks = await scheduleService.findTasksByScheduleId(sch.id);
        schedulesWithTasks.push({
          id: sch.id,
          name: sch.name,
          status: sch.status,
          startDate: sch.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: sch.endDate?.toISOString().slice(0, 10) ?? null,
          tasks: tasks.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            progressPercentage: t.progressPercentage ?? 0,
            startDate: t.startDate?.toISOString().slice(0, 10) ?? null,
            endDate: t.endDate?.toISOString().slice(0, 10) ?? null,
            dependency: t.dependency ?? null,
            assignedTo: t.assignedTo ?? null,
          })),
        });
      }

      return JSON.stringify(
        {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          projectType: project.projectType,
          budgetAllocated: project.budgetAllocated,
          budgetSpent: project.budgetSpent,
          currency: project.currency,
          location: project.location,
          startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
          schedules: schedulesWithTasks,
        },
        null,
        2,
      );
    }

    // ----- list_tasks -----
    case 'list_tasks': {
      const scheduleId = toolInput.scheduleId as string;
      const tasks = await scheduleService.findTasksByScheduleId(scheduleId);
      const summary = tasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        priority: t.priority,
        progressPercentage: t.progressPercentage ?? 0,
        startDate: t.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: t.endDate?.toISOString().slice(0, 10) ?? null,
        dependency: t.dependency ?? null,
        parentTaskId: t.parentTaskId ?? null,
        assignedTo: t.assignedTo ?? null,
      }));
      return JSON.stringify(summary, null, 2);
    }

    // ----- get_resource_workload -----
    case 'get_resource_workload': {
      const projectId = toolInput.projectId as string;
      const workloads = await resourceService.computeWorkload(projectId);
      return JSON.stringify(workloads, null, 2);
    }

    // ----- get_evm_metrics -----
    case 'get_evm_metrics': {
      const projectId = toolInput.projectId as string;
      const sCurveData = await sCurveService.computeSCurveData(projectId);

      // Compute CPI, SPI, EAC from the latest data point at or before today
      const now = new Date().toISOString().slice(0, 10);
      const currentPoint = [...sCurveData]
        .reverse()
        .find((dp) => dp.date <= now) ?? sCurveData[sCurveData.length - 1];

      let cpi: number | null = null;
      let spi: number | null = null;
      let eac: number | null = null;

      if (currentPoint) {
        cpi = currentPoint.ac > 0 ? +(currentPoint.ev / currentPoint.ac).toFixed(3) : null;
        spi = currentPoint.pv > 0 ? +(currentPoint.ev / currentPoint.pv).toFixed(3) : null;

        const project = await projectService.findById(projectId);
        const bac = project?.budgetAllocated ?? 0;
        eac = cpi && cpi > 0 ? Math.round(bac / cpi) : null;
      }

      return JSON.stringify(
        {
          sCurveData,
          currentMetrics: currentPoint
            ? {
                date: currentPoint.date,
                pv: currentPoint.pv,
                ev: currentPoint.ev,
                ac: currentPoint.ac,
                cpi,
                spi,
                eac,
              }
            : null,
        },
        null,
        2,
      );
    }

    // ----- get_critical_path -----
    case 'get_critical_path': {
      const scheduleId = toolInput.scheduleId as string;
      const result = await criticalPathService.calculateCriticalPath(scheduleId);
      return JSON.stringify(result, null, 2);
    }

    // ----- aggregate_portfolio_stats -----
    case 'aggregate_portfolio_stats': {
      const projects = await projectService.findAll();
      const allTasks = await scheduleService.findAllTasks();

      const totalBudgetAllocated = projects.reduce((s, p) => s + (p.budgetAllocated ?? 0), 0);
      const totalBudgetSpent = projects.reduce((s, p) => s + (p.budgetSpent ?? 0), 0);

      const statusBreakdown: Record<string, number> = {};
      const priorityBreakdown: Record<string, number> = {};
      const typeBreakdown: Record<string, number> = {};

      for (const p of projects) {
        statusBreakdown[p.status] = (statusBreakdown[p.status] ?? 0) + 1;
        priorityBreakdown[p.priority] = (priorityBreakdown[p.priority] ?? 0) + 1;
        typeBreakdown[p.projectType] = (typeBreakdown[p.projectType] ?? 0) + 1;
      }

      const taskStatusBreakdown: Record<string, number> = {};
      for (const t of allTasks) {
        taskStatusBreakdown[t.status] = (taskStatusBreakdown[t.status] ?? 0) + 1;
      }

      const totalProgress =
        allTasks.length > 0
          ? Math.round(
              allTasks.reduce((s, t) => s + (t.progressPercentage ?? 0), 0) / allTasks.length,
            )
          : 0;

      return JSON.stringify(
        {
          totalProjects: projects.length,
          totalTasks: allTasks.length,
          totalBudgetAllocated,
          totalBudgetSpent,
          budgetUtilization:
            totalBudgetAllocated > 0
              ? +((totalBudgetSpent / totalBudgetAllocated) * 100).toFixed(1)
              : 0,
          projectStatusBreakdown: statusBreakdown,
          projectPriorityBreakdown: priorityBreakdown,
          projectTypeBreakdown: typeBreakdown,
          taskStatusBreakdown,
          averageTaskProgress: totalProgress,
        },
        null,
        2,
      );
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ---------------------------------------------------------------------------
// NLQueryService
// ---------------------------------------------------------------------------

export class NLQueryService {
  /**
   * Process a natural-language query about project data.
   *
   * 1. Runs a tool loop so the AI can gather real data via read-only tools.
   * 2. Structures the AI's free-text answer into JSON with chart specs.
   * 3. Returns a typed NLQueryResult.
   */
  async processQuery(
    query: string,
    context?: { projectId?: string },
    userId?: string,
  ): Promise<NLQueryResult> {
    if (!config.AI_ENABLED) {
      throw new Error(
        'AI features are disabled. Enable AI_ENABLED and set ANTHROPIC_API_KEY to use natural language queries.',
      );
    }

    if (!claudeService.isAvailable()) {
      throw new Error(
        'AI service is unavailable. Ensure ANTHROPIC_API_KEY is configured correctly.',
      );
    }

    // Build contextual user message
    let userMessage = query;
    if (context?.projectId) {
      userMessage += `\n\n[Context: The user is currently viewing project ID "${context.projectId}". Prioritise data from this project.]`;
    }

    const tools = buildToolDefinitions();

    // ------------------------------------------------------------------
    // Phase 1: Tool loop — let the AI call tools to gather data
    // ------------------------------------------------------------------
    const toolLoopResult = await claudeService.completeToolLoop({
      systemPrompt: TOOL_LOOP_SYSTEM_PROMPT,
      userMessage,
      tools,
      executeToolFn,
      maxIterations: 6,
      temperature: 0.2,
    });

    // Collect which data sources (tools) were used
    const dataSources = Array.from(
      new Set(toolLoopResult.toolResults.map((tr) => tr.toolName)),
    );

    // ------------------------------------------------------------------
    // Phase 2: Structure the free-text answer into JSON with charts
    // ------------------------------------------------------------------
    const structuredResult = await claudeService.completeWithJsonSchema<NLQueryAIResponse>({
      systemPrompt: STRUCTURING_SYSTEM_PROMPT,
      userMessage: `Here is the raw answer to structure:\n\n${toolLoopResult.finalText}`,
      schema: NLQueryAIResponseSchema,
      maxTokens: 4096,
      temperature: 0.1,
    });

    // Compute a simple confidence heuristic based on tools used
    const confidence = this.computeConfidence(dataSources, toolLoopResult.finalText);

    return {
      answer: structuredResult.data.answer,
      charts: structuredResult.data.charts,
      dataSources,
      confidence,
      suggestedFollowUps: structuredResult.data.suggestedFollowUps,
    };
  }

  /**
   * Heuristic confidence score (0-100) based on how much data was gathered.
   */
  private computeConfidence(dataSources: string[], answerText: string): number {
    let score = 40; // baseline

    // More tools used → higher confidence
    score += Math.min(dataSources.length * 10, 30);

    // Longer, more detailed answers tend to be better grounded
    if (answerText.length > 500) score += 10;
    if (answerText.length > 1500) score += 10;

    // If specific numbers appear in the answer, it's more data-driven
    const numberMatches = answerText.match(/\d+[\d,.]*%?/g);
    if (numberMatches && numberMatches.length >= 3) score += 10;

    return Math.min(score, 100);
  }
}
