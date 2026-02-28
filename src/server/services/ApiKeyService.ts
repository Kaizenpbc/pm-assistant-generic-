import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { databaseService } from '../database/connection';

interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string;
  rate_limit: number | null;
  is_active: boolean | number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UsageLogRow {
  method: string;
  status_code: number;
  cnt: number;
  avg_response: number;
}

class ApiKeyService {
  /**
   * Create a new API key. The raw key is returned once only.
   */
  async createKey(
    userId: string,
    name: string,
    scopes: string[],
    rateLimit?: number,
    expiresAt?: string,
  ): Promise<{ id: string; key: string; name: string; prefix: string; scopes: string[] }> {
    const id = uuidv4();
    const rawHex = crypto.randomBytes(20).toString('hex'); // 40 hex chars
    const rawKey = `kpm_${rawHex}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 8); // "kpm_" + first 4 hex chars

    await databaseService.query(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes, rate_limit, is_active, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, userId, name, keyHash, keyPrefix, JSON.stringify(scopes), rateLimit ?? 100, expiresAt || null],
    );

    return { id, key: rawKey, name, prefix: keyPrefix, scopes };
  }

  /**
   * Validate a raw API key. Returns key info if valid, null otherwise.
   */
  async validateKey(
    rawKey: string,
  ): Promise<{ userId: string; keyId: string; scopes: string[]; rateLimit: number | null } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const rows = await databaseService.query<ApiKeyRow>(
      `SELECT * FROM api_keys
       WHERE key_hash = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [keyHash],
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    // Update last_used_at (fire-and-forget)
    databaseService
      .query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [row.id])
      .catch(() => {});

    return {
      userId: row.user_id,
      keyId: row.id,
      scopes: JSON.parse(row.scopes),
      rateLimit: row.rate_limit,
    };
  }

  /**
   * List all API keys for a user (never returns the hash).
   */
  async listKeys(
    userId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      keyPrefix: string;
      scopes: string[];
      rateLimit: number | null;
      isActive: boolean;
      lastUsedAt: string | null;
      expiresAt: string | null;
      createdAt: string;
    }>
  > {
    const rows = await databaseService.query<ApiKeyRow>(
      'SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes: JSON.parse(row.scopes),
      rateLimit: row.rate_limit,
      isActive: !!row.is_active,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Revoke (deactivate) an API key.
   */
  async revokeKey(userId: string, keyId: string): Promise<void> {
    await databaseService.query(
      'UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?',
      [keyId, userId],
    );
  }

  /**
   * Permanently delete an API key.
   */
  async deleteKey(userId: string, keyId: string): Promise<void> {
    await databaseService.query('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [
      keyId,
      userId,
    ]);
  }

  /**
   * Log API key usage (fire-and-forget).
   */
  logUsage(
    keyId: string,
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
    ip: string,
  ): void {
    setImmediate(() => {
      const id = uuidv4();
      databaseService
        .query(
          `INSERT INTO api_key_usage_log (id, api_key_id, method, path, status_code, response_time_ms, ip_address)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, keyId, method, path, statusCode, responseTimeMs, ip],
        )
        .catch((err) => {
          console.error('Failed to log API key usage:', err);
        });
    });
  }

  /**
   * Get usage statistics for an API key.
   */
  async getUsageStats(
    keyId: string,
    since?: string,
  ): Promise<{
    totalRequests: number;
    requestsByMethod: Record<string, number>;
    requestsByStatus: Record<string, number>;
    avgResponseTime: number;
  }> {
    const whereClause = since
      ? 'WHERE api_key_id = ? AND created_at >= ?'
      : 'WHERE api_key_id = ?';
    const params = since ? [keyId, since] : [keyId];

    // Total requests and avg response time
    const totalRows = await databaseService.query<{ cnt: number; avg_rt: number }>(
      `SELECT COUNT(*) as cnt, COALESCE(AVG(response_time_ms), 0) as avg_rt
       FROM api_key_usage_log ${whereClause}`,
      params,
    );

    // Requests by method
    const methodRows = await databaseService.query<{ method: string; cnt: number }>(
      `SELECT method, COUNT(*) as cnt FROM api_key_usage_log ${whereClause} GROUP BY method`,
      params,
    );

    // Requests by status code
    const statusRows = await databaseService.query<{ status_code: number; cnt: number }>(
      `SELECT status_code, COUNT(*) as cnt FROM api_key_usage_log ${whereClause} GROUP BY status_code`,
      params,
    );

    const requestsByMethod: Record<string, number> = {};
    for (const row of methodRows) {
      requestsByMethod[row.method] = Number(row.cnt);
    }

    const requestsByStatus: Record<string, number> = {};
    for (const row of statusRows) {
      requestsByStatus[String(row.status_code)] = Number(row.cnt);
    }

    return {
      totalRequests: Number(totalRows[0]?.cnt || 0),
      requestsByMethod,
      requestsByStatus,
      avgResponseTime: Number(totalRows[0]?.avg_rt || 0),
    };
  }
}

export const apiKeyService = new ApiKeyService();
