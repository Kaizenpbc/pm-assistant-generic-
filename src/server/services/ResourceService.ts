import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { ScheduleService } from './ScheduleService';
import { auditLedgerService } from './AuditLedgerService';

export interface Resource {
  id: string;
  name: string;
  role: string;
  email: string;
  capacityHoursPerWeek: number;
  skills: string[];
  isActive: boolean;
}

export interface ResourceAssignment {
  id: string;
  resourceId: string;
  taskId: string;
  scheduleId: string;
  hoursPerWeek: number;
  startDate: string;
  endDate: string;
}

export interface WeeklyUtilization {
  weekStart: string;
  allocated: number;
  capacity: number;
  utilization: number;
}

export interface ResourceWorkload {
  resourceId: string;
  resourceName: string;
  role: string;
  weeks: WeeklyUtilization[];
  averageUtilization: number;
  isOverAllocated: boolean;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToResource(row: any): Resource {
  let skills: string[] = [];
  if (row.skills) {
    try {
      skills = typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
    } catch { skills = []; }
  }
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    capacityHoursPerWeek: Number(row.capacity_hours_per_week),
    skills,
    isActive: Boolean(row.is_active),
  };
}

function rowToAssignment(row: any): ResourceAssignment {
  return {
    id: row.id,
    resourceId: row.resource_id,
    taskId: row.task_id,
    scheduleId: row.schedule_id,
    hoursPerWeek: Number(row.hours_per_week),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ResourceService {
  // --- Resource CRUD ---

  async findAllResources(): Promise<Resource[]> {
    const rows = await databaseService.query('SELECT * FROM resources ORDER BY name');
    return rows.map(rowToResource);
  }

  async findResourceById(id: string): Promise<Resource | null> {
    const rows = await databaseService.query('SELECT * FROM resources WHERE id = ?', [id]);
    return rows.length > 0 ? rowToResource(rows[0]) : null;
  }

  async createResource(data: Omit<Resource, 'id'>): Promise<Resource> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO resources (id, name, role, email, capacity_hours_per_week, skills, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.role,
        data.email,
        data.capacityHoursPerWeek,
        JSON.stringify(data.skills || []),
        data.isActive ? 1 : 0,
      ],
    );
    return (await this.findResourceById(id))!;
  }

  async updateResource(id: string, data: Partial<Omit<Resource, 'id'>>): Promise<Resource | null> {
    const existing = await this.findResourceById(id);
    if (!existing) return null;

    const columnMap: Record<string, string> = {
      name: 'name',
      role: 'role',
      email: 'email',
      capacityHoursPerWeek: 'capacity_hours_per_week',
      skills: 'skills',
      isActive: 'is_active',
    };

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(columnMap)) {
      if (key in data) {
        let val = (data as any)[key];
        if (key === 'skills') val = JSON.stringify(val || []);
        if (key === 'isActive') val = val ? 1 : 0;
        fields.push(`${column} = ?`);
        values.push(val);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    await databaseService.query(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = (await this.findResourceById(id))!;

    auditLedgerService.append({
      actorId: 'system',
      actorType: 'system',
      action: 'resource.update',
      entityType: 'resource',
      entityId: id,
      payload: { before: existing, after: updated, changes: data },
      source: 'web',
    }).catch(() => {});

    return updated;
  }

  async deleteResource(id: string): Promise<boolean> {
    // resource_assignments has ON DELETE CASCADE
    const result: any = await databaseService.query('DELETE FROM resources WHERE id = ?', [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  // --- Assignment CRUD ---

  async findAssignmentsBySchedule(scheduleId: string): Promise<ResourceAssignment[]> {
    const rows = await databaseService.query(
      'SELECT * FROM resource_assignments WHERE schedule_id = ?',
      [scheduleId],
    );
    return rows.map(rowToAssignment);
  }

  async findAssignmentsByResource(resourceId: string): Promise<ResourceAssignment[]> {
    const rows = await databaseService.query(
      'SELECT * FROM resource_assignments WHERE resource_id = ?',
      [resourceId],
    );
    return rows.map(rowToAssignment);
  }

  async createAssignment(data: Omit<ResourceAssignment, 'id'>): Promise<ResourceAssignment> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO resource_assignments (id, resource_id, task_id, schedule_id, hours_per_week, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.resourceId, data.taskId, data.scheduleId, data.hoursPerWeek, data.startDate, data.endDate],
    );
    const rows = await databaseService.query('SELECT * FROM resource_assignments WHERE id = ?', [id]);
    const assignment = rowToAssignment(rows[0]);

    auditLedgerService.append({
      actorId: 'system',
      actorType: 'system',
      action: 'resource.assign',
      entityType: 'resource_assignment',
      entityId: id,
      payload: { after: assignment },
      source: 'web',
    }).catch(() => {});

    return assignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const result: any = await databaseService.query('DELETE FROM resource_assignments WHERE id = ?', [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  // --- Workload computation ---

  async computeWorkload(projectId: string): Promise<ResourceWorkload[]> {
    const scheduleService = new ScheduleService();
    const schedules = await scheduleService.findByProjectId(projectId);
    const scheduleIds = schedules.map((s) => s.id);

    if (scheduleIds.length === 0) return [];

    // Get all assignments for this project's schedules
    const placeholders = scheduleIds.map(() => '?').join(',');
    const assignmentRows = await databaseService.query(
      `SELECT * FROM resource_assignments WHERE schedule_id IN (${placeholders})`,
      scheduleIds,
    );
    const projectAssignments = assignmentRows.map(rowToAssignment);

    // Determine date range
    const DAY_MS = 86_400_000;
    const WEEK_MS = 7 * DAY_MS;
    let minDate = Infinity;
    let maxDate = -Infinity;

    for (const a of projectAssignments) {
      minDate = Math.min(minDate, new Date(a.startDate).getTime());
      maxDate = Math.max(maxDate, new Date(a.endDate).getTime());
    }

    if (minDate === Infinity) {
      const now = Date.now();
      minDate = now;
      maxDate = now + 12 * WEEK_MS;
    }

    // Snap to week start (Monday)
    const startWeek = new Date(minDate);
    startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));

    const weeks: Date[] = [];
    for (let t = startWeek.getTime(); t <= maxDate; t += WEEK_MS) {
      weeks.push(new Date(t));
    }
    while (weeks.length < 8) {
      const last = weeks[weeks.length - 1];
      weeks.push(new Date(last.getTime() + WEEK_MS));
    }

    // Get unique resources involved
    const involvedResourceIds = [...new Set(projectAssignments.map((a) => a.resourceId))];

    const workloads: ResourceWorkload[] = [];

    for (const resId of involvedResourceIds) {
      const resource = await this.findResourceById(resId);
      if (!resource) continue;

      const resAssignments = projectAssignments.filter((a) => a.resourceId === resId);
      const capacity = resource.capacityHoursPerWeek;
      let totalUtilization = 0;
      let isOverAllocated = false;

      const weeklyData: WeeklyUtilization[] = weeks.map((weekStart) => {
        const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
        let allocated = 0;

        for (const a of resAssignments) {
          const aStart = new Date(a.startDate).getTime();
          const aEnd = new Date(a.endDate).getTime();
          if (aStart < weekEnd.getTime() && aEnd >= weekStart.getTime()) {
            allocated += a.hoursPerWeek;
          }
        }

        const utilization = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;
        if (utilization > 100) isOverAllocated = true;
        totalUtilization += utilization;

        return {
          weekStart: weekStart.toISOString().slice(0, 10),
          allocated,
          capacity,
          utilization,
        };
      });

      workloads.push({
        resourceId: resId,
        resourceName: resource.name,
        role: resource.role,
        weeks: weeklyData,
        averageUtilization: weeks.length > 0 ? Math.round(totalUtilization / weeks.length) : 0,
        isOverAllocated,
      });
    }

    return workloads;
  }
}
