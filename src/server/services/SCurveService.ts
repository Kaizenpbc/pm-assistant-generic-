import { scheduleService, Task, Schedule } from './ScheduleService';
import { projectService } from './ProjectService';

export interface SCurveDataPoint {
  date: string;
  pv: number;
  ev: number;
  ac: number;
}

export class SCurveService {
  async computeSCurveData(projectId: string): Promise<SCurveDataPoint[]> {
    const project = await projectService.findById(projectId);
    if (!project) return [];

    const budgetAllocated = project.budgetAllocated || 0;
    const budgetSpent = project.budgetSpent || 0;
    if (budgetAllocated <= 0) return [];

    const schedules = await scheduleService.findByProjectId(projectId);
    if (schedules.length === 0) return [];

    // Gather all tasks across schedules
    const allTasks: Task[] = [];
    for (const sch of schedules) {
      const tasks = await scheduleService.findTasksByScheduleId(sch.id);
      allTasks.push(...tasks);
    }
    if (allTasks.length === 0) return [];

    // Determine overall date range
    const DAY_MS = 86_400_000;
    let projectStart = Infinity;
    let projectEnd = -Infinity;

    for (const t of allTasks) {
      if (t.startDate) projectStart = Math.min(projectStart, new Date(t.startDate).getTime());
      if (t.endDate) projectEnd = Math.max(projectEnd, new Date(t.endDate).getTime());
    }

    if (projectStart === Infinity || projectEnd === -Infinity) return [];

    // Compute per-task allocated budget proportional to duration
    let totalDuration = 0;
    const taskDurations: { task: Task; duration: number; start: number; end: number }[] = [];

    for (const t of allTasks) {
      if (!t.startDate || !t.endDate) continue;
      const start = new Date(t.startDate).getTime();
      const end = new Date(t.endDate).getTime();
      const dur = Math.max(1, Math.round((end - start) / DAY_MS));
      totalDuration += dur;
      taskDurations.push({ task: t, duration: dur, start, end });
    }

    if (totalDuration === 0) return [];

    // Generate weekly data points
    const weekMs = 7 * DAY_MS;
    const dataPoints: SCurveDataPoint[] = [];
    const now = Date.now();

    for (let time = projectStart; time <= projectEnd + weekMs; time += weekMs) {
      const weekEnd = Math.min(time, projectEnd);

      let pv = 0; // Planned Value: cumulative planned spend by this date
      let ev = 0; // Earned Value: cumulative progress-weighted planned spend

      for (const { task, duration, start, end } of taskDurations) {
        const taskBudget = (duration / totalDuration) * budgetAllocated;

        // PV: proportion of task that should be complete by this date
        if (weekEnd >= end) {
          pv += taskBudget;
        } else if (weekEnd > start) {
          const elapsed = (weekEnd - start) / (end - start);
          pv += taskBudget * elapsed;
        }

        // EV: task's progress percentage * its budget share
        const progress = (task.progressPercentage ?? 0) / 100;
        if (weekEnd >= start) {
          ev += taskBudget * progress;
        }
      }

      // AC: distribute actual spend proportionally up to current date
      const projectElapsed = (Math.min(weekEnd, now) - projectStart) / (projectEnd - projectStart);
      const ac = weekEnd <= now
        ? budgetSpent * Math.max(0, Math.min(1, projectElapsed))
        : budgetSpent; // flatten after now

      if (weekEnd > now) {
        // Don't project AC beyond today
        dataPoints.push({
          date: new Date(weekEnd).toISOString().slice(0, 10),
          pv: Math.round(pv),
          ev: Math.round(ev),
          ac: Math.round(budgetSpent),
        });
      } else {
        dataPoints.push({
          date: new Date(weekEnd).toISOString().slice(0, 10),
          pv: Math.round(pv),
          ev: Math.round(ev),
          ac: Math.round(ac),
        });
      }
    }

    return dataPoints;
  }
}

export const sCurveService = new SCurveService();
