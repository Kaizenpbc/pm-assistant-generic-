import { ScheduleService } from './ScheduleService';
import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

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
  utilization: number; // percentage
}

export interface ResourceWorkload {
  resourceId: string;
  resourceName: string;
  role: string;
  weeks: WeeklyUtilization[];
  averageUtilization: number;
  isOverAllocated: boolean;
}

export class ResourceService {
  private static resources: Resource[] = [
    {
      id: 'res-1',
      name: 'Alice Chen',
      role: 'Project Manager',
      email: 'alice.chen@example.com',
      capacityHoursPerWeek: 40,
      skills: ['Planning', 'Scheduling', 'Risk Management'],
      isActive: true,
    },
    {
      id: 'res-2',
      name: 'Bob Martinez',
      role: 'Lead Engineer',
      email: 'bob.martinez@example.com',
      capacityHoursPerWeek: 40,
      skills: ['Structural Engineering', 'Design', 'Inspection'],
      isActive: true,
    },
    {
      id: 'res-3',
      name: 'Carol Davis',
      role: 'Site Supervisor',
      email: 'carol.davis@example.com',
      capacityHoursPerWeek: 45,
      skills: ['Construction', 'Safety', 'Equipment'],
      isActive: true,
    },
    {
      id: 'res-4',
      name: 'David Kim',
      role: 'Software Developer',
      email: 'david.kim@example.com',
      capacityHoursPerWeek: 40,
      skills: ['AWS', 'Docker', 'Node.js', 'React'],
      isActive: true,
    },
    {
      id: 'res-5',
      name: 'Emily Johnson',
      role: 'QA Engineer',
      email: 'emily.j@example.com',
      capacityHoursPerWeek: 40,
      skills: ['Testing', 'Automation', 'Performance Testing'],
      isActive: true,
    },
  ];

  private static assignments: ResourceAssignment[] = [
    {
      id: 'asgn-1',
      resourceId: 'res-1',
      taskId: 'task-2',
      scheduleId: 'sch-1',
      hoursPerWeek: 20,
      startDate: '2025-09-01',
      endDate: '2026-06-30',
    },
    {
      id: 'asgn-2',
      resourceId: 'res-2',
      taskId: 'task-2-2',
      scheduleId: 'sch-1',
      hoursPerWeek: 35,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    },
    {
      id: 'asgn-3',
      resourceId: 'res-3',
      taskId: 'task-2-1',
      scheduleId: 'sch-1',
      hoursPerWeek: 40,
      startDate: '2025-09-01',
      endDate: '2025-12-31',
    },
    {
      id: 'asgn-4',
      resourceId: 'res-3',
      taskId: 'task-3',
      scheduleId: 'sch-1',
      hoursPerWeek: 45,
      startDate: '2026-07-01',
      endDate: '2027-09-30',
    },
    {
      id: 'asgn-5',
      resourceId: 'res-4',
      taskId: 'task-c2',
      scheduleId: 'sch-2',
      hoursPerWeek: 40,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
    },
    {
      id: 'asgn-6',
      resourceId: 'res-4',
      taskId: 'task-c3',
      scheduleId: 'sch-2',
      hoursPerWeek: 35,
      startDate: '2026-06-01',
      endDate: '2026-09-30',
    },
    {
      id: 'asgn-7',
      resourceId: 'res-5',
      taskId: 'task-c4',
      scheduleId: 'sch-2',
      hoursPerWeek: 40,
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    },
    {
      id: 'asgn-8',
      resourceId: 'res-1',
      taskId: 'task-c1',
      scheduleId: 'sch-2',
      hoursPerWeek: 15,
      startDate: '2026-01-15',
      endDate: '2026-02-28',
    },
    {
      id: 'asgn-9',
      resourceId: 'res-2',
      taskId: 'task-h2',
      scheduleId: 'sch-3',
      hoursPerWeek: 20,
      startDate: '2026-09-01',
      endDate: '2027-02-28',
    },
  ];

  private get resources() { return ResourceService.resources; }
  private get assignments() { return ResourceService.assignments; }
  private get useDb() { return databaseService.isHealthy(); }

  // --- Row-to-model mappers ---

  private rowToResource(row: any): Resource {
    const camel = toCamelCaseKeys(row);
    return {
      ...camel,
      isActive: Boolean(camel.isActive),
    } as Resource;
  }

  private rowToAssignment(row: any): ResourceAssignment {
    const camel = toCamelCaseKeys(row);
    return {
      ...camel,
      startDate: row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : String(camel.startDate),
      endDate: row.end_date instanceof Date ? row.end_date.toISOString().split('T')[0] : String(camel.endDate),
    } as ResourceAssignment;
  }

  // --- Resource CRUD ---

