// C:\Users\gerog\Documents\pm-assistant-generic\src\server\services\aiActionExecutor.ts

import { ProjectService, type CreateProjectData } from './ProjectService';
import { ScheduleService, type CreateTaskData } from './ScheduleService';
import { UserService } from './UserService';
import { auditLedgerService } from './AuditLedgerService';
import { policyEngineService } from './PolicyEngineService';

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
      // Policy gate for all AI actions
      const policyResult = await policyEngineService.evaluate(`ai.action.${toolName}`, {
        actorId: context.userId,
        actorRole: context.userRole,
        entityType: input.taskId ? 'task' : input.projectId ? 'project' : undefined,
        entityId: input.taskId || input.projectId || input.scheduleId,
        projectId: input.projectId,
        data: { ...input, tool: toolName },
      });

      if (!policyResult.allowed) {
        const blocked: ActionResult = {
          success: false,
          toolName,
          summary: `Blocked by policy: ${policyResult.matchedPolicies.map(p => p.policyName).join(', ')}`,
          error: 'Action blocked by policy',
        };
        auditLedgerService.append({
          actorId: context.userId,
          actorType: 'user',
          action: `ai.action.${toolName}`,
          entityType: input.taskId ? 'task' : input.projectId ? 'project' : 'unknown',
          entityId: input.taskId || input.projectId || input.scheduleId || 'unknown',
          payload: { input, result: blocked, policyBlock: policyResult.matchedPolicies },
          source: 'api',
        }).catch(() => {});
        return blocked;
      }

      let result: ActionResult;
      switch (toolName) {
        case 'create_task': result = await this.createTask(input, context); break;
        case 'update_task': result = await this.updateTask(input, context); break;
        case 'delete_task': result = await this.deleteTask(input, context); break;
        case 'create_project': result = await this.createProject(input, context); break;
        case 'update_project': result = await this.updateProject(input, context); break;
        case 'reschedule_task': result = await this.rescheduleTask(input, context); break;
        case 'list_projects': result = await this.listProjects(context); break;
        case 'get_project_details': result = await this.getProjectDetails(input, context); break;
        case 'list_tasks': result = await this.listTasks(input, context); break;
        case 'cascade_reschedule': result = await this.cascadeReschedule(input, context); break;
        case 'set_dependency': result = await this.setDependency(input, context); break;
        case 'get_dependency_chain': result = await this.getDependencyChain(input, context); break;
        default:
          return { success: false, toolName, summary: `Unknown tool: ${toolName}`, error: `Tool '${toolName}' is not recognized` };
      }

      // Audit log every AI action
      auditLedgerService.append({
        actorId: context.userId,
        actorType: 'user',
        action: `ai.action.${toolName}`,
        entityType: input.taskId ? 'task' : input.projectId ? 'project' : input.scheduleId ? 'schedule' : 'unknown',
        entityId: input.taskId || input.projectId || input.scheduleId || result.data?.taskId || result.data?.projectId || 'unknown',
        projectId: input.projectId || result.data?.projectId || null,
        payload: { input, result: { success: result.success, summary: result.summary, data: result.data } },
        source: 'api',
      }).catch(() => {});

      return result;
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
      startDate: t.startDate,
      endDate: t.endDate,
      progressPercentage: t.progressPercentage,
      parentTaskId: t.parentTaskId,
      dependency: t.dependency,
      dependencyType: t.dependencyType,
    }));

    return {
      success: true,
      toolName: 'list_tasks',
      summary: `Found ${tasks.length} tasks in schedule "${schedule.name}"`,
      data: taskList,
    };
  }

  private async cascadeReschedule(input: Record<string, any>, _context: ActionContext): Promise<ActionResult> {
    const { taskId, newStartDate, newEndDate, reason } = input;

    const target = await this.scheduleService.findTaskById(taskId);
    if (!target) {
      return { success: false, toolName: 'cascade_reschedule', summary: `Task '${taskId}' not found`, error: 'Task not found' };
    }

    // Calculate the delta in milliseconds
    let deltaMs = 0;
    if (newStartDate && target.startDate) {
      deltaMs = new Date(newStartDate).getTime() - new Date(target.startDate).getTime();
    } else if (newEndDate && target.endDate) {
      deltaMs = new Date(newEndDate).getTime() - new Date(target.endDate).getTime();
    }

    if (deltaMs === 0 && !newStartDate && !newEndDate) {
      return { success: false, toolName: 'cascade_reschedule', summary: 'No date change specified', error: 'Provide newStartDate or newEndDate' };
    }

    // Update the target task
    const targetUpdate: Record<string, any> = {};
    if (newStartDate) targetUpdate.startDate = new Date(newStartDate);
    if (newEndDate) targetUpdate.endDate = new Date(newEndDate);
    // If only start changed, shift end by same delta
    if (newStartDate && !newEndDate && target.endDate) {
      targetUpdate.endDate = new Date(new Date(target.endDate).getTime() + deltaMs);
    }
    // If only end changed, shift start by same delta
    if (newEndDate && !newStartDate && target.startDate) {
      targetUpdate.startDate = new Date(new Date(target.startDate).getTime() + deltaMs);
    }
    await this.scheduleService.updateTask(taskId, targetUpdate);

    // Find and shift all downstream dependents
    const downstream = await this.scheduleService.findAllDownstreamTasks(taskId);
    const affected: Array<{ id: string; name: string; newStart?: string; newEnd?: string }> = [];

    for (const dep of downstream) {
      const depUpdate: Record<string, any> = {};
      if (dep.startDate) {
        depUpdate.startDate = new Date(new Date(dep.startDate).getTime() + deltaMs);
      }
      if (dep.endDate) {
        depUpdate.endDate = new Date(new Date(dep.endDate).getTime() + deltaMs);
      }
      if (dep.dueDate) {
        depUpdate.dueDate = new Date(new Date(dep.dueDate).getTime() + deltaMs);
      }
      await this.scheduleService.updateTask(dep.id, depUpdate);
      affected.push({
        id: dep.id,
        name: dep.name,
        newStart: depUpdate.startDate?.toISOString().split('T')[0],
        newEnd: depUpdate.endDate?.toISOString().split('T')[0],
      });
    }

    const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));
    const direction = deltaDays > 0 ? 'forward' : 'back';

    return {
      success: true,
      toolName: 'cascade_reschedule',
      summary: `Rescheduled "${target.name}" and ${affected.length} downstream task${affected.length === 1 ? '' : 's'} by ${Math.abs(deltaDays)} day${Math.abs(deltaDays) === 1 ? '' : 's'} ${direction}${reason ? `. Reason: ${reason}` : ''}`,
      data: {
        target: { id: taskId, name: target.name, ...targetUpdate },
        affectedTasks: affected,
        deltaDays,
      },
    };
  }

  private async setDependency(input: Record<string, any>, _context: ActionContext): Promise<ActionResult> {
    const { taskId, predecessorId, dependencyType } = input;

    const task = await this.scheduleService.findTaskById(taskId);
    if (!task) {
      return { success: false, toolName: 'set_dependency', summary: `Task '${taskId}' not found`, error: 'Task not found' };
    }

    const predecessor = await this.scheduleService.findTaskById(predecessorId);
    if (!predecessor) {
      return { success: false, toolName: 'set_dependency', summary: `Predecessor task '${predecessorId}' not found`, error: 'Predecessor not found' };
    }

    // Check for circular dependency
    const downstreamOfTask = await this.scheduleService.findAllDownstreamTasks(taskId);
    if (downstreamOfTask.some(d => d.id === predecessorId)) {
      return {
        success: false,
        toolName: 'set_dependency',
        summary: `Cannot set dependency: "${predecessor.name}" is already downstream of "${task.name}" — this would create a circular dependency`,
        error: 'Circular dependency detected',
      };
    }

    const depType = dependencyType || 'FS';
    await this.scheduleService.updateTask(taskId, {
      dependency: predecessorId,
      dependencyType: depType,
    });

    return {
      success: true,
      toolName: 'set_dependency',
      summary: `Set dependency: "${task.name}" now depends on "${predecessor.name}" (${depType})`,
      data: { taskId, taskName: task.name, predecessorId, predecessorName: predecessor.name, dependencyType: depType },
    };
  }

  private async getDependencyChain(input: Record<string, any>, _context: ActionContext): Promise<ActionResult> {
    const { taskId } = input;

    const task = await this.scheduleService.findTaskById(taskId);
    if (!task) {
      return { success: false, toolName: 'get_dependency_chain', summary: `Task '${taskId}' not found`, error: 'Task not found' };
    }

    // Walk upstream (predecessors)
    const upstream: Array<{ id: string; name: string; type: string }> = [];
    let current = task;
    const visitedUp = new Set<string>();
    while (current.dependency && !visitedUp.has(current.dependency)) {
      visitedUp.add(current.dependency);
      const pred = await this.scheduleService.findTaskById(current.dependency);
      if (!pred) break;
      upstream.push({ id: pred.id, name: pred.name, type: current.dependencyType || 'FS' });
      current = pred;
    }
    upstream.reverse(); // oldest predecessor first

    // Walk downstream (dependents)
    const downstream = await this.scheduleService.findAllDownstreamTasks(taskId);
    const downstreamList = downstream.map(d => ({
      id: d.id,
      name: d.name,
      startDate: d.startDate,
      endDate: d.endDate,
    }));

    return {
      success: true,
      toolName: 'get_dependency_chain',
      summary: `"${task.name}" has ${upstream.length} predecessor(s) and ${downstream.length} downstream dependent(s)`,
      data: {
        task: { id: task.id, name: task.name, startDate: task.startDate, endDate: task.endDate },
        upstream,
        downstream: downstreamList,
      },
    };
  }
}
