import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { ScheduleService } from '../services/ScheduleService';
import { CriticalPathService } from '../services/CriticalPathService';
import { idParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

export async function exportRoutes(fastify: FastifyInstance) {
  const scheduleService = new ScheduleService();

  // GET /exports/projects/:id/export?format=csv|json
  fastify.get('/projects/:id/export', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const querySchema = z.object({ format: z.enum(['csv', 'json']) });
      const { format } = querySchema.parse(request.query);

      // Verify ownership before exporting
      const project = await verifyProjectAccess(id, request.user.userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

      const schedules = await scheduleService.findByProjectId(id);

      if (format === 'json') {
        // JSON export — full project report data for client-side PDF rendering
        const cpmService = new CriticalPathService();

        // Parallelize task + critical-path fetches across all schedules
        const schedulesWithTasks = await Promise.all(
          schedules.map(async (schedule) => {
            const [tasks, criticalPath] = await Promise.all([
              scheduleService.findTasksByScheduleId(schedule.id),
              cpmService.calculateCriticalPath(schedule.id).catch(() => null),
            ]);
            return {
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
                parentTaskId: t.parentTaskId || '',
                estimatedDays: t.estimatedDays,
              })),
              criticalPath,
              _rawTasks: tasks, // kept for progress calculation below
            };
          })
        );

        let allTaskCount = 0;
        let allProgressSum = 0;
        for (const s of schedulesWithTasks) {
          for (const t of s._rawTasks) {
            allTaskCount++;
            allProgressSum += t.progressPercentage ?? 0;
          }
        }

        const avgProgress = allTaskCount > 0 ? Math.round(allProgressSum / allTaskCount) : 0;

        return reply.send({
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            budgetAllocated: project.budgetAllocated,
            budgetSpent: project.budgetSpent,
            completionPercentage: avgProgress,
            startDate: project.startDate,
            endDate: project.endDate,
          },
          schedules: schedulesWithTasks.map(({ _rawTasks, ...rest }) => rest),
          generatedAt: new Date().toISOString(),
        });
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
        'Dependency',
        'Parent Task',
      ];

      // Parallelize task fetches for CSV export
      const scheduleTasks = await Promise.all(
        schedules.map(async (schedule) => {
          const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
          return { schedule, tasks };
        })
      );

      const rows: string[][] = [];
      for (const { schedule, tasks } of scheduleTasks) {
        for (const task of tasks) {
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
            task.dependency || '',
            task.parentTaskId || '',
          ]);
        }
      }

      // Escape CSV fields
      function escapeCSV(field: string): string {
        // Guard against CSV formula injection
        if (/^[=+\-@\t\r]/.test(field)) {
          field = "'" + field;
        }
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return '"' + field.replace(/"/g, '""') + '"';
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
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Export error');
      return reply.status(500).send({ error: 'Failed to export project data' });
    }
  });
}
