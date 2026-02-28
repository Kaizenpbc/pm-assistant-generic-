import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { auditLedgerService } from './AuditLedgerService';
import { policyEngineService } from './PolicyEngineService';

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

function toDateStr(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    projectType: row.project_type,
    status: row.status,
    priority: row.priority,
    budgetAllocated: row.budget_allocated != null ? Number(row.budget_allocated) : undefined,
    budgetSpent: Number(row.budget_spent),
    currency: row.currency,
    location: row.location ?? undefined,
    locationLat: row.location_lat != null ? Number(row.location_lat) : undefined,
    locationLon: row.location_lon != null ? Number(row.location_lon) : undefined,
    startDate: row.start_date ? String(row.start_date) : undefined,
    endDate: row.end_date ? String(row.end_date) : undefined,
    projectManagerId: row.project_manager_id ?? undefined,
    createdBy: row.created_by,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class ProjectService {
  async findById(id: string, userId?: string): Promise<Project | null> {
    const sql = userId
      ? 'SELECT * FROM projects WHERE id = ? AND created_by = ?'
      : 'SELECT * FROM projects WHERE id = ?';
    const params = userId ? [id, userId] : [id];
    const rows = await databaseService.query(sql, params);
    return rows.length > 0 ? rowToProject(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    const rows = await databaseService.query(
      'SELECT * FROM projects WHERE created_by = ? ORDER BY created_at DESC',
      [userId],
    );
    return rows.map(rowToProject);
  }

  async findAll(): Promise<Project[]> {
    const rows = await databaseService.query('SELECT * FROM projects ORDER BY created_at DESC');
    return rows.map(rowToProject);
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

    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO projects (id, name, description, category, project_type, status, priority,
        budget_allocated, budget_spent, currency, location, location_lat, location_lon,
        start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.category || null,
        data.projectType || 'other',
        data.status || 'planning',
        data.priority || 'medium',
        data.budgetAllocated ?? null,
        0,
        data.currency || 'USD',
        data.location || null,
        data.locationLat ?? null,
        data.locationLon ?? null,
        toDateStr(data.startDate) || null,
        toDateStr(data.endDate) || null,
        data.userId,
      ],
    );
    const project = (await this.findById(id))!;

    auditLedgerService.append({
      actorId: data.userId,
      actorType: 'user',
      action: 'project.create',
      entityType: 'project',
      entityId: id,
      projectId: id,
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

    const columnMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      category: 'category',
      projectType: 'project_type',
      status: 'status',
      priority: 'priority',
      budgetAllocated: 'budget_allocated',
      budgetSpent: 'budget_spent',
      currency: 'currency',
      location: 'location',
      locationLat: 'location_lat',
      locationLon: 'location_lon',
      startDate: 'start_date',
      endDate: 'end_date',
      projectManagerId: 'project_manager_id',
    };

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(columnMap)) {
      if (key in data) {
        fields.push(`${column} = ?`);
        let val = (data as any)[key];
        if ((key === 'startDate' || key === 'endDate') && val) {
          val = toDateStr(val);
        }
        values.push(val ?? null);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    await databaseService.query(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
    const updated = (await this.findById(id))!;

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

    const sql = userId
      ? 'DELETE FROM projects WHERE id = ? AND created_by = ?'
      : 'DELETE FROM projects WHERE id = ?';
    const params = userId ? [id, userId] : [id];
    const result: any = await databaseService.query(sql, params);
    const deleted = (result.affectedRows ?? 0) > 0;

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
