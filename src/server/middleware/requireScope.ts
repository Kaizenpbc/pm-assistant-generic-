import { FastifyRequest, FastifyReply } from 'fastify';

type Scope = 'read' | 'write' | 'admin';

/**
 * Maps JWT user roles to equivalent scopes.
 * admin  → read, write, admin
 * manager → read, write
 * member  → read
 */
const ROLE_SCOPES: Record<string, Scope[]> = {
  admin: ['read', 'write', 'admin'],
  executive: ['read'],
  project_manager: ['read', 'write'],
  scrum_master: ['read', 'write'],
  team_member: ['read'],
  finance_officer: ['read'],
  risk_manager: ['read', 'write'],
  pmo: ['read', 'write'],
  ba: ['read', 'write'],
  qa: ['read', 'write'],
  tester: ['read'],
  devops: ['read', 'write'],
  claude_sme: ['read'],
};

/**
 * Middleware factory that enforces scope-based access on routes.
 *
 * - API key users: checked against key's explicit scopes array.
 * - JWT session users: checked against role-derived scopes (admin > manager > member).
 * - 'admin' scope implies 'write', and 'write' implies 'read'.
 */
export function requireScope(scope: Scope) {
  return async function scopeCheck(request: FastifyRequest, reply: FastifyReply) {
    // Determine effective scopes: API key explicit scopes, or role-derived for JWT users
    const scopes: string[] = request.apiKeyScopes
      ?? ROLE_SCOPES[request.user?.role ?? '']
      ?? ['read']; // fallback: read-only if role is unknown

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
      const source = request.apiKeyScopes ? 'API key' : 'role';
      const scopeList = scopes.join(', ');
      return reply.status(403).send({
        error: 'Insufficient scope',
        message: `This action requires the '${scope}' scope. Your ${source} has: [${scopeList}]`,
      });
    }
  };
}
