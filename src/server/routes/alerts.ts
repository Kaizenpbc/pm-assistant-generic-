// C:\Users\gerog\Documents\pm-assistant-generic\src\server\routes\alerts.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { ProactiveAlertService } from '../services/proactiveAlertService';
import { AIActionExecutor } from '../services/aiActionExecutor';
import { projectIdParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

const alertQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

const executeActionSchema = z.object({
  toolName: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
});

export async function alertRoutes(fastify: FastifyInstance) {
  const alertService = new ProactiveAlertService();
  const actionExecutor = new AIActionExecutor();

  // GET / — Get all proactive alerts
  fastify.get('/', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Get all proactive alerts across projects',
      tags: ['alerts'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit, offset } = alertQuerySchema.parse(request.query);
        const userId = request.user.userId;
        const allAlerts = await alertService.generateAlerts(userId);
        const alerts = allAlerts.slice(offset, offset + limit);
        return { alerts, count: alerts.length, total: allAlerts.length, limit, offset };
      } catch (error) {
        if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        request.log.error({ err: error }, 'Get alerts error');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  });

  // GET /summary — Get alert summary counts
  fastify.get('/summary', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Get alert summary with counts by severity and type',
      tags: ['alerts'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user.userId;
        const summary = await alertService.getAlertsSummary(userId);
        return summary;
      } catch (error) {
        if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error }, 'Get alert summary error');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  });

  // GET /project/:projectId — Get alerts for a specific project
  fastify.get('/project/:projectId', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Get alerts for a specific project',
      tags: ['alerts'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = projectIdParam.parse(request.params);
        const project = await verifyProjectAccess(projectId, request.user.userId);
        if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });
        const alerts = await alertService.getAlertsByProject(projectId, request.user.userId);
        return { alerts, count: alerts.length };
      } catch (error) {
        if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        request.log.error({ err: error }, 'Get project alerts error');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  });

  // POST /execute-action — Execute a suggested action from an alert
  fastify.post('/execute-action', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Execute a suggested action from a proactive alert',
      tags: ['alerts'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { toolName, params } = executeActionSchema.parse(request.body);
        const user = request.user;

        const result = await actionExecutor.execute(toolName, params, {
          userId: user.userId,
          userRole: user.role,
        });

        return result;
      } catch (error) {
        if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Alert action execution failed');
        return reply.code(500).send({
          error: 'Failed to execute action',
          message: 'An unexpected error occurred',
        });
      }
    },
  });
}
