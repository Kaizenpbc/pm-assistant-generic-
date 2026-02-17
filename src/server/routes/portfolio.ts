import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProjectService } from '../services/ProjectService';
import { ScheduleService } from '../services/ScheduleService';
import { authMiddleware } from '../middleware/auth';

export async function portfolioRoutes(fastify: FastifyInstance) {
  const projectService = new ProjectService();
  const scheduleService = new ScheduleService();

  fastify.get('/', {
    preHandler: [authMiddleware],
    schema: { description: 'Get portfolio overview with all projects and tasks', tags: ['portfolio'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const userId = request.user.userId;
      const projects = await projectService.findByUserId(userId);

      const portfolioItems = await Promise.all(
        projects.map(async (project) => {
          const schedules = await scheduleService.findByProjectId(project.id);
          const allTasks = [];
          for (const schedule of schedules) {
            const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
            allTasks.push(...tasks);
          }

          return {
            projectId: project.id,
            projectName: project.name,
            status: project.status,
            priority: project.priority,
            startDate: project.startDate,
            endDate: project.endDate,
            tasks: allTasks.map(t => ({
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
        })
      );

      return { portfolioItems };
    } catch (error) {
      request.log.error({ err: error }, 'Get portfolio error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch portfolio' });
    }
  });
}
