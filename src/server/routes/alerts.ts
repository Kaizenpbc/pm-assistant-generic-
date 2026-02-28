// C:\Users\gerog\Documents\pm-assistant-generic\src\server\routes\alerts.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProactiveAlertService } from '../services/proactiveAlertService';
import { AIActionExecutor } from '../services/aiActionExecutor';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function alertRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const alertService = new ProactiveAlertService();
  const actionExecutor = new AIActionExecutor();

  // GET / — Get all proactive alerts
  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: {
      description: 'Get all proactive alerts across projects',
      tags: ['alerts'],
    },
    handler: async (_request: FastifyRequest, _reply: FastifyReply) => {
      const alerts = await alertService.generateAlerts();
      return { alerts, count: alerts.length };
    },
  });

  // GET /summary — Get alert summary counts
  fastify.get('/summary', {
    preHandler: [requireScope('read')],
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
    preHandler: [requireScope('read')],
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
    preHandler: [requireScope('write')],
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
        const user = (request as any).user;

        const result = await actionExecutor.execute(toolName, params, {
          userId: user.userId,
          userRole: user.role || 'member',
        });

        return result;
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Alert action execution failed');
        return reply.code(500).send({
          error: 'Failed to execute action',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}
