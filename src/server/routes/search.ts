import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { databaseService } from '../database/connection';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { q } = request.query as { q: string };
      if (!q || q.length < 2) return { results: [] };
      const term = `%${q}%`;
      // query projects
      const projects = await databaseService.query<any>(
        `SELECT id, name, description, status FROM projects WHERE (name LIKE ? OR description LIKE ?) AND created_by = ? LIMIT 10`,
        [term, term, user.userId]
      );
      // query tasks
      const tasks = await databaseService.query<any>(
        `SELECT t.id, t.name, t.description, t.status, s.project_id, p.name as project_name
         FROM schedule_tasks t
         JOIN schedules s ON t.schedule_id = s.id
         JOIN projects p ON s.project_id = p.id
         WHERE (t.name LIKE ? OR t.description LIKE ?) AND p.created_by = ?
         LIMIT 10`,
        [term, term, user.userId]
      );
      const results = [
        ...projects.map((p: any) => ({ type: 'project', id: p.id, name: p.name, description: p.description, status: p.status })),
        ...tasks.map((t: any) => ({ type: 'task', id: t.id, name: t.name, description: t.description, status: t.status, projectId: t.project_id, projectName: t.project_name })),
      ];
      return { results };
    } catch (error) {
      console.error('Search error:', error);
      return reply.status(500).send({ error: 'Search failed' });
    }
  });
}
