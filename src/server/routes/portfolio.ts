import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProjectService } from '../services/ProjectService';
import { ScheduleService } from '../services/ScheduleService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function portfolioRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const projectService = new ProjectService();
  const scheduleService = new ScheduleService();

  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get portfolio overview with all projects and tasks', tags: ['portfolio'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const userId = user.userId;
      const projects = await projectService.findByUserId(userId);

      // Batch: 3 queries total instead of 1 + N + N×M
      const projectIds = projects.map(p => p.id);
      const allSchedules = await scheduleService.findByProjectIds(projectIds);
      const scheduleIds = allSchedules.map(s => s.id);
      const allTasks = await scheduleService.findTasksByScheduleIds(scheduleIds);

      // Group schedules by projectId, tasks by scheduleId
      const schedulesByProject = new Map<string, string[]>();
      for (const s of allSchedules) {
        let ids = schedulesByProject.get(s.projectId);
        if (!ids) { ids = []; schedulesByProject.set(s.projectId, ids); }
        ids.push(s.id);
      }

      const tasksBySchedule = new Map<string, typeof allTasks>();
      for (const t of allTasks) {
        let arr = tasksBySchedule.get(t.scheduleId);
        if (!arr) { arr = []; tasksBySchedule.set(t.scheduleId, arr); }
        arr.push(t);
      }

      const portfolioItems = projects.map(project => {
        const projScheduleIds = schedulesByProject.get(project.id) ?? [];
        const projectTasks = projScheduleIds.flatMap(sid => tasksBySchedule.get(sid) ?? []);

        return {
          projectId: project.id,
          projectName: project.name,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate,
          endDate: project.endDate,
          tasks: projectTasks.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            startDate: t.startDate,
            endDate: t.endDate,
            progressPercentage: t.progressPercentage,
            parentTaskId: t.parentTaskId,
            assignedTo: t.assignedTo,
            dependency: t.dependency,
            dependencyType: t.dependencyType,
          })),
        };
      });

      return { portfolioItems };
    } catch (error) {
      console.error('Get portfolio error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch portfolio' });
    }
  });
}
