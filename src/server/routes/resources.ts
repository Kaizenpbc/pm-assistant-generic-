import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ResourceService } from '../services/ResourceService';

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

  // GET /resources - List all resources
  fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const resources = await service.findAllResources();
    return { resources };
  });

  // POST /resources - Create a resource
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createResourceSchema.parse(request.body);
      const resource = await service.createResource(data);
      return reply.status(201).send({ resource });
    } catch (error) {
      console.error('Create resource error:', error);
      return reply.status(400).send({ error: 'Invalid resource data' });
    }
  });

  // PUT /resources/:id - Update a resource
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = createResourceSchema.partial().parse(request.body);
      const resource = await service.updateResource(id, data);
      if (!resource) return reply.status(404).send({ error: 'Resource not found' });
      return { resource };
    } catch (error) {
      console.error('Update resource error:', error);
      return reply.status(400).send({ error: 'Invalid resource data' });
    }
  });

  // DELETE /resources/:id
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await service.deleteResource(id);
    if (!deleted) return reply.status(404).send({ error: 'Resource not found' });
    return { message: 'Resource deleted' };
  });

  // GET /resources/assignments/:scheduleId
  fastify.get('/assignments/:scheduleId', async (request: FastifyRequest, _reply: FastifyReply) => {
    const { scheduleId } = request.params as { scheduleId: string };
    const assignments = await service.findAssignmentsBySchedule(scheduleId);
    return { assignments };
  });

  // POST /resources/assignments
  fastify.post('/assignments', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createAssignmentSchema.parse(request.body);
      const assignment = await service.createAssignment(data);
      return reply.status(201).send({ assignment });
    } catch (error) {
      console.error('Create assignment error:', error);
      return reply.status(400).send({ error: 'Invalid assignment data' });
    }
  });

  // DELETE /resources/assignments/:id
  fastify.delete('/assignments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await service.deleteAssignment(id);
    if (!deleted) return reply.status(404).send({ error: 'Assignment not found' });
    return { message: 'Assignment deleted' };
  });

  // GET /resources/workload/:projectId
  fastify.get('/workload/:projectId', async (request: FastifyRequest, _reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const workload = await service.computeWorkload(projectId);
    return { workload };
  });
}
