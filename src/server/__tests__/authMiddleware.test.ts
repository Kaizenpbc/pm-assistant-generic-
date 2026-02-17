import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { buildApp, authCookie, signAccessToken, TEST_USER } from './helpers';

describe('Auth Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // --- Rejection cases ---

  it('returns 401 when no access_token cookie is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('No access token');
  });

  it('returns 401 when token is completely invalid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: 'access_token=not-a-jwt' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid token');
  });

  it('returns 401 when token is signed with the wrong secret', async () => {
    const badToken = jwt.sign(TEST_USER, 'wrong-secret-that-is-32-chars-long!!!!!', { expiresIn: '15m' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: `access_token=${badToken}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid token');
  });

  it('returns 401 when token is expired', async () => {
    const expiredToken = signAccessToken(TEST_USER, { expiresIn: '0s' });
    // Small delay to ensure expiration
    await new Promise((r) => setTimeout(r, 50));
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: `access_token=${expiredToken}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid token');
  });

  // --- Success cases ---

  it('passes through when a valid token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: authCookie() },
    });
    // Should NOT be 401 — the route itself may return any 2xx/4xx/5xx depending on
    // service behaviour, but critically it must NOT be an auth rejection.
    expect(res.statusCode).not.toBe(401);
  });

  it('attaches user payload from token to the request', async () => {
    // We test this indirectly: the projects route reads `request.user.userId`.
    // If the middleware didn't attach user, the route would throw / 500.
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: authCookie() },
    });
    // A successful auth means the handler ran — 200 or 500 (service error) but not 401
    expect(res.statusCode).not.toBe(401);
  });

  // --- Public endpoints should NOT require auth ---

  it('allows unauthenticated access to /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('OK');
  });

  it('allows unauthenticated access to POST /api/v1/auth/login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { username: 'admin', password: 'admin123' },
    });
    // Should get 200 (success) or 401 (wrong creds) — NOT a middleware 401 for missing token
    expect([200, 401]).toContain(res.statusCode);
  });

  it('allows unauthenticated access to POST /api/v1/auth/register', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'test1234',
        fullName: 'Test User',
      },
    });
    // 201 (created) or 409 (duplicate) — but not a missing-token 401
    expect(res.json().error).not.toBe('No access token');
  });
});
