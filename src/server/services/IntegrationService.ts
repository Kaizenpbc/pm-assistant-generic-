import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';
import { jiraAdapter } from './integrations/JiraAdapter';
import { githubAdapter } from './integrations/GitHubAdapter';
import { slackAdapter } from './integrations/SlackAdapter';
import { trelloAdapter } from './integrations/TrelloAdapter';

export interface Integration {
  id: string;
  projectId: string | null;
  userId: string;
  provider: string;
  config: Record<string, any>;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  direction: string;
  status: string;
  itemsSynced: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface IntegrationRow {
  id: string;
  project_id: string | null;
  user_id: string;
  provider: string;
  config: string;
  is_active: boolean | number;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SyncLogRow {
  id: string;
  integration_id: string;
  direction: string;
  status: string;
  items_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

const SENSITIVE_FIELDS = ['apiToken', 'token', 'apiKey', 'webhookUrl', 'password', 'secret'];

function maskConfig(config: Record<string, any>): Record<string, any> {
  const masked = { ...config };
  for (const key of SENSITIVE_FIELDS) {
    if (masked[key] && typeof masked[key] === 'string') {
      masked[key] = masked[key].slice(0, 4) + '****';
    }
  }
  return masked;
}

function parseConfig(raw: string | Record<string, any>): Record<string, any> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { console.warn('IntegrationService: malformed config JSON, returning {}', e); return {}; }
  }
  return raw || {};
}

function rowToDTO(row: IntegrationRow): Integration {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    provider: row.provider,
    config: maskConfig(parseConfig(row.config)),
    isActive: !!row.is_active,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function syncLogRowToDTO(row: SyncLogRow): IntegrationSyncLog {
  return {
    id: row.id,
    integrationId: row.integration_id,
    direction: row.direction,
    status: row.status,
    itemsSynced: Number(row.items_synced),
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

class IntegrationService {
  async create(
    userId: string,
    provider: string,
    config: Record<string, any>,
    projectId?: string,
  ): Promise<Integration> {
    const id = uuidv4();
    await databaseService.query(
      `INSERT INTO integrations (id, project_id, user_id, provider, config, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, projectId || null, userId, provider, JSON.stringify(config), true],
    );
    const rows = await databaseService.query<IntegrationRow>('SELECT * FROM integrations WHERE id = ?', [id]);
    return rowToDTO(rows[0]);
  }

  async getByUser(userId: string): Promise<Integration[]> {
    const rows = await databaseService.query<IntegrationRow>(
      'SELECT * FROM integrations WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );
    return rows.map(rowToDTO);
  }

  async getByProject(projectId: string): Promise<Integration[]> {
    const rows = await databaseService.query<IntegrationRow>(
      'SELECT * FROM integrations WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
    );
    return rows.map(rowToDTO);
  }

  async getById(id: string): Promise<Integration | null> {
    const rows = await databaseService.query<IntegrationRow>('SELECT * FROM integrations WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return rowToDTO(rows[0]);
  }

  private async getRawById(id: string): Promise<IntegrationRow | null> {
    const rows = await databaseService.query<IntegrationRow>('SELECT * FROM integrations WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async update(id: string, data: { config?: Record<string, any>; isActive?: boolean }): Promise<Integration> {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.config !== undefined) { sets.push('config = ?'); params.push(JSON.stringify(data.config)); }
    if (data.isActive !== undefined) { sets.push('is_active = ?'); params.push(data.isActive); }
    if (sets.length > 0) {
      params.push(id);
      await databaseService.query(`UPDATE integrations SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const rows = await databaseService.query<IntegrationRow>('SELECT * FROM integrations WHERE id = ?', [id]);
    return rowToDTO(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await databaseService.query('DELETE FROM integration_sync_log WHERE integration_id = ?', [id]);
    await databaseService.query('DELETE FROM integrations WHERE id = ?', [id]);
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const row = await this.getRawById(id);
    if (!row) return { success: false, message: 'Integration not found' };

    const config = parseConfig(row.config);

    switch (row.provider) {
      case 'jira':
        return jiraAdapter.testConnection(config as any);
      case 'github':
        return githubAdapter.testConnection(config as any);
      case 'slack':
        return slackAdapter.testConnection(config as any);
      case 'trello':
        return trelloAdapter.testConnection(config as any);
      default:
        return { success: false, message: `Unsupported provider: ${row.provider}` };
    }
  }

  async sync(
    id: string,
    direction: 'pull' | 'push',
  ): Promise<{ status: string; itemsSynced: number; errorMessage?: string }> {
    const row = await this.getRawById(id);
    if (!row) throw new Error('Integration not found');

    const config = parseConfig(row.config);
    const logId = uuidv4();
    const startedAt = new Date().toISOString();

    await databaseService.query(
      `INSERT INTO integration_sync_log (id, integration_id, direction, status, items_synced, started_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, id, direction, 'running', 0, startedAt],
    );

    try {
      let itemsSynced = 0;

      if (direction === 'pull') {
        itemsSynced = await this.pullFromProvider(row.provider, config);
      } else {
        itemsSynced = await this.pushToProvider(row.provider, config);
      }

      await databaseService.query(
        `UPDATE integration_sync_log SET status = ?, items_synced = ?, completed_at = ? WHERE id = ?`,
        ['success', itemsSynced, new Date().toISOString(), logId],
      );

      await databaseService.query(
        `UPDATE integrations SET last_sync_at = ? WHERE id = ?`,
        [new Date().toISOString(), id],
      );

      return { status: 'success', itemsSynced };
    } catch (error: any) {
      const errorMessage = error.message || 'Sync failed';
      await databaseService.query(
        `UPDATE integration_sync_log SET status = ?, error_message = ?, completed_at = ? WHERE id = ?`,
        ['failed', errorMessage, new Date().toISOString(), logId],
      );
      return { status: 'failed', itemsSynced: 0, errorMessage };
    }
  }

  private async pullFromProvider(provider: string, config: Record<string, any>): Promise<number> {
    switch (provider) {
      case 'jira': {
        const result = await jiraAdapter.pullIssues(config as any);
        return result.count;
      }
      case 'github': {
        const result = await githubAdapter.pullIssues(config as any);
        return result.count;
      }
      case 'trello': {
        const result = await trelloAdapter.pullCards(config as any);
        return result.count;
      }
      case 'slack':
        throw new Error('Slack integration does not support pull');
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async pushToProvider(provider: string, config: Record<string, any>): Promise<number> {
    // In a real implementation, tasks would be fetched from the project
    const tasks: any[] = [];

    switch (provider) {
      case 'jira': {
        const result = await jiraAdapter.pushTasks(config as any, tasks);
        return result.count;
      }
      case 'github': {
        const result = await githubAdapter.pushTasks(config as any, tasks);
        return result.count;
      }
      case 'trello': {
        const result = await trelloAdapter.pushTasks(config as any, tasks);
        return result.count;
      }
      case 'slack':
        throw new Error('Slack integration does not support push');
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async getSyncLog(integrationId: string): Promise<IntegrationSyncLog[]> {
    const rows = await databaseService.query<SyncLogRow>(
      'SELECT * FROM integration_sync_log WHERE integration_id = ? ORDER BY started_at DESC',
      [integrationId],
    );
    return rows.map(syncLogRowToDTO);
  }
}

export const integrationService = new IntegrationService();
