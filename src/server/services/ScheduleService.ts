import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  scheduleId: string;
  name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: Date;
  estimatedDays?: number;
  estimatedDurationHours?: number;
  actualDurationHours?: number;
  startDate?: Date;
  endDate?: Date;
  progressPercentage?: number;
  dependency?: string;
  dependencyType?: 'FS' | 'SS' | 'FF' | 'SF';
  risks?: string;
  issues?: string;
  comments?: string;
  parentTaskId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleData {
  projectId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  createdBy: string;
}

export interface CreateTaskData {
  scheduleId: string;
  name: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: Date;
  estimatedDays?: number;
  estimatedDurationHours?: number;
  actualDurationHours?: number;
  startDate?: Date;
  endDate?: Date;
  progressPercentage?: number;
  dependency?: string;
  risks?: string;
  issues?: string;
  comments?: string;
  parentTaskId?: string;
  createdBy: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface CascadeChange {
  taskId: string;
  taskName: string;
  oldStartDate: string;
  newStartDate: string;
  oldEndDate: string;
  newEndDate: string;
  deltaDays: number;
}

export interface CascadeResult {
  triggeredByTaskId: string;
  deltaDays: number;
  affectedTasks: CascadeChange[];
}

export interface TaskActivityEntry {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export class ScheduleService {
  private static schedules: Schedule[] = [
    {
      id: 'sch-1',
      projectId: '3',
      name: 'Construction Master Schedule',
      description: 'Primary construction timeline for Downtown Office Complex',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2027-12-31'),
      status: 'active',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'sch-2',
      projectId: '1',
      name: 'Cloud Migration Plan',
      description: 'Phased migration of on-premise systems to AWS',
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-31'),
      status: 'active',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'sch-3',
      projectId: '2',
      name: 'Highway Expansion Schedule',
      description: 'Construction timeline for Highway 101 widening project',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2028-06-30'),
      status: 'pending',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private static tasks: Task[] = [
    {
      id: 'task-1',
      scheduleId: 'sch-1',
      name: 'Phase 1: Planning & Design',
      description: 'Initial planning and architectural design phase',
      status: 'completed',
      priority: 'high',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-08-30'),
      progressPercentage: 100,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-1-1',
      scheduleId: 'sch-1',
      parentTaskId: 'task-1',
      name: 'Site Survey & Geotechnical Analysis',
      description: 'Topographical survey and soil testing',
      status: 'completed',
      priority: 'high',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-30'),
      progressPercentage: 100,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-1-2',
      scheduleId: 'sch-1',
      parentTaskId: 'task-1',
      name: 'Architectural Drawings & Permits',
      description: 'Detailed architectural plans and building permit applications',
      status: 'completed',
      priority: 'high',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-08-30'),
      progressPercentage: 100,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-2',
      scheduleId: 'sch-1',
      name: 'Phase 2: Foundation & Structure',
      description: 'Foundation work and structural framework',
      status: 'in_progress',
      priority: 'urgent',
      dependency: 'task-1',
      dependencyType: 'FS',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-06-30'),
      progressPercentage: 35,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-2-1',
      scheduleId: 'sch-1',
      parentTaskId: 'task-2',
      name: 'Excavation & Foundation',
      description: 'Deep excavation and foundation laying',
      status: 'completed',
      priority: 'urgent',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-31'),
      progressPercentage: 100,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-2-2',
      scheduleId: 'sch-1',
      parentTaskId: 'task-2',
      name: 'Steel Framework (Floors 1-6)',
      description: 'Erecting steel columns and beams for lower floors',
      status: 'in_progress',
      priority: 'high',
      dependency: 'task-2-1',
      dependencyType: 'FS',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
      progressPercentage: 40,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-3',
      scheduleId: 'sch-1',
      name: 'Phase 3: Exterior & Interior',
      description: 'Building envelope and interior finishing',
      status: 'pending',
      priority: 'high',
      dependency: 'task-2',
      dependencyType: 'FS',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2027-09-30'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-4',
      scheduleId: 'sch-1',
      name: 'Phase 4: Final Inspection & Handover',
      description: 'Quality inspection and project completion',
      status: 'pending',
      priority: 'high',
      dependency: 'task-3',
      dependencyType: 'FS',
      startDate: new Date('2027-10-01'),
      endDate: new Date('2027-12-31'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // --- Cloud Migration tasks (sch-2) ---
    {
      id: 'task-c1',
      scheduleId: 'sch-2',
      name: 'Assessment & Planning',
      description: 'Audit existing infrastructure and design cloud architecture',
      status: 'completed',
      priority: 'high',
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-02-28'),
      progressPercentage: 100,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-c1-1',
      scheduleId: 'sch-2',
      parentTaskId: 'task-c1',
      name: 'Infrastructure Audit',
      description: 'Inventory all servers, databases, and services',
      status: 'completed',
      priority: 'high',
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-02-07'),
      progressPercentage: 100,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-c1-2',
      scheduleId: 'sch-2',
      parentTaskId: 'task-c1',
      name: 'AWS Architecture Design',
      description: 'Design target cloud architecture with VPC, subnets, and security groups',
      status: 'completed',
      priority: 'high',
      dependency: 'task-c1-1',
      dependencyType: 'FS',
      startDate: new Date('2026-02-08'),
      endDate: new Date('2026-02-28'),
      progressPercentage: 100,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-c2',
      scheduleId: 'sch-2',
      name: 'Database Migration',
      description: 'Migrate databases to RDS/Aurora',
      status: 'in_progress',
      priority: 'urgent',
      dependency: 'task-c1',
      dependencyType: 'FS',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-05-31'),
      progressPercentage: 30,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-c3',
      scheduleId: 'sch-2',
      name: 'Application Migration',
      description: 'Containerize and deploy applications to ECS/EKS',
      status: 'pending',
      priority: 'high',
      dependency: 'task-c2',
      dependencyType: 'FS',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-09-30'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-c4',
      scheduleId: 'sch-2',
      name: 'Testing & Cutover',
      description: 'Integration testing, performance testing, and final cutover',
      status: 'pending',
      priority: 'high',
      dependency: 'task-c3',
      dependencyType: 'FS',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-12-31'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // --- Highway Expansion tasks (sch-3) ---
    {
      id: 'task-h1',
      scheduleId: 'sch-3',
      name: 'Environmental & Permits',
      description: 'Environmental impact assessment and permit acquisition',
      status: 'in_progress',
      priority: 'high',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-08-31'),
      progressPercentage: 45,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-h1-1',
      scheduleId: 'sch-3',
      parentTaskId: 'task-h1',
      name: 'Environmental Impact Study',
      description: 'Complete EIS per federal requirements',
      status: 'in_progress',
      priority: 'high',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-06-30'),
      progressPercentage: 60,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-h1-2',
      scheduleId: 'sch-3',
      parentTaskId: 'task-h1',
      name: 'Right-of-Way Acquisition',
      description: 'Acquire additional land parcels for highway widening',
      status: 'pending',
      priority: 'high',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-h2',
      scheduleId: 'sch-3',
      name: 'Utility Relocation',
      description: 'Relocate underground utilities and overhead lines',
      status: 'pending',
      priority: 'medium',
      dependency: 'task-h1',
      dependencyType: 'FS',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-02-28'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-h3',
      scheduleId: 'sch-3',
      name: 'Earthwork & Grading',
      description: 'Major earthmoving and road grading operations',
      status: 'pending',
      priority: 'high',
      dependency: 'task-h2',
      dependencyType: 'FS',
      startDate: new Date('2027-03-01'),
      endDate: new Date('2027-10-31'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'task-h4',
      scheduleId: 'sch-3',
      name: 'Paving & Finishing',
      description: 'Road paving, lane markings, signage, and barriers',
      status: 'pending',
      priority: 'high',
      dependency: 'task-h3',
      dependencyType: 'FS',
      startDate: new Date('2027-11-01'),
      endDate: new Date('2028-06-30'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private static comments: TaskComment[] = [];
  private static activities: TaskActivityEntry[] = [];

  private get schedules() { return ScheduleService.schedules; }
  private get tasks() { return ScheduleService.tasks; }
  private get useDb() { return databaseService.isHealthy(); }

  private rowToSchedule(row: any): Schedule {
    const c = toCamelCaseKeys(row);
    return { ...c, startDate: new Date(c.startDate), endDate: new Date(c.endDate), createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) } as Schedule;
  }

  private rowToTask(row: any): Task {
    const c = toCamelCaseKeys(row);
    return {
      ...c,
      estimatedDays: c.estimatedDays != null ? Number(c.estimatedDays) : undefined,
      estimatedDurationHours: c.estimatedDurationHours != null ? Number(c.estimatedDurationHours) : undefined,
      actualDurationHours: c.actualDurationHours != null ? Number(c.actualDurationHours) : undefined,
      progressPercentage: c.progressPercentage != null ? Number(c.progressPercentage) : undefined,
      startDate: c.startDate ? new Date(c.startDate) : undefined,
      endDate: c.endDate ? new Date(c.endDate) : undefined,
      dueDate: c.dueDate ? new Date(c.dueDate) : undefined,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    } as Task;
  }

  async findByProjectId(projectId: string): Promise<Schedule[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM schedules WHERE project_id = ?', [projectId]);
      return rows.map((r: any) => this.rowToSchedule(r));
    }
    return this.schedules.filter(s => s.projectId === projectId);
  }

  async findById(id: string): Promise<Schedule | null> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM schedules WHERE id = ?', [id]);
      return rows.length > 0 ? this.rowToSchedule(rows[0]) : null;
    }
    return this.schedules.find(s => s.id === id) || null;
  }

  async create(data: CreateScheduleData): Promise<Schedule> {
    const id = `sch-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO schedules (id, project_id, name, description, start_date, end_date, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.projectId, data.name, data.description ?? null, data.startDate, data.endDate, 'active', data.createdBy, now, now],
      );
      return {
        id,
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'active',
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      };
    }

    const schedule: Schedule = {
      id,
      ...data,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    ScheduleService.schedules.push(schedule);
    return schedule;
  }

  async update(id: string, data: Partial<Omit<Schedule, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>): Promise<Schedule | null> {
    if (this.useDb) {
      const setClauses: string[] = [];
      const values: any[] = [];
      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        startDate: 'start_date',
        endDate: 'end_date',
        status: 'status',
        createdBy: 'created_by',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          setClauses.push(`${col} = ?`);
          values.push((data as any)[key]);
        }
      }
      if (setClauses.length === 0) return this.findById(id);
      setClauses.push('updated_at = ?');
      values.push(new Date());
      values.push(id);
      await databaseService.query(`UPDATE schedules SET ${setClauses.join(', ')} WHERE id = ?`, values);
      return this.findById(id);
    }

    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return null;
    ScheduleService.schedules[index] = { ...this.schedules[index], ...data, updatedAt: new Date() };
    return ScheduleService.schedules[index];
  }

  async delete(id: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.transaction(async (conn) => {
        await conn.execute('DELETE FROM task_activities WHERE task_id IN (SELECT id FROM tasks WHERE schedule_id = ?)', [id]);
        await conn.execute('DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE schedule_id = ?)', [id]);
        await conn.execute('DELETE FROM tasks WHERE schedule_id = ?', [id]);
        await conn.execute('DELETE FROM schedules WHERE id = ?', [id]);
      });
      return true;
    }

    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return false;
    ScheduleService.schedules.splice(index, 1);
    ScheduleService.tasks = ScheduleService.tasks.filter(t => t.scheduleId !== id);
    return true;
  }

  async findTasksByScheduleId(scheduleId: string): Promise<Task[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM tasks WHERE schedule_id = ?', [scheduleId]);
      return rows.map((r: any) => this.rowToTask(r));
    }
    return this.tasks.filter(t => t.scheduleId === scheduleId);
  }

  async findTaskById(id: string): Promise<Task | null> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM tasks WHERE id = ?', [id]);
      return rows.length > 0 ? this.rowToTask(rows[0]) : null;
    }
    return this.tasks.find(t => t.id === id) || null;
  }

  async findAllTasks(): Promise<Task[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM tasks');
      return rows.map((r: any) => this.rowToTask(r));
    }
    return [...this.tasks];
  }

  /** Find all tasks that directly depend on the given task ID */
  async findDependentTasks(taskId: string): Promise<Task[]> {
    if (this.useDb) {
      const rows = await databaseService.query('SELECT * FROM tasks WHERE dependency = ?', [taskId]);
      return rows.map((r: any) => this.rowToTask(r));
    }
    return this.tasks.filter(t => t.dependency === taskId);
  }

  /** Recursively find all downstream tasks (transitive dependents) */
  async findAllDownstreamTasks(taskId: string): Promise<Task[]> {
    const result: Task[] = [];
    const visited = new Set<string>();

    const collect = async (id: string) => {
      const dependents = await this.findDependentTasks(id);
      for (const dep of dependents) {
        if (!visited.has(dep.id)) {
          visited.add(dep.id);
          result.push(dep);
          await collect(dep.id);
        }
      }
    };

    await collect(taskId);
    return result;
  }

  async createTask(data: CreateTaskData): Promise<Task> {
    const id = `task-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const status = data.status || 'pending';
    const priority = data.priority || 'medium';
    const progressPercentage = data.progressPercentage || 0;

    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO tasks (id, schedule_id, name, description, status, priority, assigned_to, due_date, estimated_days, estimated_duration_hours, actual_duration_hours, start_date, end_date, progress_percentage, dependency, dependency_type, risks, issues, comments, parent_task_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.scheduleId, data.name, data.description ?? null, status, priority,
          data.assignedTo ?? null, data.dueDate ?? null, data.estimatedDays ?? null,
          data.estimatedDurationHours ?? null, data.actualDurationHours ?? null,
          data.startDate ?? null, data.endDate ?? null, progressPercentage,
          data.dependency ?? null, (data as any).dependencyType ?? null,
          data.risks ?? null, data.issues ?? null, data.comments ?? null,
          data.parentTaskId ?? null, data.createdBy, now, now,
        ],
      );
      return {
        id,
        scheduleId: data.scheduleId,
        name: data.name,
        description: data.description,
        status,
        priority,
        assignedTo: data.assignedTo,
        dueDate: data.dueDate,
        estimatedDays: data.estimatedDays,
        estimatedDurationHours: data.estimatedDurationHours,
        actualDurationHours: data.actualDurationHours,
        startDate: data.startDate,
        endDate: data.endDate,
        progressPercentage,
        dependency: data.dependency,
        dependencyType: (data as any).dependencyType as Task['dependencyType'],
        risks: data.risks,
        issues: data.issues,
        comments: data.comments,
        parentTaskId: data.parentTaskId,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      };
    }

    const task: Task = {
      id,
      ...data,
      status,
      priority,
      progressPercentage,
      createdAt: now,
      updatedAt: now,
    };
    ScheduleService.tasks.push(task);
    return task;
  }

  async updateTask(id: string, data: Partial<Omit<Task, 'id' | 'scheduleId' | 'createdAt' | 'updatedAt'>>): Promise<Task | null> {
    if (this.useDb) {
      // Fetch old task for activity logging
      const oldTask = await this.findTaskById(id);
      if (!oldTask) return null;

      // Auto-log field changes as activity
      const trackFields: (keyof Task)[] = ['status', 'priority', 'assignedTo', 'progressPercentage', 'startDate', 'endDate', 'name'];
      for (const field of trackFields) {
        if (field in data && data[field as keyof typeof data] !== undefined) {
          const oldVal = String(oldTask[field] ?? '');
          const newVal = String(data[field as keyof typeof data] ?? '');
          if (oldVal !== newVal) {
            this.logActivity(id, '1', 'System', 'updated', field, oldVal, newVal);
          }
        }
      }

      // Build dynamic SET clause
      const setClauses: string[] = [];
      const values: any[] = [];
      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        status: 'status',
        priority: 'priority',
        assignedTo: 'assigned_to',
        dueDate: 'due_date',
        estimatedDays: 'estimated_days',
        estimatedDurationHours: 'estimated_duration_hours',
        actualDurationHours: 'actual_duration_hours',
        startDate: 'start_date',
        endDate: 'end_date',
        progressPercentage: 'progress_percentage',
        dependency: 'dependency',
        dependencyType: 'dependency_type',
        risks: 'risks',
        issues: 'issues',
        comments: 'comments',
        parentTaskId: 'parent_task_id',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          setClauses.push(`${col} = ?`);
          values.push((data as any)[key]);
        }
      }
      if (setClauses.length === 0) return this.findTaskById(id);
      setClauses.push('updated_at = ?');
      values.push(new Date());
      values.push(id);
      await databaseService.query(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`, values);
      return this.findTaskById(id);
    }

    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const oldTask = this.tasks[index];

    // Auto-log field changes as activity
    const trackFields: (keyof Task)[] = ['status', 'priority', 'assignedTo', 'progressPercentage', 'startDate', 'endDate', 'name'];
    for (const field of trackFields) {
      if (field in data && data[field as keyof typeof data] !== undefined) {
        const oldVal = String(oldTask[field] ?? '');
        const newVal = String(data[field as keyof typeof data] ?? '');
        if (oldVal !== newVal) {
          this.logActivity(id, '1', 'System', 'updated', field, oldVal, newVal);
        }
      }
    }

    ScheduleService.tasks[index] = { ...this.tasks[index], ...data, updatedAt: new Date() };
    return ScheduleService.tasks[index];
  }

  async deleteTask(id: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.query('DELETE FROM tasks WHERE id = ?', [id]);
      return true;
    }

    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    ScheduleService.tasks.splice(index, 1);
    return true;
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  addComment(taskId: string, text: string, userId: string, userName: string): TaskComment {
    const comment: TaskComment = {
      id: `cmt-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      userId,
      userName,
      text,
      createdAt: new Date().toISOString(),
    };
    ScheduleService.comments.push(comment);
    if (this.useDb) {
      databaseService.query(
        'INSERT INTO task_comments (id, task_id, user_id, user_name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [comment.id, taskId, userId, userName, text, new Date()],
      ).catch(() => {});
    }
    return comment;
  }

  getComments(taskId: string): TaskComment[] {
    return ScheduleService.comments
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  deleteComment(commentId: string): boolean {
    const idx = ScheduleService.comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return false;
    ScheduleService.comments.splice(idx, 1);
    if (this.useDb) {
      databaseService.query('DELETE FROM task_comments WHERE id = ?', [commentId]).catch(() => {});
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Activity Feed
  // -------------------------------------------------------------------------

  logActivity(
    taskId: string,
    userId: string,
    userName: string,
    action: string,
    field?: string,
    oldValue?: string,
    newValue?: string,
  ): TaskActivityEntry {
    const entry: TaskActivityEntry = {
      id: `act-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      userId,
      userName,
      action,
      field,
      oldValue,
      newValue,
      createdAt: new Date().toISOString(),
    };
    ScheduleService.activities.push(entry);
    if (this.useDb) {
      databaseService.query(
        'INSERT INTO task_activities (id, task_id, user_id, user_name, action, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [entry.id, taskId, userId, userName, action, field ?? null, oldValue ?? null, newValue ?? null, new Date()],
      ).catch(() => {});
    }
    return entry;
  }

  getActivities(taskId: string): TaskActivityEntry[] {
    return ScheduleService.activities
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getActivitiesBySchedule(scheduleId: string): TaskActivityEntry[] {
    const taskIds = new Set(this.tasks.filter(t => t.scheduleId === scheduleId).map(t => t.id));
    return ScheduleService.activities
      .filter((a) => taskIds.has(a.taskId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllActivities(): TaskActivityEntry[] {
    return [...ScheduleService.activities]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // -------------------------------------------------------------------------
  // Auto-Scheduling: Cascade Reschedule
  // -------------------------------------------------------------------------

  async cascadeReschedule(taskId: string, oldEndDate: Date, newEndDate: Date): Promise<CascadeResult> {
    const deltaDays = Math.round((newEndDate.getTime() - oldEndDate.getTime()) / (1000 * 60 * 60 * 24));
    const deltaMs = deltaDays * 24 * 60 * 60 * 1000;

    if (deltaDays === 0) {
      return { triggeredByTaskId: taskId, deltaDays: 0, affectedTasks: [] };
    }

    // Get downstream tasks in topological order (BFS)
    const downstream = await this.findAllDownstreamTasks(taskId);
    const affectedTasks: CascadeChange[] = [];

    // Process tasks - they're already in dependency order from BFS traversal
    for (const task of downstream) {
      if (task.dependencyType && task.dependencyType !== 'FS') continue; // Only cascade FS deps

      const oldStart = task.startDate ? new Date(task.startDate) : null;
      const oldEnd = task.endDate ? new Date(task.endDate) : null;

      if (!oldStart && !oldEnd) continue;

      const newStart = oldStart ? new Date(oldStart.getTime() + deltaMs) : null;
      const newEnd = oldEnd ? new Date(oldEnd.getTime() + deltaMs) : null;

      const change: CascadeChange = {
        taskId: task.id,
        taskName: task.name,
        oldStartDate: oldStart?.toISOString().split('T')[0] || '',
        newStartDate: newStart?.toISOString().split('T')[0] || '',
        oldEndDate: oldEnd?.toISOString().split('T')[0] || '',
        newEndDate: newEnd?.toISOString().split('T')[0] || '',
        deltaDays,
      };

      // Apply the shift
      if (this.useDb) {
        await databaseService.query(
          'UPDATE tasks SET start_date = ?, end_date = ?, updated_at = ? WHERE id = ?',
          [newStart, newEnd, new Date(), task.id],
        );
      } else {
        const idx = this.tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) {
          if (newStart) ScheduleService.tasks[idx].startDate = newStart;
          if (newEnd) ScheduleService.tasks[idx].endDate = newEnd;
          ScheduleService.tasks[idx].updatedAt = new Date();
        }
      }

      this.logActivity(task.id, '1', 'System', 'auto-rescheduled', 'dates',
        `${change.oldStartDate} - ${change.oldEndDate}`,
        `${change.newStartDate} - ${change.newEndDate}`
      );

      affectedTasks.push(change);
    }

    return { triggeredByTaskId: taskId, deltaDays, affectedTasks };
  }
}
