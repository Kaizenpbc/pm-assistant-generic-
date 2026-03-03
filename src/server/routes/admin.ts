import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { databaseService } from '../database/connection';
import { userService } from '../services/UserService';

const statusSchema = z.object({
  active: z.boolean(),
});

function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (!user || user.role !== 'admin') {
    reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    return false;
  }
  return true;
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/v1/admin/users
  fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const rows = await databaseService.query<any>(
        `SELECT
          u.id, u.username, u.email, u.full_name, u.role, u.is_active,
          u.created_at, u.last_login_at, u.subscription_tier,
          COUNT(DISTINCT p.id) AS project_count
        FROM users u
        LEFT JOIN projects p ON p.created_by = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC`
      );
      return { users: rows };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /api/v1/admin/users/:id/status
  fastify.patch('/users/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const requestingUser = (request as any).user;
    const { id } = request.params as { id: string };

    if (id === requestingUser.userId) {
      return reply.status(400).send({ error: 'Bad request', message: 'Cannot deactivate your own account' });
    }

    const result = statusSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Bad request', message: 'active (boolean) required' });
    }

    try {
      const updated = await userService.update(id, { isActive: result.data.active });
      if (!updated) {
        return reply.status(404).send({ error: 'Not found', message: 'User not found' });
      }
      return { message: 'User status updated', isActive: updated.isActive };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/admin/users/:id/reset-password
  fastify.post('/users/:id/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };

    try {
      const user = await userService.findById(id);
      if (!user) {
        return reply.status(404).send({ error: 'Not found', message: 'User not found' });
      }

      const resetToken = crypto.randomUUID();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await userService.update(id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      });

      return { message: 'Password reset token generated', resetToken };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/admin/stats
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const rows = await databaseService.query<any>(
        `SELECT
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM users WHERE is_active = 1) AS active_users,
          (SELECT COUNT(*) FROM projects) AS total_projects,
          (SELECT COUNT(*) FROM ai_usage_log) AS total_ai_calls,
          (SELECT COALESCE(SUM(cost_estimate), 0) FROM ai_usage_log) AS total_ai_cost,
          (SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM ai_usage_log) AS total_tokens`
      );
      return { stats: rows[0] };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/admin/ai-usage
  fastify.get('/ai-usage', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const rows = await databaseService.query<any>(
        `SELECT
          u.username, u.email, u.full_name,
          COUNT(a.id) AS call_count,
          COALESCE(SUM(a.input_tokens + a.output_tokens), 0) AS total_tokens,
          COALESCE(SUM(a.cost_estimate), 0) AS total_cost,
          MAX(a.created_at) AS last_used
        FROM users u
        LEFT JOIN ai_usage_log a ON a.user_id = u.id
        GROUP BY u.id
        ORDER BY total_cost DESC`
      );
      return { usage: rows };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
