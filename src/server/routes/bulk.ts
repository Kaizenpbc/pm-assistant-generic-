import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkTaskInput {
  name: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  progress?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  dependencies?: string;
  notes?: string;
  wbs?: string;
}

interface BulkUpdateInput {
  id: string;
  scheduleId: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  progress?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  dependencies?: string;
  notes?: string;
  wbs?: string;
}

const MAX_BULK = 100;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function bulkRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  // -----------------------------------------------------------------------
  // POST /tasks — Bulk create tasks
  // -----------------------------------------------------------------------
  fastify.post('/tasks', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const body = request.body as { scheduleId: string; tasks: BulkTaskInput[] };

      if (!body.scheduleId || !Array.isArray(body.tasks) || body.tasks.length === 0) {
        return reply.status(400).send({ error: 'scheduleId and a non-empty tasks array are required' });
      }
      if (body.tasks.length > MAX_BULK) {
        return reply.status(400).send({ error: `Maximum ${MAX_BULK} tasks per request` });
      }

      const succeeded: Array<{ id: string; name: string }> = [];
      const failed: Array<{ index: number; name: string; error: string }> = [];

      await databaseService.transaction(async (connection) => {
        for (let i = 0; i < body.tasks.length; i++) {
          const t = body.tasks[i];
          try {
            if (!t.name) {
              failed.push({ index: i, name: t.name || '', error: 'name is required' });
              continue;
            }

            const id = uuidv4();
            await connection.execute(
              `INSERT INTO schedule_tasks
                 (id, schedule_id, name, start_date, end_date, duration, progress,
                  status, priority, assigned_to, dependencies, notes, wbs, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                id,
                body.scheduleId,
                t.name,
                t.startDate || null,
                t.endDate || null,
                t.duration ?? null,
                t.progress ?? 0,
                t.status || 'not_started',
                t.priority || 'medium',
                t.assignedTo || null,
                t.dependencies ? (typeof t.dependencies === 'string' ? t.dependencies : JSON.stringify(t.dependencies)) : '[]',
                t.notes || null,
                t.wbs || null,
              ],
            );
            succeeded.push({ id, name: t.name });
          } catch (err: any) {
            failed.push({ index: i, name: t.name || '', error: err.message || 'Unknown error' });
          }
        }
      });

      return { succeeded, failed };
    } catch (error) {
      console.error('Bulk create tasks error:', error);
      return reply.status(500).send({ error: 'Failed to bulk create tasks' });
    }
  });

  // -----------------------------------------------------------------------
  // PUT /tasks — Bulk update tasks
  // -----------------------------------------------------------------------
  fastify.put('/tasks', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const body = request.body as { updates: BulkUpdateInput[] };

      if (!Array.isArray(body.updates) || body.updates.length === 0) {
        return reply.status(400).send({ error: 'A non-empty updates array is required' });
      }
      if (body.updates.length > MAX_BULK) {
        return reply.status(400).send({ error: `Maximum ${MAX_BULK} updates per request` });
      }

      const succeeded: Array<{ id: string }> = [];
      const failed: Array<{ id: string; error: string }> = [];

      await databaseService.transaction(async (connection) => {
        for (const u of body.updates) {
          try {
            if (!u.id || !u.scheduleId) {
              failed.push({ id: u.id || 'unknown', error: 'id and scheduleId are required' });
              continue;
            }

            const sets: string[] = [];
            const params: any[] = [];

            if (u.name !== undefined) { sets.push('name = ?'); params.push(u.name); }
            if (u.startDate !== undefined) { sets.push('start_date = ?'); params.push(u.startDate); }
            if (u.endDate !== undefined) { sets.push('end_date = ?'); params.push(u.endDate); }
            if (u.duration !== undefined) { sets.push('duration = ?'); params.push(u.duration); }
            if (u.progress !== undefined) { sets.push('progress = ?'); params.push(u.progress); }
            if (u.status !== undefined) { sets.push('status = ?'); params.push(u.status); }
            if (u.priority !== undefined) { sets.push('priority = ?'); params.push(u.priority); }
            if (u.assignedTo !== undefined) { sets.push('assigned_to = ?'); params.push(u.assignedTo); }
            if (u.dependencies !== undefined) {
              sets.push('dependencies = ?');
              params.push(typeof u.dependencies === 'string' ? u.dependencies : JSON.stringify(u.dependencies));
            }
            if (u.notes !== undefined) { sets.push('notes = ?'); params.push(u.notes); }
            if (u.wbs !== undefined) { sets.push('wbs = ?'); params.push(u.wbs); }

            if (sets.length === 0) {
              failed.push({ id: u.id, error: 'No fields to update' });
              continue;
            }

            sets.push('updated_at = NOW()');
            params.push(u.id, u.scheduleId);

            await connection.execute(
              `UPDATE schedule_tasks SET ${sets.join(', ')} WHERE id = ? AND schedule_id = ?`,
              params,
            );
            succeeded.push({ id: u.id });
          } catch (err: any) {
            failed.push({ id: u.id || 'unknown', error: err.message || 'Unknown error' });
          }
        }
      });

      return { succeeded, failed };
    } catch (error) {
      console.error('Bulk update tasks error:', error);
      return reply.status(500).send({ error: 'Failed to bulk update tasks' });
    }
  });

  // -----------------------------------------------------------------------
  // PUT /tasks/status — Batch status update
  // -----------------------------------------------------------------------
  fastify.put('/tasks/status', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.userId) return reply.status(401).send({ error: 'Unauthorized' });

      const body = request.body as { scheduleId: string; taskIds: string[]; status: string };

      if (!body.scheduleId || !Array.isArray(body.taskIds) || body.taskIds.length === 0 || !body.status) {
        return reply.status(400).send({ error: 'scheduleId, taskIds (non-empty), and status are required' });
      }
      if (body.taskIds.length > MAX_BULK) {
        return reply.status(400).send({ error: `Maximum ${MAX_BULK} task IDs per request` });
      }

      const placeholders = body.taskIds.map(() => '?').join(',');
      // databaseService.query returns the raw ResultSetHeader for non-SELECT
      // statements (the mysql2 driver returns it as `rows` from execute).
      const result = await databaseService.query<any>(
        `UPDATE schedule_tasks
         SET status = ?, updated_at = NOW()
         WHERE id IN (${placeholders}) AND schedule_id = ?`,
        [body.status, ...body.taskIds, body.scheduleId],
      );

      // For UPDATE queries, mysql2's execute returns ResultSetHeader as rows.
      // databaseService.query casts it as T[], but it is really the header.
      const header = result as any;
      const updated = header?.affectedRows ?? body.taskIds.length;

      return { updated };
    } catch (error) {
      console.error('Batch status update error:', error);
      return reply.status(500).send({ error: 'Failed to batch update task status' });
    }
  });
}
