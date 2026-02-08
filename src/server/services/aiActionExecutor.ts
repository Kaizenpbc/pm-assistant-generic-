// C:\Users\gerog\Documents\pm-assistant-generic\src\server\services\aiActionExecutor.ts

import { ProjectService, type CreateProjectData } from './ProjectService';
import { ScheduleService, type CreateTaskData } from './ScheduleService';
import { UserService } from './UserService';

export interface ActionResult {
  success: boolean;
  toolName: string;
  summary: string;
  data?: any;
  error?: string;
}

export interface ActionContext {
  userId: string;
  userRole: string;
}

export class AIActionExecutor {
  private projectService = new ProjectService();
  private scheduleService = new ScheduleService();
  private userService = new UserService();

  async execute(toolName: string, input: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    try {
      switch (toolName) {
        case 'create_task': return await this.createTask(input, context);
        case 'update_task': return await this.updateTask(input, context);
        case 'delete_task': return await this.deleteTask(input, context);
        case 'create_project': return await this.createProject(input, context);
        case 'update_project': return await this.updateProject(input, context);
        case 'reschedule_task': return await this.rescheduleTask(input, context);
        case 'list_projects': return await this.listProjects(context);
        case 'get_project_details': return await this.getProjectDetails(input, context);
        case 'list_tasks': return await this.listTasks(input, context);
        default:
          return { success: false, toolName, summary: `Unknown tool: ${toolName}`, error: `Tool '${toolName}' is not recognized` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, toolName, summary: `Error executing ${toolName}: ${message}`, error: message };
    }
  }

  private async createTask(input: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const { scheduleId, name, description, priority, assignedTo, dueDate, estimatedDays, parentTaskId } = input;

    // Verify schedule exists
    const schedule = await this.scheduleService.findById(scheduleId);
    if (!schedule) {
      return { success: false, toolName: 'create_task', summary: `Schedule '${scheduleId}' not found`, error: 'Schedule not found' };
    }

    const taskData: CreateTaskData = {
      scheduleId,
      name,
      description,
      priority: priority || 'medium',
      assignedTo,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      estimatedDays,
      parentTaskId,
      createdBy: context.userId,
    };

    const task = await this.scheduleService.createTask(taskData);

    return {
      success: true,
      toolName: 'create_task',
      summary: `Created task "${task.name}" (ID: ${task.id}) in schedule ${scheduleId}${assignedTo ? ` assigned to ${assignedTo}` : ''}${dueDate ? ` due ${dueDate}` : ''}`,
      data: { taskId: task.id, name: task.name, scheduleId, status: task.status, priority: task.priority },
    };
  }

  private async updateTask(input: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const { taskId, ...updates } = input;

    const existing = await this.scheduleService.findTaskById(taskId);
    if (!existing) {
      return { success: false, toolName: 'update_task', summary: `Task '${taskId}' not found`, error: 'Task not found' };
    }

    // Convert date strings
    const updateData: Record<string, any> = { ...updates };
    if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);

    const task = await this.scheduleService.updateTask(taskId, updateData);

    const changes = Object.keys(updates).map(k => `${k}: ${updates[k]}`).join(', ');
    return {
      success: true,
      toolName: 'update_task',
      summary: `Updated task "${existing.name}" (${taskId}): ${changes}`,
      data: { taskId, name: task?.name, status: task?.status, priority: task?.priority },
    };
  }

  private async deleteTask(input: Record<string, any>, _context: ActionContext): Promise<ActionResult> {
    const { taskId } = input;

    const existing = await this.scheduleService.findTaskById(taskId);
    if (!existing) {
      return { success: false, toolName: 'delete_task', summary: `Task '${taskId}' not found`, error: 'Task not found' };
    }

    const deleted = await this.scheduleService.deleteTask(taskId);
    return {
      success: deleted,
      toolName: 'delete_task',
      summary: deleted ? `Deleted task "${existing.name}" (${taskId})` : `Failed to delete task ${taskId}`,
      data: { taskId, name: existing.name },
    };
  }

  private async createProject(input: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const { name, description, projectType, priority, budgetAllocated, startDate, endDate, location } = input;

    const projectData: CreateProjectData = {
      name,
      description,
      projectType: projectType || 'other',
      priority: priority || 'medium',
      budgetAllocated,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      location,
      userId: context.userId,
    };

    const project = await this.projectService.create(projectData);

    // Auto-create a default schedule if dates are provided
    let scheduleId: string | undefined;
    if (startDate && endDate) {
      const schedule = await this.scheduleService.create({
        projectId: project.id,
        name: `${name} - Master Schedule`,
        description: `Primary schedule for ${name}`,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        createdBy: context.userId,
      });
      scheduleId = schedule.id;
    }

    return {
      success: true,
      toolName: 'create_project',
      summary: `Created project "${project.name}" (ID: ${project.id})${budgetAllocated ? ` with $${budgetAllocated.toLocaleString()} budget` : ''}${scheduleId ? ` and schedule ${scheduleId}` : ''}`,
      data: { projectId: project.id, name: project.name, scheduleId, status: project.status },
    };
  }

