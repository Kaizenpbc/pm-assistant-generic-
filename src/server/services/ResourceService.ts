import { ScheduleService } from './ScheduleService';

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

  // --- Resource CRUD ---

  async findAllResources(): Promise<Resource[]> {
    return [...this.resources];
  }

  async findResourceById(id: string): Promise<Resource | null> {
    return this.resources.find((r) => r.id === id) || null;
  }

  async createResource(data: Omit<Resource, 'id'>): Promise<Resource> {
    const resource: Resource = {
      id: `res-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
    };
    ResourceService.resources.push(resource);
    return resource;
  }

  async updateResource(id: string, data: Partial<Omit<Resource, 'id'>>): Promise<Resource | null> {
    const idx = this.resources.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    ResourceService.resources[idx] = { ...this.resources[idx], ...data };
    return ResourceService.resources[idx];
  }

  async deleteResource(id: string): Promise<boolean> {
    const idx = this.resources.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    ResourceService.resources.splice(idx, 1);
    ResourceService.assignments = ResourceService.assignments.filter((a) => a.resourceId !== id);
    return true;
  }

  // --- Assignment CRUD ---

  async findAssignmentsBySchedule(scheduleId: string): Promise<ResourceAssignment[]> {
    return this.assignments.filter((a) => a.scheduleId === scheduleId);
  }

  async findAssignmentsByResource(resourceId: string): Promise<ResourceAssignment[]> {
    return this.assignments.filter((a) => a.resourceId === resourceId);
  }

  async createAssignment(data: Omit<ResourceAssignment, 'id'>): Promise<ResourceAssignment> {
    const assignment: ResourceAssignment = {
      id: `asgn-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
    };
    ResourceService.assignments.push(assignment);
    return assignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
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
    const projectAssignments = this.assignments.filter((a) => scheduleIds.has(a.scheduleId));

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
      const resource = this.resources.find((r) => r.id === resId);
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
