import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
  createdAt: string;
}

function rowToDelivery(row: any): WebhookDelivery {
  let payload: any;
  try {
    payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  } catch {
    payload = null;
  }
  return {
    id: row.id,
    webhookId: row.webhook_id,
    event: row.event,
    payload,
    statusCode: row.status_code != null ? Number(row.status_code) : null,
    responseTimeMs: row.response_time_ms != null ? Number(row.response_time_ms) : null,
    error: row.error ?? null,
    createdAt: String(row.created_at),
  };
}

export class WebhookDeliveryRepository extends BaseRepository<WebhookDelivery> {
  constructor() {
    super('webhook_deliveries', rowToDelivery);
  }

  async insert(
    webhookId: string,
    event: string,
    payload: any,
    statusCode: number | null,
    responseTimeMs: number | null,
    error: string | null,
  ): Promise<void> {
    const id = uuidv4();
    await this.queryRaw(
      `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status_code, response_time_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, webhookId, event, JSON.stringify(payload), statusCode, responseTimeMs, error],
    );
  }

  async findByWebhookPaginated(webhookId: string, limit: number, offset: number): Promise<{ rows: WebhookDelivery[]; total: number }> {
    return this.queryPaginated('webhook_id = ?', [webhookId], 'created_at DESC', limit, offset);
  }
}

export const webhookDeliveryRepository = new WebhookDeliveryRepository();
