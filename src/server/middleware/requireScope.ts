import { FastifyRequest, FastifyReply } from 'fastify';

type Scope = 'read' | 'write' | 'admin';

/**
 * Middleware factory that enforces API key scopes on routes.
 *
 * - JWT session users (no apiKeyScopes) bypass scope checks — they have
 *   full access governed by their role.
 * - API key users must have the required scope in their key's scopes array.
 * - 'admin' scope implies 'write', and 'write' implies 'read'.
 */
export function requireScope(scope: Scope) {
  return async function scopeCheck(request: FastifyRequest, reply: FastifyReply) {
    const scopes: string[] | undefined = (request as any).apiKeyScopes;

    // JWT session user — no scope restrictions
    if (!scopes) return;

    // Check scope hierarchy: admin > write > read
    let allowed = false;
    switch (scope) {
      case 'read':
        allowed = scopes.includes('read') || scopes.includes('write') || scopes.includes('admin');
        break;
      case 'write':
        allowed = scopes.includes('write') || scopes.includes('admin');
        break;
      case 'admin':
        allowed = scopes.includes('admin');
        break;
    }

    if (!allowed) {
      return reply.status(403).send({
        error: 'Insufficient scope',
        message: `This action requires the '${scope}' scope. Your API key has: [${scopes.join(', ')}]`,
      });
    }
  };
}
