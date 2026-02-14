import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authMiddleware, requireRole } from '../middleware/auth';
import { UserService } from '../services/UserService';
import { PortfolioService } from '../services/PortfolioService';

const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(['admin', 'pmo_manager', 'portfolio_manager', 'pm']).default('pm'),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'pmo_manager', 'portfolio_manager', 'pm']).optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

const createPortfolioSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const assignUserSchema = z.object({
  userId: z.string().min(1),
});

export async function adminRoutes(fastify: FastifyInstance) {
  const userService = new UserService();
  const portfolioService = new PortfolioService();

  // All admin routes require authentication + admin role
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', requireRole('admin'));

  // ── User Management ─────────────────────────────────────────────────────

  fastify.get('/users', {
    schema: { description: 'List all users', tags: ['admin'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const users = await userService.list();
      return {
        users: users.map(u => ({
          id: u.id, username: u.username, email: u.email,
          fullName: u.fullName, role: u.role, isActive: u.isActive,
          createdAt: u.createdAt,
        })),
      };
    } catch (error) {
      console.error('Admin list users error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/users', {
    schema: { description: 'Create a new user', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createUserSchema.parse(request.body);

      const existing = await userService.findByUsername(data.username);
      if (existing) {
        return reply.status(409).send({ error: 'Username already taken' });
      }

      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await userService.create({
        username: data.username,
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
      });

      return reply.status(201).send({
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role, isActive: user.isActive },
      });
    } catch (error) {
      console.error('Admin create user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/users/:id', {
    schema: { description: 'Update a user', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateUserSchema.parse(request.body);

      const user = await userService.update(id, data);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return {
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role, isActive: user.isActive },
      };
    } catch (error) {
      console.error('Admin update user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── Portfolio Management ────────────────────────────────────────────────

  fastify.get('/portfolios', {
    schema: { description: 'List all portfolios', tags: ['admin'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const portfolios = await portfolioService.findAll();
      return { portfolios };
    } catch (error) {
      console.error('Admin list portfolios error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/portfolios', {
    schema: { description: 'Create a portfolio', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createPortfolioSchema.parse(request.body);
      const userId = (request as any).user.userId;
      const portfolio = await portfolioService.create({ ...data, createdBy: userId });
      return reply.status(201).send({ portfolio });
    } catch (error) {
      console.error('Admin create portfolio error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/portfolios/:id', {
    schema: { description: 'Update a portfolio', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = createPortfolioSchema.partial().parse(request.body);
      const portfolio = await portfolioService.update(id, data);
      if (!portfolio) {
        return reply.status(404).send({ error: 'Portfolio not found' });
      }
      return { portfolio };
    } catch (error) {
      console.error('Admin update portfolio error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/portfolios/:id', {
    schema: { description: 'Deactivate a portfolio', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await portfolioService.deactivate(id);
      return { message: 'Portfolio deactivated' };
    } catch (error) {
      console.error('Admin deactivate portfolio error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── Portfolio Assignments ───────────────────────────────────────────────

  fastify.get('/portfolios/:id/assignments', {
    schema: { description: 'List users assigned to a portfolio', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const assignments = await portfolioService.getAssignments(id);

      // Enrich with user data
      const enriched = await Promise.all(
        assignments.map(async (a) => {
          const user = await userService.findById(a.userId);
          return {
            ...a,
            userName: user?.fullName || 'Unknown',
            userEmail: user?.email || '',
            userRole: user?.role || 'pm',
          };
        }),
      );

      return { assignments: enriched };
    } catch (error) {
      console.error('Admin get assignments error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/portfolios/:id/assignments', {
    schema: { description: 'Assign a user to a portfolio', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = assignUserSchema.parse(request.body);

      // Check user exists
      const user = await userService.findById(userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const assignment = await portfolioService.assignUser(id, userId);
      return reply.status(201).send({ assignment });
    } catch (error: any) {
      // Handle duplicate assignment
      if (error?.code === 'ER_DUP_ENTRY' || error?.message?.includes('Duplicate')) {
        return reply.status(409).send({ error: 'User already assigned to this portfolio' });
      }
      console.error('Admin assign user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/portfolios/:id/assignments/:userId', {
    schema: { description: 'Remove a user from a portfolio', tags: ['admin'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, userId } = request.params as { id: string; userId: string };
      await portfolioService.removeUser(id, userId);
      return { message: 'User removed from portfolio' };
    } catch (error) {
      console.error('Admin remove user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
