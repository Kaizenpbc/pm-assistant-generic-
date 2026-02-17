import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { TaskPrioritizationService } from '../services/TaskPrioritizationService';
import { projectAndScheduleIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

const applyBodySchema = z.object({
  taskId: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

const applyAllBodySchema = z.object({
  changes: z.array(
    z.object({
      taskId: z.string().max(100),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
    }),
  ).max(500),
});

export async function taskPrioritizationRoutes(fastify: FastifyInstance) {
  const service = new TaskPrioritizationService();

  // GET /:projectId/:scheduleId/prioritize — get AI-prioritized task list
  fastify.get('/:projectId/:scheduleId/prioritize', {
    preHandler: [authMiddleware],
    schema: { description: 'Get AI-prioritized task ranking for a schedule', tags: ['task-prioritization'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId, scheduleId } = projectAndScheduleIdParam.parse(request.params);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
      const result = await service.prioritizeTasks(projectId, scheduleId);
      return result;
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Task prioritization error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to prioritize tasks',
      });
    }
  });

  // POST /:projectId/:scheduleId/apply — apply a single priority change
  fastify.post('/:projectId/:scheduleId/apply', {
    preHandler: [authMiddleware],
    schema: { description: 'Apply a single AI-suggested priority change', tags: ['task-prioritization'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = projectAndScheduleIdParam.parse(request.params);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
      const body = applyBodySchema.parse(request.body);
      const applied = await service.applyPriorityChange(body.taskId, body.priority);
      if (!applied) {
        return reply.status(404).send({
          error: 'Task not found',
          message: 'The specified task does not exist',
        });
      }
      return { message: 'Priority updated successfully', taskId: body.taskId, priority: body.priority };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Apply priority error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to apply priority change',
      });
    }
  });

  // POST /:projectId/:scheduleId/apply-all — apply all suggested priority changes
  fastify.post('/:projectId/:scheduleId/apply-all', {
    preHandler: [authMiddleware],
    schema: { description: 'Apply all AI-suggested priority changes', tags: ['task-prioritization'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = projectAndScheduleIdParam.parse(request.params);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
      const body = applyAllBodySchema.parse(request.body);
      const applied = await service.applyAllPriorityChanges(body.changes);
      return { message: `Applied ${applied} priority change(s) successfully`, applied };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Apply all priorities error');
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to apply priority changes',
      });
    }
  });
}
