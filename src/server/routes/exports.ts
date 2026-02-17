import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
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
      const { format } = request.query as { format?: string };

      // Verify ownership before exporting
      const project = await verifyProjectAccess(id, request.user.userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

      const schedules = await scheduleService.findByProjectId(id);

      if (format === 'json') {
        // JSON export — full project report data for client-side PDF rendering
        const cpmService = new CriticalPathService();

        const schedulesWithTasks = [];
        let allTaskCount = 0;
        let allProgressSum = 0;
        for (const schedule of schedules) {
          const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
          let criticalPath = null;
          try {
            criticalPath = await cpmService.calculateCriticalPath(schedule.id);
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
              parentTaskId: t.parentTaskId || '',
              estimatedDays: t.estimatedDays,
            })),
            criticalPath,
          });
        }

        const avgProgress = allTaskCount > 0 ? Math.round(allProgressSum / allTaskCount) : 0;

        return reply.send({
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            budgetAllocated: project.budgetAllocated,
            budgetSpent: project.budgetSpent,
            progressPercentage: avgProgress,
            startDate: project.startDate,
            endDate: project.endDate,
          },
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
        'Dependency',
        'Parent Task',
      ];

      const rows: string[][] = [];

      for (const schedule of schedules) {
        const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
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
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Export error');
      return reply.status(500).send({ error: 'Failed to export project data' });
    }
  });
}