  async findAllResources(): Promise<Resource[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM resources', []);
      return rows.map((r: any) => this.rowToResource(r));
    }
    return [...this.resources];
  }

  async findResourceById(id: string): Promise<Resource | null> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM resources WHERE id = ?', [id]);
      return rows.length > 0 ? this.rowToResource(rows[0]) : null;
    }
    return this.resources.find((r) => r.id === id) || null;
  }

  async createResource(data: Omit<Resource, 'id'>): Promise<Resource> {
    const id = `res-${Math.random().toString(36).substr(2, 9)}`;

    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO resources (id, name, role, email, capacity_hours_per_week, skills, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name, data.role, data.email, data.capacityHoursPerWeek, JSON.stringify(data.skills), data.isActive],
      );
      return { id, ...data };
    }

    const resource: Resource = { id, ...data };
    ResourceService.resources.push(resource);
    return resource;
  }

  async updateResource(id: string, data: Partial<Omit<Resource, 'id'>>): Promise<Resource | null> {
    if (this.useDb) {
      const setClauses: string[] = [];
      const values: any[] = [];
      const fieldMap: Record<string, string> = {
        name: 'name',
        role: 'role',
        email: 'email',
        capacityHoursPerWeek: 'capacity_hours_per_week',
        skills: 'skills',
        isActive: 'is_active',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          const val = key === 'skills' ? JSON.stringify((data as any)[key]) : (data as any)[key];
          setClauses.push(`${col} = ?`);
          values.push(val);
        }
      }
      if (setClauses.length === 0) return this.findResourceById(id);
      values.push(id);
      await databaseService.query(`UPDATE resources SET ${setClauses.join(', ')} WHERE id = ?`, values);
      return this.findResourceById(id);
    }

    const idx = this.resources.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    ResourceService.resources[idx] = { ...this.resources[idx], ...data };
    return ResourceService.resources[idx];
  }

  async deleteResource(id: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.transaction(async (connection) => {
        await connection.execute('DELETE FROM resource_assignments WHERE resource_id = ?', [id]);
        await connection.execute('DELETE FROM resources WHERE id = ?', [id]);
      });
      return true;
    }

    const idx = this.resources.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    ResourceService.resources.splice(idx, 1);
    ResourceService.assignments = ResourceService.assignments.filter((a) => a.resourceId !== id);
    return true;
  }

  // --- Assignment CRUD ---

  async findAssignmentsBySchedule(scheduleId: string): Promise<ResourceAssignment[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM resource_assignments WHERE schedule_id = ?', [scheduleId]);
      return rows.map((r: any) => this.rowToAssignment(r));
    }
    return this.assignments.filter((a) => a.scheduleId === scheduleId);
  }

  async findAssignmentsByResource(resourceId: string): Promise<ResourceAssignment[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM resource_assignments WHERE resource_id = ?', [resourceId]);
      return rows.map((r: any) => this.rowToAssignment(r));
    }
    return this.assignments.filter((a) => a.resourceId === resourceId);
  }

  async createAssignment(data: Omit<ResourceAssignment, 'id'>): Promise<ResourceAssignment> {
    const id = `asgn-${Math.random().toString(36).substr(2, 9)}`;

    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO resource_assignments (id, resource_id, task_id, schedule_id, hours_per_week, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, data.resourceId, data.taskId, data.scheduleId, data.hoursPerWeek, data.startDate, data.endDate],
      );
      return { id, ...data };
    }

    const assignment: ResourceAssignment = { id, ...data };
    ResourceService.assignments.push(assignment);
    return assignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.query('DELETE FROM resource_assignments WHERE id = ?', [id]);
      return true;
    }

    const idx = this.assignments.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    ResourceService.assignments.splice(idx, 1);
    return true;
  }

  // --- Workload computation ---

  async computeWorkload(projectId: string): Promise<ResourceWorkload[]> {
    const scheduleService = new ScheduleService();
    const schedules = await scheduleService.findByProjectId(projectId);
    const scheduleIds = new Set(schedules.map((s) => s.id));

    // Get all assignments for this project
    let projectAssignments: ResourceAssignment[];
    if (this.useDb) {
      if (scheduleIds.size === 0) {
        projectAssignments = [];
      } else {
        const placeholders = [...scheduleIds].map(() => '?').join(', ');
        const rows = await databaseService.query(
          `SELECT * FROM resource_assignments WHERE schedule_id IN (${placeholders})`,
          [...scheduleIds],
        );
        projectAssignments = rows.map((r: any) => this.rowToAssignment(r));
      }
    } else {
      projectAssignments = this.assignments.filter((a) => scheduleIds.has(a.scheduleId));
    }

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
      // Default range if no assignments
      const now = Date.now();
      minDate = now;
      maxDate = now + 12 * WEEK_MS;
    }

    // Snap to week start (Monday)
    const startWeek = new Date(minDate);
    startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));

    // Generate week starts
    const weeks: Date[] = [];
    for (let t = startWeek.getTime(); t <= maxDate; t += WEEK_MS) {
      weeks.push(new Date(t));
    }
    // Ensure at least 8 weeks
    while (weeks.length < 8) {
      const last = weeks[weeks.length - 1];
      weeks.push(new Date(last.getTime() + WEEK_MS));
    }

    // Get unique resources involved
    const involvedResourceIds = [...new Set(projectAssignments.map((a) => a.resourceId))];

    const workloads: ResourceWorkload[] = [];

    for (const resId of involvedResourceIds) {
      let resource: Resource | null;
      if (this.useDb) {
        resource = await this.findResourceById(resId);
      } else {
        resource = this.resources.find((r) => r.id === resId) || null;
      }
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
          // Check if assignment overlaps this week
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
