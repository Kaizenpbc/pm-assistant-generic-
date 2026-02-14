import { FastifyRequest } from 'fastify';
import { auditLogger } from '../utils/logger';
import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

export interface AuditEvent {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  timestamp: Date;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export class AuditService {
  private events: AuditEvent[] = [];

  private get useDb() { return databaseService.isHealthy(); }

  private rowToEvent(row: any): AuditEvent {
    const c = toCamelCaseKeys(row);
    return {
      ...c,
      details: typeof c.details === 'string' ? JSON.parse(c.details) : c.details,
      timestamp: new Date(c.timestamp),
    } as AuditEvent;
  }

  public logUserAction(
    request: FastifyRequest,
    userId: string,
    action: string,
    resource: string,
    details: Record<string, any> = {}
  ): void {
    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      action,
      resource,
      timestamp: new Date(),
      details,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Fire-and-forget DB insert
    if (this.useDb) {
      databaseService.query(
        `INSERT INTO audit_events (id, user_id, action, resource, timestamp, details, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.userId,
          event.action,
          event.resource,
          event.timestamp,
          JSON.stringify(event.details),
          event.ip || null,
          event.userAgent || null,
        ],
      ).catch(() => { /* fire-and-forget */ });
    }

    this.events.push(event);
    auditLogger.info('User action logged', event);
  }

  public logSystemEvent(
    request: FastifyRequest,
    action: string,
    details: Record<string, any> = {}
  ): void {
    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      resource: 'system',
      timestamp: new Date(),
      details,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Fire-and-forget DB insert
    if (this.useDb) {
      databaseService.query(
        `INSERT INTO audit_events (id, user_id, action, resource, timestamp, details, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.userId || null,
          event.action,
          event.resource,
          event.timestamp,
          JSON.stringify(event.details),
          event.ip || null,
          event.userAgent || null,
        ],
      ).catch(() => { /* fire-and-forget */ });
    }

    this.events.push(event);
    auditLogger.info('System event logged', event);
  }

  public async getEvents(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<AuditEvent[]> {
    if (this.useDb) {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filters.userId) {
        conditions.push('user_id = ?');
        params.push(filters.userId);
      }
      if (filters.action) {
        conditions.push('action = ?');
        params.push(filters.action);
      }
      if (filters.resource) {
        conditions.push('resource = ?');
        params.push(filters.resource);
      }
      if (filters.startDate) {
        conditions.push('timestamp >= ?');
        params.push(new Date(filters.startDate));
      }
      if (filters.endDate) {
        conditions.push('timestamp <= ?');
        params.push(new Date(filters.endDate));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 500;
      params.push(limit);

      const rows = await databaseService.query(
        `SELECT * FROM audit_events ${whereClause} ORDER BY timestamp DESC LIMIT ?`,
        params,
      );
      return rows.map((r: any) => this.rowToEvent(r));
    }

    let filteredEvents = [...this.events];

    if (filters.userId) filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
    if (filters.action) filteredEvents = filteredEvents.filter(e => e.action === filters.action);
    if (filters.resource) filteredEvents = filteredEvents.filter(e => e.resource === filters.resource);
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredEvents = filteredEvents.filter(e => e.timestamp >= startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filteredEvents = filteredEvents.filter(e => e.timestamp <= endDate);
    }
    if (filters.limit) filteredEvents = filteredEvents.slice(-filters.limit);

    return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async getAuditStats() {
    if (this.useDb) {
      const actionRows = await databaseService.query(
        `SELECT action, COUNT(*) as count FROM audit_events GROUP BY action`,
        [],
      );
      const resourceRows = await databaseService.query(
        `SELECT resource, COUNT(*) as count FROM audit_events GROUP BY resource`,
        [],
      );
      const totalRows = await databaseService.query(
        `SELECT COUNT(*) as total FROM audit_events`,
        [],
      );

      const eventsByAction: Record<string, number> = {};
      for (const row of actionRows) {
        eventsByAction[row.action] = Number(row.count);
      }

      const eventsByResource: Record<string, number> = {};
      for (const row of resourceRows) {
        eventsByResource[row.resource] = Number(row.count);
      }

      return {
        totalEvents: Number(totalRows[0]?.total ?? 0),
        eventsByAction,
        eventsByResource,
      };
    }

    const stats = {
      totalEvents: this.events.length,
      eventsByAction: {} as Record<string, number>,
      eventsByResource: {} as Record<string, number>,
    };
    this.events.forEach(event => {
      stats.eventsByAction[event.action] = (stats.eventsByAction[event.action] || 0) + 1;
      stats.eventsByResource[event.resource] = (stats.eventsByResource[event.resource] || 0) + 1;
    });
    return stats;
  }
}

export const auditService = new AuditService();
