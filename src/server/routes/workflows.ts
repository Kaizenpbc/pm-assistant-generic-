import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WorkflowService } from '../services/WorkflowService';

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
    schema: { description: 'Get all workflow rules', tags: ['workflows'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rules = workflowService.findAll();
      return { rules };
    } catch (error) {
      console.error('Get workflows error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/workflows/executions
  fastify.get('/executions', {
    schema: { description: 'Get workflow execution history', tags: ['workflows'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const executions = workflowService.getExecutions();
      return { executions };
    } catch (error) {
      console.error('Get executions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/workflows
  fastify.post('/', {
    schema: { description: 'Create a workflow rule', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createRuleSchema.parse(request.body);
      const rule = workflowService.create(data);
      return reply.status(201).send({ rule });
    } catch (error) {
      console.error('Create workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/v1/workflows/:id
  fastify.put('/:id', {
    schema: { description: 'Update a workflow rule', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = createRuleSchema.partial().parse(request.body);
      const rule = workflowService.update(id, data);
      if (!rule) return reply.status(404).send({ error: 'Workflow rule not found' });
      return { rule };
    } catch (error) {
      console.error('Update workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/workflows/:id
  fastify.delete('/:id', {
    schema: { description: 'Delete a workflow rule', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = workflowService.delete(id);
      if (!deleted) return reply.status(404).send({ error: 'Workflow rule not found' });
      return { message: 'Workflow rule deleted' };
    } catch (error) {
      console.error('Delete workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
