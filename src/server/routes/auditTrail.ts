import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ScheduleService } from '../services/ScheduleService';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

export async function auditTrailRoutes(fastify: FastifyInstance) {
  const scheduleService = new ScheduleService();

  // GET /api/v1/audit/:projectId
  fastify.get('/:projectId', {
    preHandler: [authMiddleware],
    schema: { description: 'Get audit trail for a project', tags: ['audit'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

      // Verify ownership before returning audit trail
      const project = await verifyProjectAccess(projectId, request.user.userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

      // Find all schedules for the project
      const schedules = await scheduleService.findByProjectId(projectId);
      const allActivities = [];

      for (const schedule of schedules) {
        const activities = scheduleService.getActivitiesBySchedule(schedule.id);
        allActivities.push(...activities.map(a => ({
          ...a,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
        })));
      }

      // Sort by date descending
      allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = allActivities.length;
      const paged = allActivities.slice(Number(offset), Number(offset) + Number(limit));

      return { activities: paged, total, limit: Number(limit), offset: Number(offset) };
    } catch (error) {
      request.log.error({ err: error }, 'Get audit trail error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
