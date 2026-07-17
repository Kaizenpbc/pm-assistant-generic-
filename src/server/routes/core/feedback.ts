import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { databaseService } from '../../database/connection';
import { emailService } from '../../services/EmailService';
import { rateLimiter } from '../../middleware/rateLimiter';
import logger from '../../utils/logger';

const submitFeedbackSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  scheduleRating: z.number().int().min(1).max(5).nullable().optional(),
  raidRating: z.number().int().min(1).max(5).nullable().optional(),
  aiRating: z.number().int().min(1).max(5).nullable().optional(),
  reportingRating: z.number().int().min(1).max(5).nullable().optional(),
  category: z.enum(['bug', 'feature_request', 'general']).default('general'),
  comment: z.string().max(5000).optional(),
});

const updateFeedbackSchema = z.object({
  status: z.enum(['new', 'reviewed', 'resolved']).optional(),
  adminNotes: z.string().max(5000).optional(),
});

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST / — Submit feedback
  fastify.post('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.userId;

      // Rate limit: 3 feedback submissions per hour
      const rl = rateLimiter.check(`feedback:${userId}`, 3, 3600_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many submissions. Please try again later.' });
      }

      const body = submitFeedbackSchema.parse(request.body);
      const id = uuidv4();

      await databaseService.query(
        `INSERT INTO feedback (id, user_id, overall_rating, schedule_rating, raid_rating, ai_rating, reporting_rating, category, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, body.overallRating, body.scheduleRating ?? null, body.raidRating ?? null, body.aiRating ?? null, body.reportingRating ?? null, body.category, body.comment ?? null],
      );

      // Notify admin via email (fire-and-forget)
      const alertEmail = process.env.ALERT_EMAIL;
      if (alertEmail) {
        const commentSnippet = body.comment ? body.comment.slice(0, 200) : '(no comment)';
        emailService.sendNotificationEmail(
          alertEmail,
          `New Feedback (${body.overallRating}/5 stars)`,
          'User Feedback Received',
          `Overall: ${body.overallRating}/5 | Category: ${body.category}\n${commentSnippet}`,
          `${process.env.APP_URL || 'https://pm.kpbc.ca'}/admin/feedback`,
          'View Feedback',
        ).catch(err => logger.warn('Failed to send feedback notification email', { error: err }));
      }

      return reply.status(201).send({ id, message: 'Thank you for your feedback!' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      logger.error('Submit feedback error', { error });
      return reply.status(500).send({ error: 'Failed to submit feedback' });
    }
  });

  // GET / — List all feedback (admin only)
  fastify.get('/', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, limit = '50', offset = '0' } = request.query as { status?: string; limit?: string; offset?: string };

      let sql = `SELECT f.*, u.username, u.full_name, u.email as user_email
                 FROM feedback f
                 LEFT JOIN users u ON f.user_id = u.id`;
      const params: any[] = [];

      if (status) {
        sql += ' WHERE f.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const rows = await databaseService.query(sql, params);

      // Get aggregate stats
      const statsRows = await databaseService.query(
        `SELECT
           COUNT(*) as total,
           ROUND(AVG(overall_rating), 1) as avg_overall,
           ROUND(AVG(schedule_rating), 1) as avg_schedule,
           ROUND(AVG(raid_rating), 1) as avg_raid,
           ROUND(AVG(ai_rating), 1) as avg_ai,
           ROUND(AVG(reporting_rating), 1) as avg_reporting,
           SUM(status = 'new') as new_count,
           SUM(status = 'reviewed') as reviewed_count,
           SUM(status = 'resolved') as resolved_count
         FROM feedback`,
      );

      return {
        feedback: (rows as any[]).map(r => ({
          id: r.id,
          userId: r.user_id,
          username: r.username,
          fullName: r.full_name,
          userEmail: r.user_email,
          overallRating: r.overall_rating,
          scheduleRating: r.schedule_rating,
          raidRating: r.raid_rating,
          aiRating: r.ai_rating,
          reportingRating: r.reporting_rating,
          category: r.category,
          comment: r.comment,
          status: r.status,
          adminNotes: r.admin_notes,
          createdAt: r.created_at,
        })),
        stats: statsRows[0] || {},
      };
    } catch (error) {
      logger.error('List feedback error', { error });
      return reply.status(500).send({ error: 'Failed to list feedback' });
    }
  });

  // PATCH /:id — Update feedback status/notes (admin only)
  fastify.patch('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateFeedbackSchema.parse(request.body);

      const updates: string[] = [];
      const params: any[] = [];

      if (body.status) {
        updates.push('status = ?');
        params.push(body.status);
      }
      if (body.adminNotes !== undefined) {
        updates.push('admin_notes = ?');
        params.push(body.adminNotes);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No updates provided' });
      }

      params.push(id);
      await databaseService.query(`UPDATE feedback SET ${updates.join(', ')} WHERE id = ?`, params);

      return { message: 'Feedback updated' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      logger.error('Update feedback error', { error });
      return reply.status(500).send({ error: 'Failed to update feedback' });
    }
  });
}
