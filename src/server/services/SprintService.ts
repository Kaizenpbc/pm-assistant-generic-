import { sprintRepository } from '../database/SprintRepository';
import { auditLedgerService } from './AuditLedgerService';
import { deadLetterService } from './DeadLetterService';

export interface Sprint {
  id: string;
  projectId: string;
  scheduleId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: string;
  velocityCommitment: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SprintTask {
  id: string;
  sprintId: string;
  taskId: string;
  storyPoints: number | null;
  addedAt: string;
}

interface BoardTask {
  id: string;
  name: string;
  status: string;
  storyPoints: number | null;
  [key: string]: any;
}

export class SprintService {
  async create(
    projectId: string,
    scheduleId: string,
    data: {
      name: string;
      goal?: string;
      startDate: string;
      endDate: string;
      velocityCommitment?: number;
    },
    userId: string,
  ): Promise<Sprint> {
    const sprint = await sprintRepository.create(projectId, scheduleId, data, userId);

    auditLedgerService.append({
      actorId: userId,
      actorType: 'user',
      action: 'sprint.create',
      entityType: 'sprint',
      entityId: sprint.id,
      projectId: projectId,
      payload: { after: sprint },
      source: 'web',
    }).catch(err => deadLetterService.capture('audit.append', {}, err));

    return sprint;
  }

  async getByProject(projectId: string): Promise<Sprint[]> {
    return sprintRepository.findByProject(projectId);
  }

  async getByProjectPaginated(projectId: string, limit: number, offset: number): Promise<{ rows: Sprint[]; total: number }> {
    return sprintRepository.findByProjectPaginated(projectId, limit, offset);
  }

  async getBySchedule(scheduleId: string): Promise<Sprint[]> {
    return sprintRepository.findBySchedule(scheduleId);
  }

  async getById(id: string): Promise<Sprint | null> {
    return sprintRepository.findById(id);
  }

  async update(
    id: string,
    data: {
      name?: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      velocityCommitment?: number;
    },
  ): Promise<Sprint> {
    return sprintRepository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return sprintRepository.deleteSprint(id);
  }

  async addTask(sprintId: string, taskId: string, storyPoints?: number): Promise<SprintTask> {
    const sprintTask = await sprintRepository.addTask(sprintId, taskId, storyPoints);

    const sprint = await this.getById(sprintId);
    auditLedgerService.append({
      actorId: sprint?.createdBy || 'system',
      actorType: 'user',
      action: 'task.add_to_sprint',
      entityType: 'sprint_task',
      entityId: sprintTask.id,
      projectId: sprint?.projectId ?? null,
      payload: { sprintId, taskId, storyPoints },
      source: 'web',
    }).catch(err => deadLetterService.capture('audit.append', {}, err));

    return sprintTask;
  }

  async removeTask(sprintId: string, taskId: string): Promise<void> {
    return sprintRepository.removeTask(sprintId, taskId);
  }

  async startSprint(id: string): Promise<Sprint> {
    const before = await this.getById(id);
    const sprint = await sprintRepository.updateStatus(id, 'active');

    auditLedgerService.append({
      actorId: sprint.createdBy,
      actorType: 'user',
      action: 'sprint.start',
      entityType: 'sprint',
      entityId: id,
      projectId: sprint.projectId,
      payload: { before, after: sprint },
      source: 'web',
    }).catch(err => deadLetterService.capture('audit.append', {}, err));

    return sprint;
  }

  async completeSprint(id: string): Promise<Sprint> {
    const before = await this.getById(id);
    const sprint = await sprintRepository.updateStatus(id, 'completed');

    auditLedgerService.append({
      actorId: sprint.createdBy,
      actorType: 'user',
      action: 'sprint.complete',
      entityType: 'sprint',
      entityId: id,
      projectId: sprint.projectId,
      payload: { before, after: sprint },
      source: 'web',
    }).catch(err => deadLetterService.capture('audit.append', {}, err));

    return sprint;
  }

  async getSprintBoard(id: string): Promise<{ scheduleId: string | null; tasks: BoardTask[] }> {
    return sprintRepository.getSprintBoard(id);
  }

  async getSprintBurndown(id: string): Promise<{
    dates: string[];
    ideal: number[];
    actual: number[];
    totalPoints: number;
  }> {
    const sprint = await this.getById(id);
    if (!sprint) {
      return { dates: [], ideal: [], actual: [], totalPoints: 0 };
    }

    const totalPoints = await sprintRepository.getTotalPoints(id);
    const completedRows = await sprintRepository.getCompletedTasksWithDates(id);

    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const DAY_MS = 86_400_000;
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS));

    const dates: string[] = [];
    const ideal: number[] = [];
    const actual: number[] = [];

    for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
      const currentDate = new Date(startDate.getTime() + dayIndex * DAY_MS);
      const dateStr = currentDate.toISOString().slice(0, 10);

      dates.push(dateStr);

      const idealRemaining = totalPoints * (1 - dayIndex / totalDays);
      ideal.push(Math.max(0, Math.round(idealRemaining * 10) / 10));

      if (currentDate <= today) {
        let completedPoints = 0;
        for (const row of completedRows) {
          const completedDate = new Date(row.updated_at);
          completedDate.setHours(0, 0, 0, 0);
          if (completedDate <= currentDate) {
            completedPoints += Number(row.story_points) || 0;
          }
        }
        actual.push(totalPoints - completedPoints);
      } else {
        actual.push(-1);
      }
    }

    return { dates, ideal, actual, totalPoints };
  }

  async getBacklogTasks(scheduleId: string): Promise<any[]> {
    return sprintRepository.getBacklogTasks(scheduleId);
  }

  async getVelocityHistory(projectId: string): Promise<{
    sprints: Array<{ name: string; velocity: number; commitment: number }>;
  }> {
    const sprints = await sprintRepository.getVelocityHistory(projectId);
    return { sprints };
  }
}

export const sprintService = new SprintService();
