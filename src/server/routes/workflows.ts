import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WorkflowService } from '../services/WorkflowService';
import { idParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';

const triggerSchema = z.object({
  type: z.enum(['status_change', 'date_passed', 'progress_threshold']),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  progressThreshold: z.number().min(0).max(100).optional(),
  progressDirection: z.enum(['above', 'below']).optional(),
});

const actionSchema = z.object({
  type: z.enum(['update_field', 'log_activity', 'send_notification']),
  field: z.string().optional(),
  value: z.string().optional(),
  message: z.string().optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  trigger: triggerSchema,
  action: actionSchema,
});

export async function workflowRoutes(fastify: FastifyInstance) {
  const workflowService = new WorkflowService();

  // GET /api/v1/workflows
  fastify.get('/', {
    preHandler: [authMiddleware],
    schema: { description: 'Get all workflow rules', tags: ['workflows'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rules = workflowService.findAll();
      return { rules };
    } catch (error) {
      fastify.log.error({ err: error }, 'Get workflows error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/workflows/executions
  fastify.get('/executions', {
    preHandler: [authMiddleware],
    schema: { description: 'Get workflow execution history', tags: ['workflows'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const executions = workflowService.getExecutions();
      return { executions };
    } catch (error) {
      fastify.log.error({ err: error }, 'Get executions error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/workflows
  fastify.post('/', {
    preHandler: [authMiddleware],
    schema: { description: 'Create a workflow rule', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createRuleSchema.parse(request.body);
      const rule = workflowService.create(data);
      return reply.status(201).send({ rule });
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Create workflow error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/v1/workflows/:id
  fastify.put('/:id', {
    preHandler: [authMiddleware],
    schema: { description: 'Update a workflow rule', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const data = createRuleSchema.partial().parse(request.body);
      const rule = workflowService.update(id, data);
      if (!rule) return reply.status(404).send({ error: 'Workflow rule not found' });
      return { rule };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Update workflow error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/workflows/:id
  fastify.delete('/:id', {
    preHandler: [authMiddleware],
    schema: { description: 'Delete a workflow rule', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const deleted = workflowService.delete(id);
      if (!deleted) return reply.status(404).send({ error: 'Workflow rule not found' });
      return { message: 'Workflow rule deleted' };
    } catch (error) {
      if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Delete workflow error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
