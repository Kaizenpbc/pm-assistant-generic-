import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { apiKeyService } from '../services/ApiKeyService';
import { databaseService } from '../database/connection';
import { redisService } from '../services/RedisService';

const ACTIVE_CHECK_TTL = 300; // 5 minutes

async function isUserActive(userId: string): Promise<boolean> {
  const cacheKey = `user:active:${userId}`;
  const cached = await redisService.get(cacheKey);
  if (cached !== null) return cached === '1';

  const rows = await databaseService.query<{ is_active: number }>(
    'SELECT is_active FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const active = rows.length > 0 && Boolean(rows[0].is_active);
  redisService.set(cacheKey, active ? '1' : '0', ACTIVE_CHECK_TTL).catch(() => {});
  return active;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Check for Bearer token (API key) first
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7);
    try {
      const keyInfo = await apiKeyService.validateKey(rawKey);
      if (!keyInfo) {
        return reply.status(401).send({
          error: 'Invalid API key',
          message: 'The provided API key is invalid or expired',
        });
      }

      // Check if the API key owner is still active
      const active = await isUserActive(keyInfo.userId);
      if (!active) {
        return reply.status(401).send({
          error: 'Account deactivated',
          message: 'Your account has been deactivated',
        });
      }

      request.user = {
        userId: keyInfo.userId,
        username: 'api-key',
        role: keyInfo.userRole,
      };
      request.apiKeyId = keyInfo.keyId;
      request.apiKeyScopes = keyInfo.scopes;
      request.apiKeyRateLimit = keyInfo.rateLimit;
      return;
    } catch (error) {
      return reply.status(401).send({
        error: 'Invalid API key',
        message: 'Failed to validate API key',
      });
    }
  }

  // Fall through to JWT cookie authentication
  try {
    const token = request.cookies.access_token;

    if (!token) {
      return reply.status(401).send({
        error: 'No access token',
        message: 'Access token is required',
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as any;

    // Check if user is still active (deactivated users rejected even with valid JWT)
    const active = await isUserActive(decoded.userId);
    if (!active) {
      return reply.status(401).send({
        error: 'Account deactivated',
        message: 'Your account has been deactivated',
      });
    }

    request.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };

  } catch (error) {
    if ((error as any)?.error === 'Account deactivated') {
      return reply.status(401).send({
        error: 'Account deactivated',
        message: 'Your account has been deactivated',
      });
    }
    return reply.status(401).send({
      error: 'Invalid token',
      message: 'Access token is invalid or expired',
    });
  }
}
