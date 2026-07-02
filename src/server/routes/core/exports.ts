import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { scheduleService } from '../../services/ScheduleService';
import { projectService } from '../../services/ProjectService';
import { criticalPathService } from '../../services/CriticalPathService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /exports/projects/:id/export?format=csv|json
  fastify.get('/projects/:id/export', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { format } = request.query as { format?: string };

      const schedules = await scheduleService.findByProjectId(id);

      if (format === 'json') {
        // JSON export — full project report data for client-side PDF rendering
        const project = await projectService.findById(id);

        const schedulesWithTasks = [];
        let allTaskCount = 0;
        let allProgressSum = 0;
        for (const schedule of schedules) {
          const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
          let criticalPath = null;
          try {
            criticalPath = await criticalPathService.calculateCriticalPath(schedule.id);
          } catch { /* ignore */ }
          for (const t of tasks) {
            allTaskCount++;
            allProgressSum += t.progressPercentage ?? 0;
          }
          schedulesWithTasks.push({
            id: schedule.id,
            name: schedule.name,
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            tasks: tasks.map((t) => ({
              id: t.id,
              name: t.name,
              status: t.status,
              priority: t.priority,
              assignedTo: t.assignedTo || '',
              startDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : '',
              endDate: t.endDate ? new Date(t.endDate).toISOString().slice(0, 10) : '',
              progressPercentage: t.progressPercentage ?? 0,
              dependency: t.dependency || '',
              dependencies: t.dependencies.map(d => ({
                dependencyId: d.dependencyId,
                dependencyType: d.dependencyType,
                lagDays: d.lagDays,
              })),
              parentTaskId: t.parentTaskId || '',
              estimatedDays: t.estimatedDays,
            })),
            criticalPath,
          });
        }

        const avgProgress = allTaskCount > 0 ? Math.round(allProgressSum / allTaskCount) : 0;

        return reply.send({
          project: project ? {
            id: project.id,
            name: project.name,
            status: project.status,
            budgetAllocated: project.budgetAllocated,
            budgetSpent: project.budgetSpent,
            progressPercentage: avgProgress,
            startDate: project.startDate,
            endDate: project.endDate,
          } : null,
          schedules: schedulesWithTasks,
          generatedAt: new Date().toISOString(),
        });
      }

      if (format !== 'csv') {
        return reply.status(400).send({ error: 'Supported formats: csv, json' });
      }

      const headers = [
        'Schedule',
        'Task ID',
        'Task Name',
        'Status',
        'Priority',
        'Assigned To',
        'Start Date',
        'End Date',
        'Progress %',
        'Predecessors',
        'Parent Task',
      ];

      const rows: string[][] = [];

      for (const schedule of schedules) {
        const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
        // Build row number map for MS Project-style predecessor labels
        const taskRowNum = new Map<string, number>();
        tasks.forEach((t, idx) => taskRowNum.set(t.id, idx + 1));

        for (const task of tasks) {
          // Build predecessor string in MS Project format: "3FS+2d,5SS"
          const predLabels = task.dependencies.map(d => {
            const rowNum = taskRowNum.get(d.dependencyId);
            if (!rowNum) return '';
            let label = String(rowNum);
            if (d.dependencyType !== 'FS') label += d.dependencyType;
            if (d.lagDays !== 0) label += (d.lagDays > 0 ? `+${d.lagDays}d` : `${d.lagDays}d`);
            return label;
          }).filter(Boolean);

          rows.push([
            schedule.name,
            task.id,
            task.name,
            task.status,
            task.priority,
            task.assignedTo || '',
            task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : '',
            task.endDate ? new Date(task.endDate).toISOString().slice(0, 10) : '',
            String(task.progressPercentage ?? 0),
            predLabels.join(','),
            task.parentTaskId || '',
          ]);
        }
      }

      // Escape CSV fields
      function escapeCSV(field: string): string {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      }

      const csv = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
      ].join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="project-${id}-export.csv"`);
      return reply.send(csv);
    } catch (error) {
      console.error('Export error:', error);
      return reply.status(500).send({ error: 'Failed to export project data' });
    }
  });
}
