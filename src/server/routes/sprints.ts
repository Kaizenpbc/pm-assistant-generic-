import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sprintService } from '../services/SprintService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function sprintRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST / — create sprint
  fastify.post('/', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const body = request.body as { projectId: string; scheduleId: string; name: string; goal?: string; startDate: string; endDate: string; velocityCommitment?: number };
      const sprint = await sprintService.create(body.projectId, body.scheduleId, body, user.userId);
      return { sprint };
    } catch (error) {
      console.error('Create sprint error:', error);
      return reply.status(500).send({ error: 'Failed to create sprint' });
    }
  });

  // GET /project/:projectId — list sprints by project
  fastify.get('/project/:projectId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const sprints = await sprintService.getByProject(projectId);
      return { sprints };
    } catch (error) {
      console.error('Get sprints error:', error);
      return reply.status(500).send({ error: 'Failed to fetch sprints' });
    }
  });

  // GET /:id — get sprint by id
  fastify.get('/:id', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const sprint = await sprintService.getById(id);
      return { sprint };
    } catch (error) {
      console.error('Get sprint error:', error);
      return reply.status(500).send({ error: 'Failed to fetch sprint' });
    }
  });

  // PUT /:id — update sprint
  fastify.put('/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const sprint = await sprintService.update(id, body);
      return { sprint };
    } catch (error) {
      console.error('Update sprint error:', error);
      return reply.status(500).send({ error: 'Failed to update sprint' });
    }
  });

  // DELETE /:id — delete sprint
  fastify.delete('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await sprintService.delete(id);
      return { message: 'Sprint deleted' };
    } catch (error) {
      console.error('Delete sprint error:', error);
      return reply.status(500).send({ error: 'Failed to delete sprint' });
    }
  });

  // POST /:id/tasks — add task to sprint
  fastify.post('/:id/tasks', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { taskId, storyPoints } = request.body as { taskId: string; storyPoints?: number };
      const result = await sprintService.addTask(id, taskId, storyPoints);
      return { result };
    } catch (error) {
      console.error('Add task to sprint error:', error);
      return reply.status(500).send({ error: 'Failed to add task to sprint' });
    }
  });

  // DELETE /:id/tasks/:taskId — remove task from sprint
  fastify.delete('/:id/tasks/:taskId', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, taskId } = request.params as { id: string; taskId: string };
      await sprintService.removeTask(id, taskId);
      return { message: 'Task removed from sprint' };
    } catch (error) {
      console.error('Remove task from sprint error:', error);
      return reply.status(500).send({ error: 'Failed to remove task from sprint' });
    }
  });

  // POST /:id/start — start sprint
  fastify.post('/:id/start', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const sprint = await sprintService.startSprint(id);
      return { sprint };
    } catch (error) {
      console.error('Start sprint error:', error);
      return reply.status(500).send({ error: 'Failed to start sprint' });
    }
  });

  // POST /:id/complete — complete sprint
  fastify.post('/:id/complete', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const sprint = await sprintService.completeSprint(id);
      return { sprint };
    } catch (error) {
      console.error('Complete sprint error:', error);
      return reply.status(500).send({ error: 'Failed to complete sprint' });
    }
  });

  // GET /:id/board — sprint board
  fastify.get('/:id/board', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const board = await sprintService.getSprintBoard(id);
      return { board };
    } catch (error) {
      console.error('Get sprint board error:', error);
      return reply.status(500).send({ error: 'Failed to fetch sprint board' });
    }
  });

  // GET /:id/burndown — sprint burndown
  fastify.get('/:id/burndown', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const burndown = await sprintService.getSprintBurndown(id);
      return { burndown };
    } catch (error) {
      console.error('Get sprint burndown error:', error);
      return reply.status(500).send({ error: 'Failed to fetch sprint burndown' });
    }
  });

  // GET /velocity/:projectId — velocity history
  fastify.get('/velocity/:projectId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const velocity = await sprintService.getVelocityHistory(projectId);
      return { velocity };
    } catch (error) {
      console.error('Get velocity history error:', error);
      return reply.status(500).send({ error: 'Failed to fetch velocity history' });
    }
  });
}
