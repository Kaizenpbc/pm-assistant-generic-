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
    }
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
      startDate: new Date('2027-10-01'),
      endDate: new Date('2027-12-31'),
      progressPercentage: 0,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private get schedules() { return ScheduleService.schedules; }
  private get tasks() { return ScheduleService.tasks; }

  async findByProjectId(projectId: string): Promise<Schedule[]> {
    return this.schedules.filter(s => s.projectId === projectId);
  }

  async findById(id: string): Promise<Schedule | null> {
    return this.schedules.find(s => s.id === id) || null;
  }

  async create(data: CreateScheduleData): Promise<Schedule> {
    const schedule: Schedule = {
      id: `sch-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ScheduleService.schedules.push(schedule);
    return schedule;
  }

  async update(id: string, data: Partial<Omit<Schedule, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>): Promise<Schedule | null> {
    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return null;
    ScheduleService.schedules[index] = { ...this.schedules[index], ...data, updatedAt: new Date() };
    return ScheduleService.schedules[index];
  }

  async delete(id: string): Promise<boolean> {
    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return false;
    ScheduleService.schedules.splice(index, 1);
    ScheduleService.tasks = ScheduleService.tasks.filter(t => t.scheduleId !== id);
    return true;
  }

  async findTasksByScheduleId(scheduleId: string): Promise<Task[]> {
    return this.tasks.filter(t => t.scheduleId === scheduleId);
  }

  async findTaskById(id: string): Promise<Task | null> {
    return this.tasks.find(t => t.id === id) || null;
  }

  async findAllTasks(): Promise<Task[]> {
    return [...this.tasks];
  }

  async createTask(data: CreateTaskData): Promise<Task> {
    const task: Task = {
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      progressPercentage: data.progressPercentage || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ScheduleService.tasks.push(task);
    return task;
  }

  async updateTask(id: string, data: Partial<Omit<Task, 'id' | 'scheduleId' | 'createdAt' | 'updatedAt'>>): Promise<Task | null> {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    ScheduleService.tasks[index] = { ...this.tasks[index], ...data, updatedAt: new Date() };
    return ScheduleService.tasks[index];
  }

  async deleteTask(id: string): Promise<boolean> {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    ScheduleService.tasks.splice(index, 1);
    return true;
  }
}
