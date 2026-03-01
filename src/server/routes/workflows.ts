import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dagWorkflowService } from '../services/DagWorkflowService';
import { ScheduleService } from '../services/ScheduleService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

// ── Zod schemas ────────────────────────────────────────────────────────────

const nodeSchema = z.object({
  nodeType: z.enum(['trigger', 'condition', 'action', 'approval', 'delay', 'agent']),
  name: z.string().min(1),
  config: z.record(z.string(), z.any()),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

const edgeSchema = z.object({
  sourceIndex: z.number().int().min(0),
  targetIndex: z.number().int().min(0),
  conditionExpr: z.record(z.string(), z.any()).optional(),
  label: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const createDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  projectId: z.string().optional().nullable(),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema),
});

const updateDefinitionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  projectId: z.string().optional().nullable(),
  nodes: z.array(nodeSchema).optional(),
  edges: z.array(edgeSchema).optional(),
});

const triggerSchema = z.object({
  entityType: z.string().default('task'),
  entityId: z.string().min(1),
});

const resumeSchema = z.object({
  nodeId: z.string().min(1),
  result: z.record(z.string(), z.any()).default({}),
});

// ── Routes ─────────────────────────────────────────────────────────────────

export async function workflowRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  const scheduleService = new ScheduleService();

  // GET /api/v1/workflows — list definitions
  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: { description: 'List workflow definitions', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.query as { projectId?: string };
      const definitions = await dagWorkflowService.listDefinitions(projectId);
      return { definitions };
    } catch (error) {
      console.error('List workflows error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/workflows/:id — get definition with nodes + edges
  fastify.get('/:id', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get workflow definition with graph', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const definition = await dagWorkflowService.getDefinition(id);
      if (!definition) return reply.status(404).send({ error: 'Workflow not found' });
      return { definition };
    } catch (error) {
      console.error('Get workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/workflows — create definition
  fastify.post('/', {
    preHandler: [requireScope('write')],
    schema: { description: 'Create a workflow definition', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const data = createDefinitionSchema.parse(request.body);
      const definition = await dagWorkflowService.createDefinition({
        ...data,
        createdBy: user.userId,
      });
      return reply.status(201).send({ definition });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      console.error('Create workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/v1/workflows/:id — update definition
  fastify.put('/:id', {
    preHandler: [requireScope('write')],
    schema: { description: 'Update a workflow definition', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateDefinitionSchema.parse(request.body);
      const definition = await dagWorkflowService.updateDefinition(id, data);
      if (!definition) return reply.status(404).send({ error: 'Workflow not found' });
      return { definition };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      console.error('Update workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/workflows/:id — delete definition
  fastify.delete('/:id', {
    preHandler: [requireScope('admin')],
    schema: { description: 'Delete a workflow definition', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await dagWorkflowService.deleteDefinition(id);
      if (!deleted) return reply.status(404).send({ error: 'Workflow not found' });
      return { message: 'Workflow deleted' };
    } catch (error) {
      console.error('Delete workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /api/v1/workflows/:id/toggle — enable/disable
  fastify.patch('/:id/toggle', {
    preHandler: [requireScope('write')],
    schema: { description: 'Toggle workflow enabled/disabled', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { enabled } = (request.body as { enabled: boolean }) || {};
      if (typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'enabled (boolean) is required' });
      }
      const definition = await dagWorkflowService.toggleEnabled(id, enabled);
      if (!definition) return reply.status(404).send({ error: 'Workflow not found' });
      return { definition };
    } catch (error) {
      console.error('Toggle workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/workflows/:id/trigger — manual trigger
  fastify.post('/:id/trigger', {
    preHandler: [requireScope('write')],
    schema: { description: 'Manually trigger a workflow', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = triggerSchema.parse(request.body);
      const execution = await dagWorkflowService.triggerManual(id, data.entityType, data.entityId, scheduleService);
      if (!execution) return reply.status(404).send({ error: 'Workflow not found or no trigger node' });
      return reply.status(201).send({ execution });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      console.error('Trigger workflow error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/workflows/executions — list executions
  fastify.get('/executions', {
    preHandler: [requireScope('read')],
    schema: { description: 'List workflow executions', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workflowId, entityType, entityId, status, limit } = request.query as Record<string, string>;
      const executions = await dagWorkflowService.listExecutions({
        workflowId, entityType, entityId, status,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      return { executions };
    } catch (error) {
      console.error('List executions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/workflows/executions/:id — get execution detail
  fastify.get('/executions/:id', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get workflow execution details', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const execution = await dagWorkflowService.getExecution(id);
      if (!execution) return reply.status(404).send({ error: 'Execution not found' });
      return { execution };
    } catch (error) {
      console.error('Get execution error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/workflows/executions/:id/resume — resume waiting execution
  fastify.post('/executions/:id/resume', {
    preHandler: [requireScope('write')],
    schema: { description: 'Resume a waiting workflow execution', tags: ['workflows'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = resumeSchema.parse(request.body);
      const execution = await dagWorkflowService.resumeExecution(id, data.nodeId, data.result, scheduleService);
      if (!execution) return reply.status(404).send({ error: 'Execution not found or not in waiting state' });
      return { execution };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      console.error('Resume execution error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
