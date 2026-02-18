import { FastifyInstance } from 'fastify';
import { ProjectService } from './ProjectService';
import { ScheduleService } from './ScheduleService';

export interface ProjectContext {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
    priority: string;
    projectType: string;
    budgetAllocated?: number;
    budgetSpent?: number;
    startDate?: string;
    endDate?: string;
    location?: string;
    locationLat?: number;
    locationLon?: number;
    completionPercentage?: number;
  };
  schedules: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    tasks: Array<{
      id: string;
      name: string;
      status: string;
      priority: string;
      estimatedDays?: number;
      progressPercentage?: number;
      dueDate?: string;
    }>;
  }>;
}

export interface PortfolioContext {
  totalProjects: number;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    projectType: string;
    budgetAllocated?: number;
    budgetSpent?: number;
    startDate?: string;
    endDate?: string;
    locationLat?: number;
    locationLon?: number;
    completionPercentage?: number;
  }>;
  summary: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    totalBudget: number;
    totalSpent: number;
  };
}

export class AIContextBuilder {
  private fastify: FastifyInstance;
  private projectService: ProjectService;
  private scheduleService: ScheduleService;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.projectService = new ProjectService();
    this.scheduleService = new ScheduleService();
  }

  async buildProjectContext(projectId: string, userId?: string): Promise<ProjectContext> {
    const project = userId
      ? await this.projectService.findById(projectId, userId)
      : await this.projectService.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const schedules = await this.scheduleService.findByProjectId(projectId);
    const schedulesWithTasks = await Promise.all(
      schedules.map(async (schedule: any) => {
        const tasks = await this.scheduleService.findTasksByScheduleId(schedule.id);
        return {
          id: schedule.id,
          name: schedule.name,
          startDate: schedule.startDate?.toISOString?.() || String(schedule.startDate),
          endDate: schedule.endDate?.toISOString?.() || String(schedule.endDate),
          tasks: tasks.map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            estimatedDays: t.estimatedDays,
            progressPercentage: t.progressPercentage,
            dueDate: t.dueDate?.toISOString?.() || t.dueDate,
          })),
        };
      }),
    );

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        projectType: project.projectType || 'other',
        budgetAllocated: project.budgetAllocated,
        budgetSpent: project.budgetSpent,
        startDate: project.startDate?.toISOString?.() || project.startDate,
        endDate: project.endDate?.toISOString?.() || project.endDate,
        location: project.location,
        locationLat: project.locationLat,
        locationLon: project.locationLon,
        completionPercentage: project.completionPercentage,
      },
      schedules: schedulesWithTasks,
    };
  }

  async buildPortfolioContext(userId?: string): Promise<PortfolioContext> {
    const projects = userId
      ? await this.projectService.findByUserId(userId)
      : await this.projectService.findAll();

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalBudget = 0;
    let totalSpent = 0;

    const projectSummaries = projects.map((p: any) => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      byPriority[p.priority] = (byPriority[p.priority] || 0) + 1;
      totalBudget += p.budgetAllocated || 0;
      totalSpent += p.budgetSpent || 0;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        projectType: p.projectType || 'other',
        budgetAllocated: p.budgetAllocated,
        budgetSpent: p.budgetSpent,
        startDate: p.startDate?.toISOString?.() || p.startDate,
        endDate: p.endDate?.toISOString?.() || p.endDate,
        locationLat: p.locationLat,
        locationLon: p.locationLon,
        completionPercentage: p.completionPercentage,
      };
    });

    return {
      totalProjects: projects.length,
      projects: projectSummaries,
      summary: { byStatus, byPriority, totalBudget, totalSpent },
    };
  }

  toPromptString(ctx: ProjectContext): string {
    let s = `Project: ${ctx.project.name}\n`;
    s += `Type: ${ctx.project.projectType}\n`;
    s += `Status: ${ctx.project.status} | Priority: ${ctx.project.priority}\n`;
    if (ctx.project.description) s += `Description: ${ctx.project.description}\n`;
    if (ctx.project.budgetAllocated) s += `Budget: $${ctx.project.budgetAllocated.toLocaleString()} allocated, $${(ctx.project.budgetSpent || 0).toLocaleString()} spent\n`;
    if (ctx.project.completionPercentage !== undefined) s += `Completion: ${ctx.project.completionPercentage}%\n`;
    if (ctx.project.location) s += `Location: ${ctx.project.location}\n`;

    if (ctx.schedules.length > 0) {
      s += `\nSchedules (${ctx.schedules.length}):\n`;
      for (const sched of ctx.schedules) {
        s += `  - ${sched.name} (${sched.startDate} to ${sched.endDate})\n`;
        s += `    Tasks (${sched.tasks.length}):\n`;
        for (const task of sched.tasks) {
          s += `      * ${task.name} [${task.status}] priority=${task.priority}`;
          if (task.estimatedDays) s += ` est=${task.estimatedDays}d`;
          if (task.progressPercentage) s += ` progress=${task.progressPercentage}%`;
          s += '\n';
        }
      }
    }

    return s;
  }

  portfolioToPromptString(ctx: PortfolioContext): string {
    let s = `Portfolio Overview: ${ctx.totalProjects} projects\n`;
    s += `Total Budget: $${ctx.summary.totalBudget.toLocaleString()} | Spent: $${ctx.summary.totalSpent.toLocaleString()}\n`;
    s += `By Status: ${Object.entries(ctx.summary.byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
    s += `By Priority: ${Object.entries(ctx.summary.byPriority).map(([k, v]) => `${k}=${v}`).join(', ')}\n\n`;

    for (const p of ctx.projects) {
      s += `- ${p.name} [${p.status}] type=${p.projectType} priority=${p.priority}`;
      if (p.budgetAllocated) s += ` budget=$${p.budgetAllocated.toLocaleString()}`;
      if (p.completionPercentage !== undefined) s += ` completion=${p.completionPercentage}%`;
      s += '\n';
    }

    return s;
  }
}
