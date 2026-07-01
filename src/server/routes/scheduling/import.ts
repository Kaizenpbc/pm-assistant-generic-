import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { parse as csvParse } from 'csv-parse/sync';
import { databaseService } from '../../database/connection';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';

const MAX_BULK = 100;

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/** Normalise a CSV header to a known task field name, applying columnMap overrides first. */
function mapColumn(header: string, columnMap: Record<string, string> | undefined): string | null {
  const mapped = columnMap?.[header] ?? header;
  const key = mapped.trim().toLowerCase().replace(/\s+/g, '_');

  const aliases: Record<string, string> = {
    name: 'name',
    title: 'name',
    task: 'name',
    task_name: 'name',
    key_activities: 'name',
    activities: 'name',
    activity: 'name',
    status: 'status',
    priority: 'priority',
    start_date: 'startDate',
    startdate: 'startDate',
    start: 'startDate',
    end_date: 'endDate',
    enddate: 'endDate',
    end: 'endDate',
    due_date: 'dueDate',
    duedate: 'dueDate',
    due: 'dueDate',
    deadline: 'dueDate',
    assigned_to: 'assignedTo',
    assignedto: 'assignedTo',
    assignee: 'assignedTo',
    owner: 'assignedTo',
    resource: 'assignedTo',
    progress: 'progressPercentage',
    progress_percentage: 'progressPercentage',
    progresspercentage: 'progressPercentage',
    estimated_hours: 'estimatedDurationHours',
    estimated_duration_hours: 'estimatedDurationHours',
    estimateddurationhours: 'estimatedDurationHours',
    duration: 'estimatedDurationHours',
    hours: 'estimatedDurationHours',
    description: 'description',
    deliverables: 'description',
    deliverable: 'description',
    notes: 'description',
    details: 'description',
  };

  return aliases[key] ?? null;
}

function toDateStr(val: string | undefined | null): string | null {
  if (!val || val.trim() === '') return null;
  const d = new Date(val.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function importRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /:scheduleId/import — bulk import tasks from CSV
  fastify.post('/:scheduleId/import', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scheduleId } = request.params as { scheduleId: string };
      const { csv, columnMap } = request.body as { csv: string; columnMap?: Record<string, string> };

      if (!csv || typeof csv !== 'string') {
        return reply.status(400).send({ error: 'csv field is required and must be a string' });
      }

      const userId = (request as any).user?.userId as string;

      let records: Record<string, string>[];
      try {
        records = csvParse(csv, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });
      } catch (parseErr: any) {
        return reply.status(400).send({ error: `CSV parse error: ${parseErr.message}` });
      }

      if (records.length === 0) {
        return reply.status(400).send({ error: 'CSV contains no data rows' });
      }

      if (records.length > MAX_BULK) {
        return reply.status(400).send({ error: `Too many rows (${records.length}). Maximum is ${MAX_BULK}.` });
      }

      const succeeded: number[] = [];
      const failed: { row: number; error: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const rawRow = records[i];
        const rowNum = i + 1; // 1-based row number (excluding header)

        try {
          // Map CSV columns to task fields
          const row: Record<string, string> = {};
          for (const [header, value] of Object.entries(rawRow)) {
            const field = mapColumn(header, columnMap);
            if (field) {
              row[field] = value;
            }
          }

          if (!row.name || row.name.trim() === '') {
            throw new Error('name is required');
          }

          // Validate and default status
          let status = 'pending';
          if (row.status && row.status.trim() !== '') {
            const s = row.status.trim().toLowerCase();
            if (!VALID_STATUSES.includes(s)) {
              throw new Error(`Invalid status "${row.status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
            }
            status = s;
          }

          // Validate and default priority
          let priority = 'medium';
          if (row.priority && row.priority.trim() !== '') {
            const p = row.priority.trim().toLowerCase();
            if (!VALID_PRIORITIES.includes(p)) {
              throw new Error(`Invalid priority "${row.priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}`);
            }
            priority = p;
          }

          const startDate = toDateStr(row.startDate);
          const endDate = toDateStr(row.endDate);
          const dueDate = toDateStr(row.dueDate);
          const progressPercentage = row.progressPercentage ? parseFloat(row.progressPercentage) : 0;
          const estimatedDurationHours = row.estimatedDurationHours ? parseFloat(row.estimatedDurationHours) : null;

          if (row.progressPercentage && isNaN(progressPercentage)) {
            throw new Error(`Invalid progress value "${row.progressPercentage}"`);
          }
          if (row.estimatedDurationHours && estimatedDurationHours !== null && isNaN(estimatedDurationHours)) {
            throw new Error(`Invalid estimated_hours value "${row.estimatedDurationHours}"`);
          }

          const id = uuidv4();

          await databaseService.query(
            `INSERT INTO tasks (id, schedule_id, name, description, status, priority, assigned_to,
              due_date, estimated_days, estimated_duration_hours, actual_duration_hours,
              start_date, end_date, progress_percentage, dependency, dependency_type,
              risks, issues, comments, parent_task_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              scheduleId,
              row.name.trim(),
              row.description || null,
              status,
              priority,
              row.assignedTo || null,
              dueDate,
              null, // estimatedDays
              estimatedDurationHours,
              null, // actualDurationHours
              startDate,
              endDate,
              progressPercentage,
              null, // dependency
              null, // dependencyType
              null, // risks
              null, // issues
              null, // comments
              null, // parentTaskId
              userId,
            ],
          );

          succeeded.push(rowNum);
        } catch (rowErr: any) {
          failed.push({ row: rowNum, error: rowErr.message || 'Unknown error' });
        }
      }

      return {
        succeeded: succeeded.length,
        failed,
        total: records.length,
      };
    } catch (error: any) {
      console.error('CSV import error:', error);
      return reply.status(500).send({ error: 'Failed to import CSV' });
    }
  });
}
