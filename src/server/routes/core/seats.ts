import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { seatService } from '../../services/SeatService';
import { organizationRepository } from '../../database/OrganizationRepository';
import logger from '../../utils/logger';

const seatCountSchema = z.object({
  count: z.number().int().min(1).max(50),
});

export async function seatRoutes(fastify: FastifyInstance) {
  // GET /api/v1/seats — get seat info for caller's org
  fastify.get('/', {
    preHandler: [authMiddleware, requireScope('read')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const org = await organizationRepository.findByUserId(request.user!.userId);
    if (!org) {
      return reply.status(404).send({ error: 'No organization found' });
    }
    const seatInfo = await seatService.getOrgSeatInfo(org.id);
    return seatInfo;
  });

  // POST /api/v1/seats/add — add seats (org owner/admin only)
  fastify.post('/add', {
    preHandler: [authMiddleware, requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { count } = seatCountSchema.parse(request.body);
      const org = await organizationRepository.findByUserId(request.user!.userId);
      if (!org) {
        return reply.status(404).send({ error: 'No organization found' });
      }
      if (org.ownerUserId !== request.user!.userId && request.user!.role !== 'admin') {
        return reply.status(403).send({ error: 'Only the org owner or admin can manage seats' });
      }
      const result = await seatService.addSeats(org.id, count);
      return result;
    } catch (error: any) {
      if (error.statusCode) throw error;
      logger.error('Add seats error', { error });
      return reply.status(500).send({ error: 'Failed to add seats' });
    }
  });

  // POST /api/v1/seats/remove — remove seats (org owner/admin only)
  fastify.post('/remove', {
    preHandler: [authMiddleware, requireScope('write')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { count } = seatCountSchema.parse(request.body);
      const org = await organizationRepository.findByUserId(request.user!.userId);
      if (!org) {
        return reply.status(404).send({ error: 'No organization found' });
      }
      if (org.ownerUserId !== request.user!.userId && request.user!.role !== 'admin') {
        return reply.status(403).send({ error: 'Only the org owner or admin can manage seats' });
      }
      const result = await seatService.removeSeats(org.id, count);
      return result;
    } catch (error: any) {
      if (error.statusCode) throw error;
      logger.error('Remove seats error', { error });
      return reply.status(500).send({ error: 'Failed to remove seats' });
    }
  });
}
