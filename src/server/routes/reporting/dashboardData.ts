import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { databaseService } from '../../database/connection';

const globalRoles = ['admin', 'executive', 'pmo'];

function isGlobalScope(userRole: string, scope?: string): boolean {
  return globalRoles.includes(userRole) || scope === 'portfolio';
}

export async function dashboardDataRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /overdue-tasks
  fastify.get('/overdue-tasks', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { scope } = request.query as { scope?: string };
    const global = isGlobalScope(user.role, scope);

    const where = global
      ? `t.status NOT IN ('completed','done','cancelled') AND t.end_date < NOW()`
      : `t.status NOT IN ('completed','done','cancelled') AND t.end_date < NOW() AND p.created_by = ?`;
    const params = global ? [] : [user.userId];

    const rows = await databaseService.query<any>(
      `SELECT t.id, t.name, s.project_id AS projectId, p.name AS projectName,
              t.assigned_to AS assignedTo, t.end_date AS dueDate, t.priority,
              DATEDIFF(NOW(), t.end_date) AS overdueDays
       FROM tasks t
       JOIN schedules s ON t.schedule_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE ${where}
       ORDER BY overdueDays DESC
       LIMIT 50`,
      params
    );

    return { tasks: rows };
  });

  // GET /issues-trend
  fastify.get('/issues-trend', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { scope, weeks: weeksParam } = request.query as { scope?: string; weeks?: string };
    const global = isGlobalScope(user.role, scope);
    const weeks = Math.min(Math.max(parseInt(weeksParam || '8', 10) || 8, 1), 52);

    const scopeJoin = global ? '' : 'AND p.created_by = ?';
    const params = global ? [] : [user.userId];

    // Created per week
    const createdRows = await databaseService.query<any>(
      `SELECT DATE_FORMAT(DATE_SUB(t.created_at, INTERVAL WEEKDAY(t.created_at) DAY), '%b %d') AS week,
              COUNT(*) AS cnt
       FROM tasks t
       JOIN schedules s ON t.schedule_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? WEEK) ${scopeJoin}
       GROUP BY YEARWEEK(t.created_at, 1)
       ORDER BY MIN(t.created_at)`,
      [weeks, ...params]
    );

    // Resolved per week
    const resolvedRows = await databaseService.query<any>(
      `SELECT DATE_FORMAT(DATE_SUB(t.updated_at, INTERVAL WEEKDAY(t.updated_at) DAY), '%b %d') AS week,
              COUNT(*) AS cnt
       FROM tasks t
       JOIN schedules s ON t.schedule_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE t.status IN ('completed','done')
         AND t.updated_at >= DATE_SUB(CURDATE(), INTERVAL ? WEEK) ${scopeJoin}
       GROUP BY YEARWEEK(t.updated_at, 1)
       ORDER BY MIN(t.updated_at)`,
      [weeks, ...params]
    );

    // Merge into week buckets
    const createdMap = new Map(createdRows.map((r: any) => [r.week, Number(r.cnt)]));
    const resolvedMap = new Map(resolvedRows.map((r: any) => [r.week, Number(r.cnt)]));
    const allWeeks = new Set([...createdMap.keys(), ...resolvedMap.keys()]);
    const weekList = [...allWeeks].map(week => ({
      week,
      created: createdMap.get(week) || 0,
      resolved: resolvedMap.get(week) || 0,
    }));

    return { weeks: weekList };
  });

  // GET /milestones
  fastify.get('/milestones', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { scope, limit: limitParam } = request.query as { scope?: string; limit?: string };
    const global = isGlobalScope(user.role, scope);
    const limit = Math.min(Math.max(parseInt(limitParam || '10', 10) || 10, 1), 50);

    const scopeFilter = global ? '' : 'AND p.created_by = ?';
    const params = global ? [limit] : [user.userId, limit];

    const rows = await databaseService.query<any>(
      `SELECT t.id, t.name, s.project_id AS projectId, p.name AS projectName,
              t.end_date AS endDate,
              DATEDIFF(t.end_date, CURDATE()) AS daysUntil
       FROM tasks t
       JOIN schedules s ON t.schedule_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE t.is_milestone = 1
         AND t.status NOT IN ('completed','done','cancelled')
         AND t.end_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         ${scopeFilter}
       ORDER BY t.end_date ASC
       LIMIT ?`,
      params
    );

    return { milestones: rows };
  });
}
