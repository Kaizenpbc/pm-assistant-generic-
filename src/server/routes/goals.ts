import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';
import { goalService } from '../services/GoalService';

export async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET / — list goals with optional filters
  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: { description: 'List goals', tags: ['goals'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ownerId, projectId, goalType, status } = request.query as {
        ownerId?: string;
        projectId?: string;
        goalType?: string;
        status?: string;
      };
      const goals = await goalService.list({ ownerId, projectId, goalType, status });
      return { goals };
    } catch (error) {
      console.error('List goals error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to list goals' });
    }
  });

  // GET /:id — get single goal
  fastify.get('/:id', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get a goal by ID', tags: ['goals'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const goal = await goalService.findById(id);
      if (!goal) {
        return reply.status(404).send({ error: 'Not found', message: 'Goal not found' });
      }
      return { goal };
    } catch (error) {
      console.error('Get goal error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch goal' });
    }
  });

  // POST / — create goal
  fastify.post('/', {
    preHandler: [requireScope('write')],
    schema: { description: 'Create a goal', tags: ['goals'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const goal = await goalService.create({
        name: body.name,
        description: body.description,
        ownerId: body.ownerId,
        parentId: body.parentId,
        goalType: body.goalType,
        status: body.status,
        progress: body.progress,
        targetValue: body.targetValue,
        currentValue: body.currentValue,
        unit: body.unit,
        startDate: body.startDate,
        dueDate: body.dueDate,
        projectId: body.projectId,
      });

      // Auto-recalculate parent objective if creating a key_result
      if (goal.goalType === 'key_result' && goal.parentId) {
        await goalService.recalculateObjectiveProgress(goal.parentId);
      }

      return reply.status(201).send({ goal });
    } catch (error) {
      console.error('Create goal error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create goal' });
    }
  });

  // PUT /:id — update goal
  fastify.put('/:id', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update a goal', tags: ['goals'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const goal = await goalService.update(id, body);
      if (!goal) {
        return reply.status(404).send({ error: 'Not found', message: 'Goal not found' });
      }

      // Auto-recalculate parent objective if this is a key_result
      if (goal.goalType === 'key_result' && goal.parentId) {
        await goalService.recalculateObjectiveProgress(goal.parentId);
      }

      return { goal };
    } catch (error) {
      console.error('Update goal error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update goal' });
    }
  });

  // DELETE /:id — delete goal (admin only)
  fastify.delete('/:id', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Delete a goal', tags: ['goals'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Look up the goal before deleting to check for parent recalculation
      const existing = await goalService.findById(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Not found', message: 'Goal not found' });
      }

      const deleted = await goalService.delete(id);
      if (!deleted) {
        return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete goal' });
      }

      // Auto-recalculate parent objective if deleted goal was a key_result
      if (existing.goalType === 'key_result' && existing.parentId) {
        await goalService.recalculateObjectiveProgress(existing.parentId);
      }

      return { success: true };
    } catch (error) {
      console.error('Delete goal error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete goal' });
    }
  });
}
