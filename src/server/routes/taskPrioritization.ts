import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TaskPrioritizationService } from '../services/TaskPrioritizationService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

const applyBodySchema = z.object({
  taskId: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

const applyAllBodySchema = z.object({
  changes: z.array(
    z.object({
      taskId: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
    }),
  ),
});

export async function taskPrioritizationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const service = new TaskPrioritizationService();

  // GET /:projectId/:scheduleId/prioritize — get AI-prioritized task list
  fastify.get('/:projectId/:scheduleId/prioritize', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get AI-prioritized task ranking for a schedule', tags: ['task-prioritization'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId, scheduleId } = request.params as { projectId: string; scheduleId: string };
      const result = await service.prioritizeTasks(projectId, scheduleId);
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: error.issues,
        });
      }
      console.error('Task prioritization error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to prioritize tasks',
      });
    }
  });

  // POST /:projectId/:scheduleId/apply — apply a single priority change
  fastify.post('/:projectId/:scheduleId/apply', {
    preHandler: [requireScope('write')],
    schema: { description: 'Apply a single AI-suggested priority change', tags: ['task-prioritization'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: error.issues,
        });
      }
      console.error('Apply priority error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to apply priority change',
      });
    }
  });

  // POST /:projectId/:scheduleId/apply-all — apply all suggested priority changes
  fastify.post('/:projectId/:scheduleId/apply-all', {
    preHandler: [requireScope('write')],
    schema: { description: 'Apply all AI-suggested priority changes', tags: ['task-prioritization'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = applyAllBodySchema.parse(request.body);
      const applied = await service.applyAllPriorityChanges(body.changes);
      return { message: `Applied ${applied} priority change(s) successfully`, applied };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          message: error.issues,
        });
      }
      console.error('Apply all priorities error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to apply priority changes',
      });
    }
  });
}
