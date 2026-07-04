import { goalRepository, Goal } from '../database/GoalRepository';

export type { Goal } from '../database/GoalRepository';

export interface CreateGoalData {
  name: string;
  description?: string;
  ownerId: string;
  parentId?: string;
  goalType: 'objective' | 'key_result';
  status?: 'on_track' | 'at_risk' | 'behind' | 'completed';
  progress?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: string;
  dueDate?: string;
  projectId?: string;
}

export class GoalService {
  async findById(id: string): Promise<Goal | null> {
    return goalRepository.findById(id);
  }

  async listByOwner(ownerId: string): Promise<Goal[]> {
    return goalRepository.findByOwner(ownerId);
  }

  async listByProject(projectId: string): Promise<Goal[]> {
    return goalRepository.findByProject(projectId);
  }

  async list(filters?: { ownerId?: string; projectId?: string; goalType?: string; status?: string }): Promise<Goal[]> {
    return goalRepository.findFiltered(filters);
  }

  async create(data: CreateGoalData): Promise<Goal> {
    return goalRepository.insert(data);
  }

  async update(id: string, data: Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Goal | null> {
    const existing = await goalRepository.findById(id);
    if (!existing) return null;
    return goalRepository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return goalRepository.deleteById(id);
  }

  async recalculateObjectiveProgress(objectiveId: string): Promise<Goal | null> {
    const objective = await goalRepository.findById(objectiveId);
    if (!objective || objective.goalType !== 'objective') return objective;

    const childProgress = await goalRepository.getChildProgress(objectiveId);
    if (childProgress.length === 0) return objective;

    const totalProgress = childProgress.reduce((sum, p) => sum + p, 0);
    const avgProgress = Math.round(totalProgress / childProgress.length);

    await goalRepository.updateProgress(objectiveId, avgProgress);
    return goalRepository.findById(objectiveId);
  }
}

export const goalService = new GoalService();
