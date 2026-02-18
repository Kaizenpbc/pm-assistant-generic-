import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { TemplateService } from '../services/TemplateService';
import { createFromTemplateSchema, saveAsTemplateSchema } from '../schemas/templateSchemas';
import { idParam } from '../schemas/commonSchemas';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

const templateQuerySchema = z.object({
  projectType: z.string().min(1).max(50).optional(),
  category: z.string().min(1).max(100).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000),
  projectType: z.enum(['it', 'construction', 'infrastructure', 'roads', 'other']),
  category: z.string().max(100),
  estimatedDurationDays: z.number().positive(),
  tasks: z.array(z.object({
    refId: z.string().max(100),
    name: z.string().max(500),
    description: z.string().max(2000).default(''),
    estimatedDays: z.number().min(1),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    parentRefId: z.string().max(100).nullable().default(null),
    dependencyRefId: z.string().max(100).nullable().default(null),
    dependencyType: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
    offsetDays: z.number().default(0),
    skills: z.array(z.string().max(100)).max(20).default([]),
    isSummary: z.boolean().default(false),
    mandatory: z.boolean().optional(),
  })).max(500),
  tags: z.array(z.string().max(100)).max(50).default([]),
});

export async function templateRoutes(fastify: FastifyInstance) {
  const templateService = new TemplateService();

  // GET / — List all templates (with optional filters)
  fastify.get('/', {
    preHandler: [authMiddleware],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectType, category } = templateQuerySchema.parse(request.query);
      const templates = await templateService.findAll(projectType, category);
      // Return without full task arrays for listing
      const summaries = templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        projectType: t.projectType,
        category: t.category,
        isBuiltIn: t.isBuiltIn,
        estimatedDurationDays: t.estimatedDurationDays,
        taskCount: t.tasks.length,
        phaseCount: t.tasks.filter(task => task.isSummary).length,
        tags: t.tags,
        usageCount: t.usageCount,
      }));
      return { templates: summaries };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'List templates error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch templates' });
    }
  });

  // GET /:id — Get template with full task tree
  fastify.get('/:id', {
    preHandler: [authMiddleware],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const template = await templateService.findById(id);
      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }
      return { template };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Get template error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch template' });
    }
  });

  // POST / — Create custom template
  fastify.post('/', {
    preHandler: [authMiddleware],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createTemplateSchema.parse(request.body);
      const userId = request.user.userId;
      const template = await templateService.create({
        ...data,
        isBuiltIn: false,
        createdBy: userId,
      });
      return reply.status(201).send({ template });
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Create template error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create template' });
    }
  });

  // PUT /:id — Update custom template
  fastify.put('/:id', {
    preHandler: [authMiddleware],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const data = createTemplateSchema.partial().parse(request.body);
      const userId = request.user.userId;

      // Ownership check: only the creator can update a custom template
      const existing = await templateService.findById(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Template not found' });
      }
      if (existing.isBuiltIn) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Built-in templates cannot be modified' });
      }
      if (existing.createdBy !== userId) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this template' });
      }

      const template = await templateService.update(id, data);
      if (!template) {
        return reply.status(404).send({ error: 'Template not found or is built-in' });
      }
      return { template };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Update template error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update template' });
    }
  });

  // DELETE /:id — Delete custom template
  fastify.delete('/:id', {
    preHandler: [authMiddleware],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = idParam.parse(request.params);
      const userId = request.user.userId;

      // Ownership check: only the creator can delete a custom template
      const existing = await templateService.findById(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Template not found' });
      }
      if (existing.isBuiltIn) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Built-in templates cannot be deleted' });
      }
      if (existing.createdBy !== userId) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this template' });
      }

      const deleted = await templateService.delete(id);
      if (!deleted) {
        return reply.status(404).send({ error: 'Template not found or is built-in' });
      }
      return { message: 'Template deleted successfully' };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Delete template error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete template' });
    }
  });

  // POST /apply — Apply template to create new project
  fastify.post('/apply', {
    preHandler: [authMiddleware],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createFromTemplateSchema.parse(request.body);
      const userId = request.user.userId;
      const result = await templateService.applyTemplate({
        ...data,
        userId,
        selectedTaskRefIds: data.selectedTaskRefIds,
      });
      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Apply template error');
      if (error instanceof Error && error.message === 'Template not found') {
        return reply.status(404).send({ error: 'Template not found' });
      }
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to apply template' });
    }
  });

  // POST /save-from-project — Save existing project as template
  fastify.post('/save-from-project', {
    preHandler: [authMiddleware],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = saveAsTemplateSchema.parse(request.body);
      const userId = request.user.userId;
      const project = await verifyProjectAccess(data.projectId, userId);
      if (!project) return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
      const template = await templateService.saveFromProject({
        ...data,
        templateName: data.templateName,
        userId,
      });
      return reply.status(201).send({ template });
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Save as template error');
      if (error instanceof Error && error.message === 'Project not found') {
        return reply.status(404).send({ error: 'Project not found' });
      }
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to save as template' });
    }
  });
}
