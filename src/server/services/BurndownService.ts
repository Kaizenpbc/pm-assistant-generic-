import { ScheduleService, Task } from './ScheduleService';

export interface BurndownDataPoint {
  date: string;
  ideal: number;
  actual: number;
  completed: number;
}

export interface BurndownData {
  dataPoints: BurndownDataPoint[];
  totalScope: number;
  completedCount: number;
  percentComplete: number;
  startDate: string;
  endDate: string;
}

export interface VelocityDataPoint {
  weekStart: string;
  completed: number;
}

export interface VelocityData {
  weeks: VelocityDataPoint[];
  averageVelocity: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export class BurndownService {
  private scheduleService = new ScheduleService();

  async getBurndownData(scheduleId: string): Promise<BurndownData> {
    const schedule = await this.scheduleService.findById(scheduleId);
    const tasks = await this.scheduleService.findTasksByScheduleId(scheduleId);

    if (!schedule || tasks.length === 0) {
      return {
        dataPoints: [],
        totalScope: 0,
        completedCount: 0,
        percentComplete: 0,
        startDate: '',
        endDate: '',
      };
    }

    const totalScope = tasks.length;
    const startDate = new Date(schedule.startDate);
    const endDate = new Date(schedule.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const DAY_MS = 86_400_000;
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS));

    // Build a "completed on date" map — use task endDate for completed tasks
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completionDates: Date[] = completedTasks.map(t => {
      if (t.endDate) return new Date(t.endDate);
      return new Date();
    });
    completionDates.sort((a, b) => a.getTime() - b.getTime());

    // Generate data points (weekly or daily depending on duration)
    const interval = totalDays > 60 ? 7 : 1;
    const dataPoints: BurndownDataPoint[] = [];

    for (let dayOffset = 0; dayOffset <= totalDays; dayOffset += interval) {
      const currentDate = new Date(startDate.getTime() + dayOffset * DAY_MS);
      const dateStr = currentDate.toISOString().slice(0, 10);

      // Ideal line: linear decrease
      const idealRemaining = totalScope * (1 - dayOffset / totalDays);

      // Actual: count completed tasks up to this date
      let completedByDate = 0;
      if (currentDate <= today) {
        completedByDate = completionDates.filter(d => d <= currentDate).length;
      }

      const actualRemaining = currentDate <= today ? totalScope - completedByDate : -1;

      dataPoints.push({
        date: dateStr,
        ideal: Math.max(0, Math.round(idealRemaining * 10) / 10),
        actual: actualRemaining >= 0 ? actualRemaining : -1, // -1 = future (don't render)
        completed: currentDate <= today ? completedByDate : -1,
      });
    }

    const completedCount = completedTasks.length;
    const percentComplete = totalScope > 0 ? Math.round((completedCount / totalScope) * 100) : 0;

    return {
      dataPoints,
      totalScope,
      completedCount,
      percentComplete,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    };
  }

  async getVelocityData(scheduleId: string): Promise<VelocityData> {
    const schedule = await this.scheduleService.findById(scheduleId);
    const tasks = await this.scheduleService.findTasksByScheduleId(scheduleId);

    if (!schedule || tasks.length === 0) {
      return { weeks: [], averageVelocity: 0, trend: 'stable' };
    }

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const startDate = new Date(schedule.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const DAY_MS = 86_400_000;
    const WEEK_MS = 7 * DAY_MS;

    // Get the Monday of the start week
    const startDay = startDate.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    const firstMonday = new Date(startDate.getTime() + mondayOffset * DAY_MS);

    const weeks: VelocityDataPoint[] = [];
    let weekStart = new Date(firstMonday);

    while (weekStart <= today) {
      const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
      const completed = completedTasks.filter(t => {
        const endDate = t.endDate ? new Date(t.endDate) : null;
        return endDate && endDate >= weekStart && endDate < weekEnd;
      }).length;

      weeks.push({
        weekStart: weekStart.toISOString().slice(0, 10),
        completed,
      });

      weekStart = new Date(weekStart.getTime() + WEEK_MS);
    }

    const totalCompleted = weeks.reduce((sum, w) => sum + w.completed, 0);
    const averageVelocity = weeks.length > 0 ? Math.round((totalCompleted / weeks.length) * 10) / 10 : 0;

    // Determine trend from last 4 weeks
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (weeks.length >= 4) {
      const recent = weeks.slice(-4);
      const firstHalf = (recent[0].completed + recent[1].completed) / 2;
      const secondHalf = (recent[2].completed + recent[3].completed) / 2;
      if (secondHalf > firstHalf * 1.2) trend = 'increasing';
      else if (secondHalf < firstHalf * 0.8) trend = 'decreasing';
    }

    return { weeks, averageVelocity, trend };
  }
}

export const burndownService = new BurndownService();
