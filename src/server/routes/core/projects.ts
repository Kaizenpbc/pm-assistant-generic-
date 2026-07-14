import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { projectService } from '../../services/ProjectService';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { requireProjectAccess } from '../../middleware/requireProjectAccess';
import { webhookService } from '../../services/WebhookService';
import { auditLedgerService } from '../../services/AuditLedgerService';
import { toProjectDTO, paginate } from '../../dto/responses';
import { parsePagination } from '../../schemas/paginationSchema';
import logger from '../../utils/logger';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  projectType: z.enum(['it', 'construction', 'infrastructure', 'roads', 'other']).default('other'),
  methodology: z.enum(['waterfall', 'agile', 'hybrid']).default('waterfall'),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  budgetAllocated: z.number().positive().optional(),
  currency: z.string().default('USD'),
  location: z.string().optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLon: z.number().min(-180).max(180).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

const statusUpdateSchema = z.object({
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
  cancellationReason: z.string().max(2000).optional(),
});

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/', {
    preHandler: [requireScope('read')],
    schema: { description: 'Get all projects', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const { limit, offset } = parsePagination(request.query as Record<string, unknown>);
      const { scope } = request.query as { scope?: string };
      const globalRoles = ['admin', 'executive', 'pmo'];
      const { rows, total } = globalRoles.includes(user.role)
        ? await projectService.findAllPaginated(limit, offset)
        : await projectService.findByUserIdPaginated(user.userId, limit, offset);
      const page = Math.floor(offset / limit) + 1;
      return paginate(rows.map(toProjectDTO), total, page, limit);
    } catch (error) {
      logger.error('Get projects error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch projects' });
    }
  });

  fastify.get('/:id', {
    preHandler: [requireScope('read'), requireProjectAccess('viewer')],
    schema: { description: 'Get project by ID', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const project = await projectService.findById(id);
      if (!project) {
        return reply.status(404).send({ error: 'Not found', message: 'The requested resource was not found' });
      }
      return { project: toProjectDTO(project) };
    } catch (error) {
      logger.error('Get project error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch project' });
    }
  });

  fastify.post('/', {
    preHandler: [requireScope('write')],
    schema: { description: 'Create a new project', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createProjectSchema.parse(request.body);
      const userId = request.user!.userId;
      const project = await projectService.create({
        ...data,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        userId,
      });
      webhookService.dispatch('project.created', { project }, userId);
      return reply.status(201).send({ project: toProjectDTO(project) });
    } catch (error) {
      logger.error('Create project error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create project' });
    }
  });

  fastify.put('/:id', {
    preHandler: [requireScope('write'), requireProjectAccess('manager')],
    schema: { description: 'Update a project', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateProjectSchema.parse(request.body);
      const userId = request.user!.userId;
      const project = await projectService.update(id, {
        ...data,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      }, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found', message: 'Project does not exist or you do not have access' });
      }
      webhookService.dispatch('project.updated', { project }, userId);
      return { project: toProjectDTO(project) };
    } catch (error) {
      logger.error('Update project error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update project' });
    }
  });

  fastify.patch('/:id/status', {
    preHandler: [requireScope('write'), requireProjectAccess('manager')],
    schema: { description: 'Update project status', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const { status, cancellationReason } = statusUpdateSchema.parse(request.body);

      if (status === 'cancelled' && !cancellationReason?.trim()) {
        return reply.status(400).send({ error: 'Validation error', message: 'A cancellation reason is required when cancelling a project' });
      }

      const project = await projectService.update(id, { status }, user.userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found', message: 'Project does not exist or you do not have access' });
      }

      if (status === 'cancelled' && cancellationReason) {
        auditLedgerService.append({
          actorId: user.userId,
          actorType: 'user',
          action: 'project.cancelled',
          entityType: 'project',
          entityId: id,
          projectId: id,
          payload: { reason: cancellationReason.trim() },
          source: 'web',
        }).catch(() => {});
      }

      webhookService.dispatch('project.updated', { project }, user.userId);
      return { project };
    } catch (error) {
      logger.error('Update project status error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update project status' });
    }
  });

  fastify.delete('/:id', {
    preHandler: [requireScope('admin'), requireProjectAccess('owner')],
    schema: { description: 'Delete a project', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user!.userId;
      const deleted = await projectService.delete(id, userId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Project not found', message: 'Project does not exist or you do not have access' });
      }
      return { message: 'Project deleted successfully' };
    } catch (error) {
      logger.error('Delete project error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete project' });
    }
  });
}
