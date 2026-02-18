import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp, authCookie } from './helpers';

/**
 * Verifies that every protected API prefix rejects unauthenticated requests
 * with 401 and accepts authenticated ones (non-401).
 *
 * We test a representative endpoint per route group — using the actual URL
 * pattern each module registers. This is an integration smoke test that
 * proves authMiddleware is wired up on each route module.
 */
describe('Route Authentication — Protected Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // Each entry: [label, method, url]
  // URLs must match the actual route patterns registered by each module
  const protectedRoutes: [string, 'GET' | 'POST' | 'PUT' | 'DELETE', string][] = [
    ['projects',              'GET',  '/api/v1/projects'],
    ['projects/:id',          'GET',  '/api/v1/projects/1'],
    ['users/me',              'GET',  '/api/v1/users/me'],
    ['schedules',             'GET',  '/api/v1/schedules/project/test-project-1'],
    ['alerts',                'GET',  '/api/v1/alerts'],
    ['predictions/dashboard', 'GET',  '/api/v1/predictions/dashboard'],
    ['learning',              'POST', '/api/v1/learning/feedback'],
    ['intelligence',          'GET',  '/api/v1/intelligence/anomalies'],
    ['resources',             'GET',  '/api/v1/resources'],
    ['exports',               'GET',  '/api/v1/exports/projects/1/export'],
    ['portfolio',             'GET',  '/api/v1/portfolio'],
    ['workflows',             'GET',  '/api/v1/workflows'],
    ['audit',                 'GET',  '/api/v1/audit/test-project-1'],
    ['evm-forecast',          'GET',  '/api/v1/evm-forecast/1'],
    ['auto-reschedule',       'GET',  '/api/v1/auto-reschedule/1/delays'],
    ['resource-optimizer',    'GET',  '/api/v1/resource-optimizer/1/forecast'],
    ['lessons-learned',       'GET',  '/api/v1/lessons-learned/knowledge-base'],
    ['templates',             'GET',  '/api/v1/templates'],
    ['task-prioritization',   'GET',  '/api/v1/task-prioritization/1/1/prioritize'],
  ];

  describe.each(protectedRoutes)(
    '%s (%s %s)',
    (_label, method, url) => {
      it('returns 401 without auth cookie', async () => {
        const res = await app.inject({
          method,
          url,
          ...(method === 'POST' ? {
            headers: { 'content-type': 'application/json' },
            payload: {},
          } : {}),
        });
        expect(res.statusCode).toBe(401);
      });

      it('does not return 401 with valid auth cookie', async () => {
        const res = await app.inject({
          method,
          url,
          headers: {
            cookie: authCookie(),
            ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
          },
          ...(method === 'POST' ? { payload: {} } : {}),
        });
        // The handler may return 200, 404, 500, etc. depending on
        // whether the service finds data — but it must NOT be 401.
        expect(res.statusCode).not.toBe(401);
      });
    },
  );
});
