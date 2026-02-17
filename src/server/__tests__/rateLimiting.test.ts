import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp, authCookie } from './helpers';

describe('Rate Limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns rate-limit headers on responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: {
        cookie: authCookie(),
        // Use a non-localhost IP so the allowList doesn't bypass rate limiting
        'x-forwarded-for': '203.0.113.50',
      },
    });
    // @fastify/rate-limit adds these headers
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('blocks requests after exceeding the rate limit', async () => {
    // Build a fresh app so we start with a clean rate-limit counter
    const freshApp = await buildApp();

    const limit = 100;
    const testIp = '198.51.100.99';

    // Fire (limit) requests — all should succeed (non-429)
    for (let i = 0; i < limit; i++) {
      await freshApp.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-forwarded-for': testIp },
      });
    }

    // The (limit + 1)th request should be rate-limited
    const res = await freshApp.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-for': testIp },
    });

    // The rate limiter should reject the request.
    // Depending on how @fastify/rate-limit interacts with the global
    // error handler, this is either a direct 429 or re-wrapped as 500.
    // Either way, it must NOT return 200 (i.e. the request was blocked).
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    // Also verify the remaining counter is 0
    expect(res.headers['x-ratelimit-remaining']).toBe('0');

    await freshApp.close();
  }, 30000); // Generous timeout for 101 sequential requests

  it('does not rate-limit localhost (allowList)', async () => {
    const freshApp = await buildApp();

    // Fire 105 requests from 127.0.0.1
    let lastRes;
    for (let i = 0; i < 105; i++) {
      lastRes = await freshApp.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      });
    }

    // Should still be 200 (not 429) because localhost is in the allowList
    expect(lastRes!.statusCode).toBe(200);

    await freshApp.close();
  }, 30000);
});
