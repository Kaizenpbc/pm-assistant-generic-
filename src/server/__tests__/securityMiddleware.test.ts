import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp, authCookie } from './helpers';

describe('Security Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // --- Security headers on API routes ---

  describe('Security Headers', () => {
    it('sets X-Content-Type-Options: nosniff on API routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: { cookie: authCookie() },
      });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-Frame-Options: DENY on API routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: { cookie: authCookie() },
      });
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('sets X-Robots-Tag: noindex, nofollow', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: { cookie: authCookie() },
      });
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    });

    it('sets X-Download-Options: noopen', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: { cookie: authCookie() },
      });
      expect(res.headers['x-download-options']).toBe('noopen');
    });
  });

  // --- Cache-Control for auth routes ---

  describe('Cache-Control Headers', () => {
    it('sets no-cache headers on auth routes', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { username: 'admin', password: 'admin123' },
      });
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['pragma']).toBe('no-cache');
    });
  });

  // --- Request ID ---

  describe('Request ID (X-Request-ID)', () => {
    it('generates an X-Request-ID when none is provided', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      const requestId = res.headers['x-request-id'] as string;
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^req-/); // format: req-<uuid>
    });

    it('preserves a client-supplied X-Request-ID', async () => {
      const clientId = 'my-custom-request-id';
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': clientId },
      });
      expect(res.headers['x-request-id']).toBe(clientId);
    });
  });

  // --- CORS headers ---

  describe('CORS', () => {
    it('includes Access-Control-Allow-Origin for configured origin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          cookie: authCookie(),
          origin: 'http://localhost:5174',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
    });

    it('includes Access-Control-Allow-Credentials', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          cookie: authCookie(),
          origin: 'http://localhost:5174',
        },
      });
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does NOT set a wildcard (*) for Access-Control-Allow-Origin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          cookie: authCookie(),
          origin: 'http://localhost:5174',
        },
      });
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  // --- Request validation ---

  describe('Request Validation', () => {
    it('rejects requests exceeding 10 MB', async () => {
      // Create a body just over 10 MB
      const bigBody = JSON.stringify({ data: 'x'.repeat(10 * 1024 * 1024 + 1) });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          cookie: authCookie(),
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(bigBody)),
        },
        payload: bigBody,
      });
      expect(res.statusCode).toBe(413);
    });

    it('rejects POST with non-JSON content type when body is present', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          cookie: authCookie(),
          'content-type': 'text/plain',
          'content-length': '13',
        },
        payload: 'Hello, world!',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid content type');
    });
  });
});
