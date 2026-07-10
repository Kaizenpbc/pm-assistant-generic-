import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { databaseService } from '../../database/connection';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import logger from '../../utils/logger';

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const { q } = request.query as { q: string };
      if (!q || q.length < 2) return { results: [] };
      const term = `%${q}%`;

      // Run all searches in parallel
      const [projects, tasks, goals, lessons, resources, changeRequests] = await Promise.all([
        databaseService.query<any>(
          `SELECT id, name, description, status FROM projects WHERE (name LIKE ? OR description LIKE ?) AND created_by = ? LIMIT 10`,
          [term, term, user.userId]
        ),
        databaseService.query<any>(
          `SELECT t.id, t.name, t.description, t.status, s.project_id, p.name as project_name
           FROM tasks t
           JOIN schedules s ON t.schedule_id = s.id
           JOIN projects p ON s.project_id = p.id
           WHERE (t.name LIKE ? OR t.description LIKE ?) AND p.created_by = ?
           LIMIT 10`,
          [term, term, user.userId]
        ),
        databaseService.query<any>(
          `SELECT id, name, description, status FROM goals WHERE (name LIKE ? OR description LIKE ?) AND created_by = ? LIMIT 5`,
          [term, term, user.userId]
        ).catch(() => []),
        databaseService.query<any>(
          `SELECT id, title as name, description, category as status FROM lessons_learned WHERE (title LIKE ? OR description LIKE ?) LIMIT 5`,
          [term, term]
        ).catch(() => []),
        databaseService.query<any>(
          `SELECT id, name, role as description, email as status FROM resources WHERE (name LIKE ? OR role LIKE ? OR email LIKE ?) AND created_by = ? LIMIT 5`,
          [term, term, term, user.userId]
        ).catch(() => []),
        databaseService.query<any>(
          `SELECT cr.id, cr.title as name, cr.description, cr.status, cr.project_id, p.name as project_name
           FROM change_requests cr
           JOIN projects p ON cr.project_id = p.id
           WHERE (cr.title LIKE ? OR cr.description LIKE ?) AND p.created_by = ?
           LIMIT 5`,
          [term, term, user.userId]
        ).catch(() => []),
      ]);

      const results = [
        ...projects.map((p: any) => ({ type: 'project', id: p.id, name: p.name, description: p.description, status: p.status })),
        ...tasks.map((t: any) => ({ type: 'task', id: t.id, name: t.name, description: t.description, status: t.status, projectId: t.project_id, projectName: t.project_name })),
        ...goals.map((g: any) => ({ type: 'goal', id: g.id, name: g.name, description: g.description, status: g.status })),
        ...lessons.map((l: any) => ({ type: 'lesson', id: l.id, name: l.name, description: l.description, status: l.status })),
        ...resources.map((r: any) => ({ type: 'resource', id: r.id, name: r.name, description: r.description, status: r.status })),
        ...changeRequests.map((cr: any) => ({ type: 'change_request', id: cr.id, name: cr.name, description: cr.description, status: cr.status, projectId: cr.project_id, projectName: cr.project_name })),
      ];
      return { results };
    } catch (error) {
      logger.error('Search error', { error });
      return reply.status(500).send({ error: 'Search failed' });
    }
  });
}
