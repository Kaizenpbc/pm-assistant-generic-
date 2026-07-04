import { BaseRepository } from './BaseRepository';
import { v4 as uuidv4 } from 'uuid';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
  lastStatusCode: number | null;
  createdAt: string;
  updatedAt: string;
}

function rowToWebhook(row: any): Webhook {
  let events: string[];
  try {
    events = typeof row.events === 'string' ? JSON.parse(row.events) : row.events;
  } catch {
    events = [];
  }
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    secret: row.secret,
    events,
    isActive: !!row.is_active,
    failureCount: Number(row.failure_count),
    lastTriggeredAt: row.last_triggered_at,
    lastStatusCode: row.last_status_code ? Number(row.last_status_code) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WebhookRepository extends BaseRepository<Webhook> {
  constructor() {
    super('webhooks', rowToWebhook);
  }

  async insert(userId: string, url: string, secret: string, events: string[]): Promise<Webhook> {
    const id = uuidv4();
    await this.queryRaw(
      `INSERT INTO webhooks (id, user_id, url, secret, events, is_active, failure_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, url, secret, JSON.stringify(events), true, 0],
    );
    return (await this.findById(id))!;
  }

  async findByUser(userId: string): Promise<Webhook[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );
    return this.mapRows(rows);
  }

  async findByUserAndId(userId: string, webhookId: string): Promise<Webhook | null> {
    const rows = await this.queryRaw(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [webhookId, userId],
    );
    return rows.length > 0 ? rowToWebhook(rows[0]) : null;
  }

  async findActiveByUser(userId: string): Promise<Webhook[]> {
    const rows = await this.queryRaw(
      'SELECT * FROM webhooks WHERE user_id = ? AND is_active = true',
      [userId],
    );
    return this.mapRows(rows);
  }

  async updateFields(webhookId: string, userId: string, sets: string[], params: any[]): Promise<void> {
    if (sets.length === 0) return;
    params.push(webhookId, userId);
    await this.queryRaw(
      `UPDATE webhooks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
      params,
    );
  }

  async deleteByUser(webhookId: string, userId: string): Promise<boolean> {
    return this.deleteById(webhookId, { column: 'user_id', value: userId });
  }

  async recordSuccess(webhookId: string, statusCode: number): Promise<void> {
    await this.queryRaw(
      'UPDATE webhooks SET failure_count = 0, last_triggered_at = NOW(), last_status_code = ? WHERE id = ?',
      [statusCode, webhookId],
    );
  }

  async recordFailure(webhookId: string, failureCount: number, deactivate: boolean): Promise<void> {
    if (deactivate) {
      await this.queryRaw(
        'UPDATE webhooks SET failure_count = ?, is_active = false, last_triggered_at = NOW(), last_status_code = 0 WHERE id = ?',
        [failureCount, webhookId],
      );
    } else {
      await this.queryRaw(
        'UPDATE webhooks SET failure_count = ?, last_triggered_at = NOW(), last_status_code = 0 WHERE id = ?',
        [failureCount, webhookId],
      );
    }
  }
}

export const webhookRepository = new WebhookRepository();
