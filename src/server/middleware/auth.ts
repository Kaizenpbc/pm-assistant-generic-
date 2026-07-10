import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { apiKeyService } from '../services/ApiKeyService';

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

    request.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };

  } catch (error) {
    return reply.status(401).send({
      error: 'Invalid token',
      message: 'Access token is invalid or expired',
    });
  }
}
