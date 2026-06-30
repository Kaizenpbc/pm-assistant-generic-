import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { resourceAvailabilityService } from '../../services/ResourceAvailabilityService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';

const createSchema = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  type: z.enum(['vacation', 'holiday', 'unavailable', 'reduced']),
  hoursAvailable: z.number().min(0).optional(),
  note: z.string().max(500).optional(),
});

const updateSchema = createSchema.partial();

export async function availabilityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // List availability for a resource
  fastify.get('/:resourceId/availability', {
    preHandler: [requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { resourceId } = request.params as { resourceId: string };
    const { from, to } = request.query as { from?: string; to?: string };
    const entries = await resourceAvailabilityService.findByResource(resourceId, from, to);
    return { availability: entries };
  });

  // Create availability entry
  fastify.post('/:resourceId/availability', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { resourceId } = request.params as { resourceId: string };
    const body = createSchema.parse(request.body);
    const entry = await resourceAvailabilityService.create({ resourceId, ...body });
    reply.code(201);
    return { availability: entry };
  });

  // Update availability entry
  fastify.put('/availability/:id', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);
    const entry = await resourceAvailabilityService.update(id, body);
    if (!entry) {
      reply.code(404);
      return { error: 'Availability entry not found' };
    }
    return { availability: entry };
  });

  // Delete availability entry
  fastify.delete('/availability/:id', {
    preHandler: [requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await resourceAvailabilityService.delete(id);
    if (!deleted) {
      reply.code(404);
      return { error: 'Availability entry not found' };
    }
    return { success: true };
  });
}
