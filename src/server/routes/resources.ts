import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ResourceService } from '../services/ResourceService';
import { idParam, projectIdParam, scheduleIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';

const createResourceSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email(),
  capacityHoursPerWeek: z.number().positive().default(40),
  skills: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const createAssignmentSchema = z.object({
  resourceId: z.string().min(1),
  taskId: z.string().min(1),
  scheduleId: z.string().min(1),
  hoursPerWeek: z.number().positive(),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

export async function resourceRoutes(fastify: FastifyInstance) {
  const service = new ResourceService();

  // GET /resources - List all resources (with optional pagination)
  fastify.get('/', { preHandler: [authMiddleware] }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
    const all = await service.findAllResources();
    const capped = Math.min(Number(limit) || 100, 500);
    const skip = Math.max(Number(offset) || 0, 0);
    const resources = all.slice(skip, skip + capped);
    return { resources, total: all.length, limit: capped, offset: skip };
  });

  // POST /resources - Create a resource
  fastify.post('/', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createResourceSchema.parse(request.body);
      const resource = await service.createResource(data);
      return reply.status(201).send({ resource });
    } catch (error) {
      request.log.error({ err: error }, 'Create resource error');
      return reply.status(400).send({ error: 'Invalid resource data' });
    }
  });

  // PUT /resources/:id - Update a resource
  fastify.put('/:id', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const data = createResourceSchema.partial().parse(request.body);
      const resource = await service.updateResource(id, data);
      if (!resource) return reply.status(404).send({ error: 'Resource not found' });
      return { resource };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Update resource error');
      return reply.status(400).send({ error: 'Invalid resource data' });
    }
  });

  // DELETE /resources/:id
  fastify.delete('/:id', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const deleted = await service.deleteResource(id);
      if (!deleted) return reply.status(404).send({ error: 'Resource not found' });
      return { message: 'Resource deleted' };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Delete resource error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /resources/assignments/:scheduleId
  fastify.get('/assignments/:scheduleId', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = scheduleIdParam.parse(request.params);
      const assignments = await service.findAssignmentsBySchedule(scheduleId);
      return { assignments };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Get assignments error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /resources/assignments
  fastify.post('/assignments', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createAssignmentSchema.parse(request.body);
      const assignment = await service.createAssignment(data);
      return reply.status(201).send({ assignment });
    } catch (error) {
      request.log.error({ err: error }, 'Create assignment error');
      return reply.status(400).send({ error: 'Invalid assignment data' });
    }
  });

  // DELETE /resources/assignments/:id
  fastify.delete('/assignments/:id', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const deleted = await service.deleteAssignment(id);
      if (!deleted) return reply.status(404).send({ error: 'Assignment not found' });
      return { message: 'Assignment deleted' };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Delete assignment error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /resources/workload/:projectId
  fastify.get('/workload/:projectId', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = projectIdParam.parse(request.params);
      const workload = await service.computeWorkload(projectId);
      return { workload };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Compute workload error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
