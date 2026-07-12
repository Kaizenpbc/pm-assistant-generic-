import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { apiKeyRepository, ApiKeyRow } from '../database/ApiKeyRepository';
import logger from '../utils/logger';

export class ApiKeyService {
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

    await apiKeyRepository.insert(id, userId, name, keyHash, keyPrefix, JSON.stringify(scopes), rateLimit ?? 100, expiresAt || null);

    return { id, key: rawKey, name, prefix: keyPrefix, scopes };
  }

  /**
   * Validate a raw API key. Returns key info if valid, null otherwise.
   */
  async validateKey(
    rawKey: string,
  ): Promise<{ userId: string; keyId: string; scopes: string[]; rateLimit: number | null; userRole: string } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const row = await apiKeyRepository.findByHash(keyHash);

    if (!row) return null;

    // Update last_used_at (fire-and-forget)
    apiKeyRepository.touchLastUsed(row.id).catch((error) => {
      logger.warn('Failed to update API key last_used_at', { keyId: row.id, error });
    });

    let scopes: string[];
    try {
      scopes = JSON.parse(row.scopes);
    } catch {
      logger.error('Malformed scopes JSON in API key', { keyId: row.id });
      return null;
    }

    return {
      userId: row.user_id,
      keyId: row.id,
      scopes,
      rateLimit: row.rate_limit,
      userRole: row.user_role || 'team_member',
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
    const rows = await apiKeyRepository.findByUser(userId);

    return rows.map((row) => {
      let scopes: string[];
      try {
        scopes = JSON.parse(row.scopes);
      } catch {
        scopes = ['read'];
        logger.warn('Malformed scopes JSON in API key listing', { keyId: row.id });
      }
      return {
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        scopes,
        rateLimit: row.rate_limit,
        isActive: !!row.is_active,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      };
    });
  }

  /**
   * Revoke (deactivate) an API key.
   */
  async revokeKey(userId: string, keyId: string): Promise<void> {
    await apiKeyRepository.revoke(keyId, userId);
  }

  /**
   * Permanently delete an API key.
   */
  async deleteKey(userId: string, keyId: string): Promise<void> {
    await apiKeyRepository.delete(keyId, userId);
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
      apiKeyRepository.logUsage(id, keyId, method, path, statusCode, responseTimeMs, ip)
        .catch((err) => {
          logger.error('Failed to log API key usage', { error: err });
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
    const totalRows = await apiKeyRepository.getUsageTotal(keyId, whereClause, params);

    // Requests by method
    const methodRows = await apiKeyRepository.getUsageByMethod(whereClause, params);

    // Requests by status code
    const statusRows = await apiKeyRepository.getUsageByStatus(whereClause, params);

    const requestsByMethod: Record<string, number> = {};
    for (const row of methodRows) {
      requestsByMethod[row.method] = Number(row.cnt);
    }

    const requestsByStatus: Record<string, number> = {};
    for (const row of statusRows) {
      requestsByStatus[String(row.status_code)] = Number(row.cnt);
    }

    return {
      totalRequests: Number(totalRows.cnt || 0),
      requestsByMethod,
      requestsByStatus,
      avgResponseTime: Number(totalRows.avg_rt || 0),
    };
  }
}

export const apiKeyService = new ApiKeyService();
