import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

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

interface WebhookRow {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  events: string;
  is_active: boolean | number;
  failure_count: number;
  last_triggered_at: string | null;
  last_status_code: number | null;
  created_at: string;
  updated_at: string;
}

function rowToDTO(row: WebhookRow, maskSecret = true): Webhook {
  const secret = maskSecret ? row.secret.substring(0, 8) + '...' : row.secret;
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
    secret,
    events,
    isActive: !!row.is_active,
    failureCount: Number(row.failure_count),
    lastTriggeredAt: row.last_triggered_at,
    lastStatusCode: row.last_status_code ? Number(row.last_status_code) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class WebhookService {
  async register(userId: string, url: string, events: string[], secret?: string): Promise<Webhook> {
    const id = uuidv4();
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    await databaseService.query(
      `INSERT INTO webhooks (id, user_id, url, secret, events, is_active, failure_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, url, webhookSecret, JSON.stringify(events), true, 0],
    );

    const rows = await databaseService.query<WebhookRow>('SELECT * FROM webhooks WHERE id = ?', [id]);
    // Return with unmasked secret so the user can see it once
    return rowToDTO(rows[0], false);
  }

  async list(userId: string): Promise<Webhook[]> {
    const rows = await databaseService.query<WebhookRow>(
      'SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );
    return rows.map(row => rowToDTO(row, true));
  }

  async getById(userId: string, webhookId: string): Promise<Webhook | null> {
    const rows = await databaseService.query<WebhookRow>(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [webhookId, userId],
    );
    if (rows.length === 0) return null;
    return rowToDTO(rows[0], true);
  }

  async update(userId: string, webhookId: string, data: { url?: string; events?: string[]; isActive?: boolean }): Promise<Webhook | null> {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.url !== undefined) { sets.push('url = ?'); params.push(data.url); }
    if (data.events !== undefined) { sets.push('events = ?'); params.push(JSON.stringify(data.events)); }
    if (data.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(data.isActive);
      // Reset failure count when re-activating
      if (data.isActive) {
        sets.push('failure_count = ?');
        params.push(0);
      }
    }

    if (sets.length > 0) {
      params.push(webhookId, userId);
      await databaseService.query(
        `UPDATE webhooks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
        params,
      );
    }

    const rows = await databaseService.query<WebhookRow>(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [webhookId, userId],
    );
    if (rows.length === 0) return null;
    return rowToDTO(rows[0], true);
  }

  async delete(userId: string, webhookId: string): Promise<boolean> {
    const result: any = await databaseService.query(
      'DELETE FROM webhooks WHERE id = ? AND user_id = ?',
      [webhookId, userId],
    );
    return result.affectedRows > 0;
  }

  async dispatch(event: string, payload: object, userId?: string): Promise<void> {
    if (!userId) return;
    let rows: WebhookRow[];
    try {
      rows = await databaseService.query<WebhookRow>(
        'SELECT * FROM webhooks WHERE user_id = ? AND is_active = true',
        [userId],
      );
    } catch (error) {
      console.error('Webhook dispatch: failed to query webhooks:', error);
      return;
    }

    // Filter in code: check if the event is in the webhook's events array
    const matchingWebhooks = rows.filter(row => {
      try {
        const events: string[] = typeof row.events === 'string' ? JSON.parse(row.events) : row.events;
        return events.includes(event);
      } catch {
        return false;
      }
    });

    for (const webhook of matchingWebhooks) {
      this.deliverWebhook(webhook, event, payload).catch(err => {
        console.error(`Webhook delivery failed for ${webhook.id}:`, err);
      });
    }
  }

  private async deliverWebhook(webhook: WebhookRow, event: string, payload: object): Promise<void> {
    const body = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });

    const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Signature': signature,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Success
      await databaseService.query(
        'UPDATE webhooks SET failure_count = 0, last_triggered_at = NOW(), last_status_code = ? WHERE id = ?',
        [response.status, webhook.id],
      );
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`Webhook delivery error for ${webhook.id}:`, error.message || error);

      // Increment failure count
      const newFailureCount = Number(webhook.failure_count) + 1;
      if (newFailureCount >= 5) {
        await databaseService.query(
          'UPDATE webhooks SET failure_count = ?, is_active = false, last_triggered_at = NOW(), last_status_code = 0 WHERE id = ?',
          [newFailureCount, webhook.id],
        );
      } else {
        await databaseService.query(
          'UPDATE webhooks SET failure_count = ?, last_triggered_at = NOW(), last_status_code = 0 WHERE id = ?',
          [newFailureCount, webhook.id],
        );
      }
    }
  }

  async test(userId: string, webhookId: string): Promise<boolean> {
    const rows = await databaseService.query<WebhookRow>(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [webhookId, userId],
    );
    if (rows.length === 0) return false;

    const webhook = rows[0];
    // Fire-and-forget the test delivery
    this.deliverWebhook(webhook, 'webhook.test', { message: 'Test ping' }).catch(err => {
      console.error(`Test webhook delivery failed for ${webhook.id}:`, err);
    });

    return true;
  }
}

export const webhookService = new WebhookService();
