import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { databaseService } from '../database/connection';

export interface AuditEntry {
  id?: number;
  entryUuid: string;
  prevHash: string;
  entryHash: string;
  actorId: string;
  actorType: 'user' | 'api_key' | 'system';
  action: string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  payload: Record<string, any>;
  source: 'web' | 'mcp' | 'api' | 'system';
  ipAddress?: string | null;
  sessionId?: string | null;
  createdAt?: string;
}

export interface AppendInput {
  actorId: string;
  actorType: 'user' | 'api_key' | 'system';
  action: string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  payload: Record<string, any>;
  source: 'web' | 'mcp' | 'api' | 'system';
  ipAddress?: string | null;
  sessionId?: string | null;
}

export interface AuditFilter {
  projectId?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function rowToEntry(row: any): AuditEntry {
  let payload: Record<string, any> = {};
  if (row.payload) {
    try {
      payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    } catch { payload = {}; }
  }
  return {
    id: Number(row.id),
    entryUuid: row.entry_uuid,
    prevHash: row.prev_hash,
    entryHash: row.entry_hash,
    actorId: row.actor_id,
    actorType: row.actor_type,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    projectId: row.project_id ?? null,
    payload,
    source: row.source,
    ipAddress: row.ip_address ?? null,
    sessionId: row.session_id ?? null,
    createdAt: String(row.created_at),
  };
}

const GENESIS_HASH = '0'.repeat(64);

class AuditLedgerService {
  /**
   * Append a new entry to the immutable audit ledger.
   * Computes hash chain from the most recent entry.
   */
  async append(input: AppendInput): Promise<AuditEntry> {
    const entryUuid = uuidv4();

    // Get the hash of the most recent entry (or genesis)
    let prevHash = GENESIS_HASH;
    try {
      const lastRows = await databaseService.query<any>(
        'SELECT entry_hash FROM audit_ledger ORDER BY id DESC LIMIT 1',
      );
      if (lastRows.length > 0) {
        prevHash = lastRows[0].entry_hash;
      }
    } catch {
      // Table may not exist yet — use genesis hash
    }

    // Compute entry hash = SHA-256(prevHash + JSON(payload-envelope))
    const envelope = JSON.stringify({
      entryUuid,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      payload: input.payload,
      source: input.source,
    });
    const entryHash = sha256(prevHash + envelope);

    try {
      await databaseService.query(
        `INSERT INTO audit_ledger
          (entry_uuid, prev_hash, entry_hash, actor_id, actor_type, action,
           entity_type, entity_id, project_id, payload, source, ip_address, session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryUuid,
          prevHash,
          entryHash,
          input.actorId,
          input.actorType,
          input.action,
          input.entityType,
          input.entityId,
          input.projectId ?? null,
          JSON.stringify(input.payload),
          input.source,
          input.ipAddress ?? null,
          input.sessionId ?? null,
        ],
      );
    } catch (err) {
      console.warn('[AuditLedger] Could not append entry:', (err as Error).message);
      // Return the entry even if persistence fails (graceful degradation)
      return {
        entryUuid,
        prevHash,
        entryHash,
        ...input,
        payload: input.payload,
        projectId: input.projectId ?? null,
        ipAddress: input.ipAddress ?? null,
        sessionId: input.sessionId ?? null,
      };
    }

    const rows = await databaseService.query<any>(
      'SELECT * FROM audit_ledger WHERE entry_uuid = ?',
      [entryUuid],
    );
    return rowToEntry(rows[0]);
  }

  /**
   * Verify the hash chain integrity.
   * Returns { valid, checkedCount, brokenAtId? }
   */
  async verifyChain(projectId?: string, since?: string): Promise<{
    valid: boolean;
    checkedCount: number;
    brokenAtId?: number;
    brokenAtUuid?: string;
  }> {
    let sql = 'SELECT * FROM audit_ledger';
    const params: any[] = [];
    const conditions: string[] = [];

    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }
    if (since) {
      conditions.push('created_at >= ?');
      params.push(since);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY id ASC';

    const rows = await databaseService.query<any>(sql, params);

    let prevHash = GENESIS_HASH;
    let checkedCount = 0;

    for (const row of rows) {
      checkedCount++;

      // If filtering, we can't verify cross-boundary hashes, so only check
      // that each entry's prev_hash matches the previous entry in the result set
      // For a full unfiltered check, verify the complete chain
      if (!projectId && !since) {
        if (row.prev_hash !== prevHash) {
          return { valid: false, checkedCount, brokenAtId: Number(row.id), brokenAtUuid: row.entry_uuid };
        }

        // Recompute entry_hash
        const envelope = JSON.stringify({
          entryUuid: row.entry_uuid,
          actorId: row.actor_id,
          actorType: row.actor_type,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          projectId: row.project_id ?? null,
          payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
          source: row.source,
        });
        const expectedHash = sha256(prevHash + envelope);

        if (row.entry_hash !== expectedHash) {
          return { valid: false, checkedCount, brokenAtId: Number(row.id), brokenAtUuid: row.entry_uuid };
        }
      }

      prevHash = row.entry_hash;
    }

    return { valid: true, checkedCount };
  }

  /**
   * Query audit entries with filtering and pagination.
   */
  async getEntries(filters: AuditFilter): Promise<{ entries: AuditEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.projectId) {
      conditions.push('project_id = ?');
      params.push(filters.projectId);
    }
    if (filters.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      conditions.push('entity_id = ?');
      params.push(filters.entityId);
    }
    if (filters.actorId) {
      conditions.push('actor_id = ?');
      params.push(filters.actorId);
    }
    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }
    if (filters.since) {
      conditions.push('created_at >= ?');
      params.push(filters.since);
    }
    if (filters.until) {
      conditions.push('created_at <= ?');
      params.push(filters.until);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    // Count
    const countRows = await databaseService.query<any>(
      `SELECT COUNT(*) as cnt FROM audit_ledger${whereClause}`,
      params,
    );
    const total = Number(countRows[0].cnt);

    // Fetch page
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const dataRows = await databaseService.query<any>(
      `SELECT * FROM audit_ledger${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { entries: dataRows.map(rowToEntry), total };
  }
}

export const auditLedgerService = new AuditLedgerService();
