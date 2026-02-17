import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ProjectService } from '../services/ProjectService';
import { authMiddleware } from '../middleware/auth';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  projectType: z.enum(['it', 'construction', 'infrastructure', 'roads', 'other']).default('other'),
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

export async function projectRoutes(fastify: FastifyInstance) {
  const projectService = new ProjectService();

  fastify.get('/', {
    preHandler: [authMiddleware],
    schema: { description: 'Get all projects', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.userId;
      const projects = await projectService.findByUserId(userId);
      return { projects };
    } catch (error) {
      console.error('Get projects error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch projects' });
    }
  });

  fastify.get('/:id', {
    preHandler: [authMiddleware],
    schema: { description: 'Get project by ID', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user.userId;
      const project = await projectService.findById(id, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found', message: 'Project does not exist or you do not have access' });
      }
      return { project };
    } catch (error) {
      console.error('Get project error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to fetch project' });
    }
  });

  fastify.post('/', {
    preHandler: [authMiddleware],
    schema: { description: 'Create a new project', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createProjectSchema.parse(request.body);
      const userId = (request as any).user.userId;
      const project = await projectService.create({
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        userId,
      });
      return reply.status(201).send({ project });
    } catch (error) {
      console.error('Create project error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create project' });
    }
  });

  fastify.put('/:id', {
    preHandler: [authMiddleware],
    schema: { description: 'Update a project', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateProjectSchema.parse(request.body);
      const userId = (request as any).user.userId;
      const project = await projectService.update(id, {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      }, userId);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found', message: 'Project does not exist or you do not have access' });
      }
      return { project };
    } catch (error) {
      console.error('Update project error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update project' });
    }
  });

  fastify.delete('/:id', {
    preHandler: [authMiddleware],
    schema: { description: 'Delete a project', tags: ['projects'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user.userId;
      const deleted = await projectService.delete(id, userId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Project not found', message: 'Project does not exist or you do not have access' });
      }
      return { message: 'Project deleted successfully' };
    } catch (error) {
      console.error('Delete project error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete project' });
    }
  });
}
