import { ScheduleService, Task, Schedule } from '../ScheduleService';

/**
 * Creates a minimal Task object with sensible defaults.
 * Override any field by passing partial data.
 */
export function makeTask(overrides: Partial<Task> & { id: string; scheduleId: string; name: string }): Task {
  return {
    status: 'pending',
    priority: 'medium',
    createdBy: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to directly create a schedule + tasks in the static ScheduleService store
 * without going through async methods (avoids random ID generation).
 */
export async function seedSchedule(
  scheduleService: ScheduleService,
  scheduleData: { id?: string; projectId: string; name: string; startDate: Date; endDate: Date },
  tasks: Array<Partial<Task> & { id: string; name: string }>,
): Promise<{ schedule: Schedule; tasks: Task[] }> {
  const schedule = await scheduleService.create({
    projectId: scheduleData.projectId,
    name: scheduleData.name,
    startDate: scheduleData.startDate,
    endDate: scheduleData.endDate,
    createdBy: '1',
  });

  const createdTasks: Task[] = [];
  for (const t of tasks) {
    const task = await scheduleService.createTask({
      scheduleId: schedule.id,
      name: t.name,
      description: t.description,
      status: t.status || 'pending',
      priority: t.priority || 'medium',
      startDate: t.startDate,
      endDate: t.endDate,
      estimatedDays: t.estimatedDays,
      progressPercentage: t.progressPercentage,
      dependency: t.dependency,
      createdBy: '1',
    });
    // Overwrite the random ID with our deterministic one so dependency references work
    (task as any).id = t.id;
    createdTasks.push(task);
  }

  return { schedule, tasks: createdTasks };
}
