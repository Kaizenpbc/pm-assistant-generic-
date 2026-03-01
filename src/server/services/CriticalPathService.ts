import { scheduleService, Task } from './ScheduleService';

export interface CPMTaskResult {
  taskId: string;
  name: string;
  duration: number; // in days
  ES: number; // Early Start (day offset)
  EF: number; // Early Finish (day offset)
  LS: number; // Late Start (day offset)
  LF: number; // Late Finish (day offset)
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  criticalPathTaskIds: string[];
  tasks: CPMTaskResult[];
  projectDuration: number;
}

export class CriticalPathService {
  async calculateCriticalPath(scheduleId: string): Promise<CriticalPathResult> {
    const tasks = await scheduleService.findTasksByScheduleId(scheduleId);
    if (tasks.length === 0) {
      return { criticalPathTaskIds: [], tasks: [], projectDuration: 0 };
    }

    // Build adjacency: task -> list of successor task IDs
    const taskMap = new Map<string, Task>();
    const successors = new Map<string, string[]>();
    const predecessors = new Map<string, string[]>();

    for (const t of tasks) {
      taskMap.set(t.id, t);
      if (!successors.has(t.id)) successors.set(t.id, []);
      if (!predecessors.has(t.id)) predecessors.set(t.id, []);
    }

    for (const t of tasks) {
      if (t.dependency && taskMap.has(t.dependency)) {
        successors.get(t.dependency)!.push(t.id);
        predecessors.get(t.id)!.push(t.dependency);
      }
    }

    // Compute durations in days
    const DAY_MS = 86_400_000;
    function getDuration(t: Task): number {
      if (t.estimatedDays && t.estimatedDays > 0) return t.estimatedDays;
      if (t.startDate && t.endDate) {
        const d = Math.round(
          (new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / DAY_MS,
        );
        return Math.max(1, d);
      }
      return 1;
    }

    // Topological sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    for (const t of tasks) {
      inDegree.set(t.id, (predecessors.get(t.id) || []).length);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      topoOrder.push(id);
      for (const succ of successors.get(id) || []) {
        const newDeg = (inDegree.get(succ) || 1) - 1;
        inDegree.set(succ, newDeg);
        if (newDeg === 0) queue.push(succ);
      }
    }

    // If cycle detected, include remaining tasks at the end
    if (topoOrder.length < tasks.length) {
      for (const t of tasks) {
        if (!topoOrder.includes(t.id)) topoOrder.push(t.id);
      }
    }

    // Forward pass: compute ES, EF
    const esMap = new Map<string, number>();
    const efMap = new Map<string, number>();

    for (const id of topoOrder) {
      const t = taskMap.get(id)!;
      const dur = getDuration(t);
      let es = 0;
      for (const pred of predecessors.get(id) || []) {
        es = Math.max(es, efMap.get(pred) || 0);
      }
      esMap.set(id, es);
      efMap.set(id, es + dur);
    }

    // Project duration
    let projectDuration = 0;
    for (const ef of efMap.values()) {
      projectDuration = Math.max(projectDuration, ef);
    }

    // Backward pass: compute LS, LF
    const lsMap = new Map<string, number>();
    const lfMap = new Map<string, number>();

    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const id = topoOrder[i];
      const t = taskMap.get(id)!;
      const dur = getDuration(t);
      const succs = successors.get(id) || [];

      let lf = projectDuration;
      for (const succ of succs) {
        lf = Math.min(lf, lsMap.get(succ) ?? projectDuration);
      }
      lfMap.set(id, lf);
      lsMap.set(id, lf - dur);
    }

    // Compute float and identify critical tasks
    const results: CPMTaskResult[] = [];
    const criticalIds: string[] = [];

    for (const id of topoOrder) {
      const t = taskMap.get(id)!;
      const dur = getDuration(t);
      const es = esMap.get(id)!;
      const ef = efMap.get(id)!;
      const ls = lsMap.get(id)!;
      const lf = lfMap.get(id)!;
      const totalFloat = ls - es;

      // Free float = min(ES of successors) - EF of this task
      const succs = successors.get(id) || [];
      let freeFloat = totalFloat;
      if (succs.length > 0) {
        let minSuccES = Infinity;
        for (const s of succs) {
          minSuccES = Math.min(minSuccES, esMap.get(s) || 0);
        }
        freeFloat = minSuccES - ef;
      }

      const isCritical = totalFloat === 0;
      if (isCritical) criticalIds.push(id);

      results.push({
        taskId: id,
        name: t.name,
        duration: dur,
        ES: es,
        EF: ef,
        LS: ls,
        LF: lf,
        totalFloat,
        freeFloat: Math.max(0, freeFloat),
        isCritical,
      });
    }

    return {
      criticalPathTaskIds: criticalIds,
      tasks: results,
      projectDuration,
    };
  }
}

export const criticalPathService = new CriticalPathService();