  private async updateProject(input: Record<string, any>, context: ActionContext): Promise<ActionResult> {
    const { projectId, ...updates } = input;

    const existing = await this.projectService.findById(projectId);
    if (!existing) {
      return { success: false, toolName: 'update_project', summary: `Project '${projectId}' not found`, error: 'Project not found' };
    }

    const project = await this.projectService.update(projectId, updates);
    const changes = Object.keys(updates).map(k => `${k}: ${updates[k]}`).join(', ');

    return {
      success: true,
      toolName: 'update_project',
      summary: `Updated project "${existing.name}" (${projectId}): ${changes}`,
      data: { projectId, name: project?.name, status: project?.status },
    };
  }

  private async rescheduleTask(input: Record<string, any>, _context: ActionContext): Promise<ActionResult> {
    const { taskId, startDate, endDate, dueDate, reason } = input;

    const existing = await this.scheduleService.findTaskById(taskId);
    if (!existing) {
      return { success: false, toolName: 'reschedule_task', summary: `Task '${taskId}' not found`, error: 'Task not found' };
    }

    const updateData: Record<string, any> = {};
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (dueDate) updateData.dueDate = new Date(dueDate);

    const task = await this.scheduleService.updateTask(taskId, updateData);

    const dateChanges: string[] = [];
    if (startDate) dateChanges.push(`start: ${startDate}`);
    if (endDate) dateChanges.push(`end: ${endDate}`);
    if (dueDate) dateChanges.push(`due: ${dueDate}`);

    return {
      success: true,
      toolName: 'reschedule_task',
      summary: `Rescheduled task "${existing.name}" (${taskId}): ${dateChanges.join(', ')}${reason ? `. Reason: ${reason}` : ''}`,
      data: { taskId, name: task?.name, startDate, endDate, dueDate },
    };
  }

  private async listProjects(_context: ActionContext): Promise<ActionResult> {
    const projects = await this.projectService.findAll();
    const projectList = projects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      projectType: p.projectType,
      budgetAllocated: p.budgetAllocated,
      budgetSpent: p.budgetSpent,
    }));

    return {
      success: true,
      toolName: 'list_projects',
      summary: `Found ${projects.length} projects`,
      data: projectList,
    };
  }

  private async getProjectDetails(input: Record<string, any>, _context: ActionContext): Promise<ActionResult> {
    const { projectId } = input;
    const project = await this.projectService.findById(projectId);
    if (!project) {
      return { success: false, toolName: 'get_project_details', summary: `Project '${projectId}' not found`, error: 'Project not found' };
    }

    const schedules = await this.scheduleService.findByProjectId(projectId);
    const schedulesWithTasks = await Promise.all(
      schedules.map(async (s) => {
        const tasks = await this.scheduleService.findTasksByScheduleId(s.id);
        return {
          id: s.id,
          name: s.name,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          tasks: tasks.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            assignedTo: t.assignedTo,
            dueDate: t.dueDate,
            progressPercentage: t.progressPercentage,
            parentTaskId: t.parentTaskId,
          })),
        };
      })
    );

    return {
      success: true,
      toolName: 'get_project_details',
      summary: `Project "${project.name}": ${project.status}, ${schedules.length} schedule(s)`,
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        projectType: project.projectType,
        budgetAllocated: project.budgetAllocated,
        budgetSpent: project.budgetSpent,
        startDate: project.startDate,
        endDate: project.endDate,
        location: project.location,
        schedules: schedulesWithTasks,
      },
    };
  }

  private async listTasks(input: Record<string, any>, _context: ActionContext): Promise<ActionResult> {
    const { scheduleId } = input;
    const schedule = await this.scheduleService.findById(scheduleId);
    if (!schedule) {
      return { success: false, toolName: 'list_tasks', summary: `Schedule '${scheduleId}' not found`, error: 'Schedule not found' };
    }

    const tasks = await this.scheduleService.findTasksByScheduleId(scheduleId);
    const taskList = tasks.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      priority: t.priority,
      assignedTo: t.assignedTo,
      dueDate: t.dueDate,
      progressPercentage: t.progressPercentage,
      parentTaskId: t.parentTaskId,
    }));

    return {
      success: true,
      toolName: 'list_tasks',
      summary: `Found ${tasks.length} tasks in schedule "${schedule.name}"`,
      data: taskList,
    };
  }
}
