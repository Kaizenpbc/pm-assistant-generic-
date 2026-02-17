// C:\Users\gerog\Documents\pm-assistant-generic\src\server\routes\alerts.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProactiveAlertService } from '../services/proactiveAlertService';
import { AIActionExecutor } from '../services/aiActionExecutor';
import { authMiddleware } from '../middleware/auth';

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
    handler: async (request: FastifyRequest, _reply: FastifyReply) => {
      const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };
      const allAlerts = await alertService.generateAlerts();
      const capped = Math.min(Number(limit) || 100, 500);
      const skip = Math.max(Number(offset) || 0, 0);
      const alerts = allAlerts.slice(skip, skip + capped);
      return { alerts, count: alerts.length, total: allAlerts.length, limit: capped, offset: skip };
    },
  });

  // GET /summary — Get alert summary counts
  fastify.get('/summary', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Get alert summary with counts by severity and type',
      tags: ['alerts'],
    },
    handler: async (_request: FastifyRequest, _reply: FastifyReply) => {
      const summary = await alertService.getAlertsSummary();
      return summary;
    },
  });

  // GET /project/:projectId — Get alerts for a specific project
  fastify.get('/project/:projectId', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Get alerts for a specific project',
      tags: ['alerts'],
    },
    handler: async (request: FastifyRequest, _reply: FastifyReply) => {
      const { projectId } = request.params as any;
      const alerts = await alertService.getAlertsByProject(projectId);
      return { alerts, count: alerts.length };
    },
  });

  // POST /execute-action — Execute a suggested action from an alert
  fastify.post('/execute-action', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Execute a suggested action from a proactive alert',
      tags: ['alerts'],
      body: {
        type: 'object',
        required: ['toolName', 'params'],
        properties: {
          toolName: { type: 'string' },
          params: { type: 'object' },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { toolName, params } = request.body as any;
        const user = request.user;

        const result = await actionExecutor.execute(toolName, params, {
          userId: user.userId,
          userRole: user.role,
        });

        return result;
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Alert action execution failed');
        return reply.code(500).send({
          error: 'Failed to execute action',
          message: 'An unexpected error occurred',
        });
      }
    },
  });
}
