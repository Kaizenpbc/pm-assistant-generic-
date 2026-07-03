import { projectRepository } from '../database/ProjectRepository';
import { auditLedgerService } from './AuditLedgerService';
import { policyEngineService } from './PolicyEngineService';
import { dagWorkflowService } from './DagWorkflowService';

export interface Project {
  id: string;
  name: string;
  description?: string;
  category?: string;
  projectType: 'it' | 'construction' | 'infrastructure' | 'roads' | 'other';
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  budgetAllocated?: number;
  budgetSpent: number;
  currency: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  startDate?: string;
  endDate?: string;
  projectManagerId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  category?: string;
  projectType?: 'it' | 'construction' | 'infrastructure' | 'roads' | 'other';
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  budgetAllocated?: number;
  currency?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  userId: string;
}

export class ProjectService {
  async findById(id: string, userId?: string): Promise<Project | null> {
    if (userId) {
      return projectRepository.findByIdForUser(id, userId);
    }
    return projectRepository.findById(id);
  }

  async findByUserId(userId: string): Promise<Project[]> {
    return projectRepository.findByUserId(userId);
  }

  async findByUserIdPaginated(userId: string, limit: number, offset: number): Promise<{ rows: Project[]; total: number }> {
    return projectRepository.findByUserIdPaginated(userId, limit, offset);
  }

  async findAll(): Promise<Project[]> {
    return projectRepository.findAll();
  }

  async create(data: CreateProjectData): Promise<Project> {
    // Policy check
    const policyResult = await policyEngineService.evaluate('project.create', {
      actorId: data.userId,
      entityType: 'project',
      data: { budget_impact: data.budgetAllocated ?? 0 },
    });
    if (!policyResult.allowed) {
      throw new Error(`Blocked by policy: ${policyResult.matchedPolicies.map(p => p.policyName).join(', ')}`);
    }

    const project = await projectRepository.create(data);

    auditLedgerService.append({
      actorId: data.userId,
      actorType: 'user',
      action: 'project.create',
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      payload: { after: project },
      source: 'web',
    }).catch(() => {});

    return project;
  }

  async update(id: string, data: Partial<Omit<Project, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>, userId?: string): Promise<Project | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    // Policy check
    if (userId) {
      const policyResult = await policyEngineService.evaluate('project.update', {
        actorId: userId,
        entityType: 'project',
        entityId: id,
        projectId: id,
        data: { budget_impact: data.budgetAllocated ?? existing.budgetAllocated ?? 0, status: data.status },
      });
      if (!policyResult.allowed) {
        throw new Error(`Blocked by policy: ${policyResult.matchedPolicies.map(p => p.policyName).join(', ')}`);
      }
    }

    const updated = await projectRepository.update(id, data as Record<string, any>);
    if (!updated) return existing; // no fields to update

    auditLedgerService.append({
      actorId: userId || existing.createdBy,
      actorType: 'user',
      action: 'project.update',
      entityType: 'project',
      entityId: id,
      projectId: id,
      payload: { before: existing, after: updated, changes: data },
      source: 'web',
    }).catch(() => {});

    // Fire project-level workflow triggers (non-blocking)
    if ('budgetSpent' in data && data.budgetSpent !== existing.budgetSpent) {
      const budgetAllocated = updated.budgetAllocated ?? 0;
      const utilization = budgetAllocated > 0 ? (updated.budgetSpent / budgetAllocated) * 100 : 0;
      dagWorkflowService.evaluateProjectChange(id, 'budget_update', {
        budgetAllocated, budgetSpent: updated.budgetSpent, utilization,
      }).catch(err => console.error('[Workflow] evaluateProjectChange error:', err));
    }
    if ('status' in data && data.status !== existing.status) {
      dagWorkflowService.evaluateProjectChange(id, 'project_status_change', {
        oldStatus: existing.status, newStatus: updated.status,
      }).catch(err => console.error('[Workflow] evaluateProjectChange error:', err));
    }

    return updated;
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    const existing = await this.findById(id, userId);

    // Policy check
    if (userId) {
      const policyResult = await policyEngineService.evaluate('project.delete', {
        actorId: userId,
        entityType: 'project',
        entityId: id,
        projectId: id,
      });
      if (!policyResult.allowed) {
        throw new Error(`Blocked by policy: ${policyResult.matchedPolicies.map(p => p.policyName).join(', ')}`);
      }
    }

    const deleted = userId
      ? await projectRepository.deleteForUser(id, userId)
      : await projectRepository.deleteById(id);

    if (deleted && existing) {
      auditLedgerService.append({
        actorId: userId || existing.createdBy,
        actorType: 'user',
        action: 'project.delete',
        entityType: 'project',
        entityId: id,
        projectId: id,
        payload: { before: existing },
        source: 'web',
      }).catch(() => {});
    }

    return deleted;
  }
}

export const projectService = new ProjectService();
