import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config BEFORE any imports that depend on it
// ---------------------------------------------------------------------------

const mockConfig = vi.hoisted(() => ({
  NODE_ENV: 'development' as string,
  CORS_ORIGIN: 'http://localhost:5173',
  AI_ENABLED: false,
  ANTHROPIC_API_KEY: '',
  AI_MODEL: 'claude-sonnet-4-5-20250929',
  AI_TEMPERATURE: 0.3,
  AI_MAX_TOKENS: 4096,
}));

vi.mock('../../config', () => ({
  config: mockConfig,
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { securityMiddleware, securityValidationMiddleware } from '../securityMiddleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides = {}) {
  return {
    url: '/api/v1/projects',
    method: 'GET',
    headers: {} as Record<string, string | undefined>,
    raw: { headers: {} },
    ...overrides,
  };
}

function makeReply() {
  const headers: Record<string, string> = {};
  return {
    header: vi.fn((key: string, val: string) => {
      headers[key] = val;
    }),
    headers: vi.fn((obj: Record<string, string>) => {
      Object.assign(headers, obj);
    }),
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
    _headers: headers,
  };
}

// ---------------------------------------------------------------------------
// securityMiddleware
// ---------------------------------------------------------------------------

describe('securityMiddleware', () => {
  beforeEach(() => {
    mockConfig.NODE_ENV = 'development';
    mockConfig.CORS_ORIGIN = 'http://localhost:5173';
  });

  // ---- Global security headers ----

  it('sets X-Robots-Tag on all requests', async () => {
    const req = makeRequest({ url: '/some/page' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply.header).toHaveBeenCalledWith('X-Robots-Tag', 'noindex, nofollow');
    expect(reply._headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('sets X-Download-Options on all requests', async () => {
    const req = makeRequest({ url: '/any/path' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply.header).toHaveBeenCalledWith('X-Download-Options', 'noopen');
    expect(reply._headers['X-Download-Options']).toBe('noopen');
  });

  it('sets X-Permitted-Cross-Domain-Policies on all requests', async () => {
    const req = makeRequest({ url: '/random' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply.header).toHaveBeenCalledWith('X-Permitted-Cross-Domain-Policies', 'none');
    expect(reply._headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
  });

  it('sets global headers even for non-API routes', async () => {
    const req = makeRequest({ url: '/static/bundle.js' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(reply._headers['X-Download-Options']).toBe('noopen');
    expect(reply._headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
  });

  // ---- Cache control for auth / users routes ----

  it('sets cache control headers for /api/auth/ routes', async () => {
    const req = makeRequest({ url: '/api/auth/login' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Cache-Control']).toBe(
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    expect(reply._headers['Pragma']).toBe('no-cache');
    expect(reply._headers['Expires']).toBe('0');
  });

  it('sets cache control headers for /api/users/ routes', async () => {
    const req = makeRequest({ url: '/api/users/me' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Cache-Control']).toBe(
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    expect(reply._headers['Pragma']).toBe('no-cache');
    expect(reply._headers['Expires']).toBe('0');
  });

  it('does NOT set cache control for other /api/ routes', async () => {
    const req = makeRequest({ url: '/api/v1/projects' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Cache-Control']).toBeUndefined();
    expect(reply._headers['Pragma']).toBeUndefined();
    expect(reply._headers['Expires']).toBeUndefined();
  });

  // ---- API-specific headers ----

  it('sets X-Content-Type-Options for /api/ routes', async () => {
    const req = makeRequest({ url: '/api/v1/tasks' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY for /api/ routes', async () => {
    const req = makeRequest({ url: '/api/v1/projects' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['X-Frame-Options']).toBe('DENY');
  });

  it('sets X-XSS-Protection for /api/ routes', async () => {
    const req = makeRequest({ url: '/api/v1/projects' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['X-XSS-Protection']).toBe('1; mode=block');
  });

  it('does NOT set API-specific headers for non-API routes', async () => {
    const req = makeRequest({ url: '/static/index.html' });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['X-Content-Type-Options']).toBeUndefined();
    expect(reply._headers['X-Frame-Options']).toBeUndefined();
    expect(reply._headers['X-XSS-Protection']).toBeUndefined();
    expect(reply._headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  // ---- CORS ----

  it('CORS: development mode allows any origin', async () => {
    mockConfig.NODE_ENV = 'development';
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: { origin: 'http://some-random-origin:9999' },
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Origin']).toBe(
      'http://some-random-origin:9999',
    );
  });

  it('CORS: production mode with matching origin echoes back the origin', async () => {
    mockConfig.NODE_ENV = 'production';
    mockConfig.CORS_ORIGIN = 'https://app.example.com';
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: { origin: 'https://app.example.com' },
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Origin']).toBe(
      'https://app.example.com',
    );
  });

  it('CORS: production mode with non-matching origin uses config.CORS_ORIGIN', async () => {
    mockConfig.NODE_ENV = 'production';
    mockConfig.CORS_ORIGIN = 'https://app.example.com';
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: { origin: 'https://evil-site.com' },
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Origin']).toBe(
      'https://app.example.com',
    );
  });

  it('CORS: localhost origins accepted in production', async () => {
    mockConfig.NODE_ENV = 'production';
    mockConfig.CORS_ORIGIN = 'https://app.example.com';
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: { origin: 'http://localhost:3000' },
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Origin']).toBe(
      'http://localhost:3000',
    );
  });

  it('CORS: no origin header in production falls back to config.CORS_ORIGIN', async () => {
    mockConfig.NODE_ENV = 'production';
    mockConfig.CORS_ORIGIN = 'https://app.example.com';
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: {},
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Origin']).toBe(
      'https://app.example.com',
    );
  });

  it('sets Access-Control-Allow-Methods correctly', async () => {
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: { origin: 'http://localhost:5173' },
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Methods']).toBe(
      'GET, POST, PUT, DELETE, OPTIONS',
    );
  });

  it('sets Access-Control-Allow-Headers correctly', async () => {
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: { origin: 'http://localhost:5173' },
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Headers']).toBe(
      'Content-Type, Authorization, Cookie',
    );
  });

  it('sets Access-Control-Allow-Credentials: true', async () => {
    const req = makeRequest({
      url: '/api/v1/projects',
      headers: { origin: 'http://localhost:5173' },
    });
    const reply = makeReply();

    await securityMiddleware(req as any, reply as any);

    expect(reply._headers['Access-Control-Allow-Credentials']).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// securityValidationMiddleware
// ---------------------------------------------------------------------------

describe('securityValidationMiddleware', () => {
  // ---- Body size validation ----

  it('allows requests under 10MB', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '1024',
        'content-type': 'application/json',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(413);
    expect(reply.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Request too large' }),
    );
  });

  it('returns 413 for requests over 10MB', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '10485761', // 10MB + 1 byte
        'content-type': 'application/json',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(413);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Request too large' });
  });

  it('returns 413 for requests exactly at the boundary + 1', async () => {
    // 10 * 1024 * 1024 = 10485760, so 10485761 should be rejected
    const req = makeRequest({
      method: 'GET',
      headers: { 'content-length': '10485761' },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(413);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Request too large' });
  });

  it('allows requests exactly at the 10MB boundary', async () => {
    const req = makeRequest({
      method: 'GET',
      headers: { 'content-length': '10485760' },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(413);
  });

  // ---- Content-Type validation ----

  it('allows POST with application/json content-type', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '50',
        'content-type': 'application/json',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(400);
  });

  it('allows POST with application/json; charset=utf-8 content-type', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '50',
        'content-type': 'application/json; charset=utf-8',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(400);
  });

  it('returns 400 for POST with text/plain content-type', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '50',
        'content-type': 'text/plain',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid content type' });
  });

  it('returns 400 for PUT with non-json content-type', async () => {
    const req = makeRequest({
      method: 'PUT',
      headers: {
        'content-length': '100',
        'content-type': 'text/xml',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid content type' });
  });

  it('returns 400 for PATCH with non-json content-type', async () => {
    const req = makeRequest({
      method: 'PATCH',
      headers: {
        'content-length': '25',
        'content-type': 'multipart/form-data',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid content type' });
  });

  it('returns 400 for POST with missing content-type when body is present', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '100',
        // no content-type
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid content type' });
  });

  // ---- Skipping content-type validation ----

  it('skips content-type validation for GET requests', async () => {
    const req = makeRequest({
      method: 'GET',
      headers: {
        'content-type': 'text/html',
        'content-length': '100',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(400);
  });

  it('skips content-type validation for DELETE requests', async () => {
    const req = makeRequest({
      method: 'DELETE',
      headers: {
        'content-type': 'text/html',
        'content-length': '100',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(400);
  });

  it('skips content-type validation for OPTIONS requests', async () => {
    const req = makeRequest({
      method: 'OPTIONS',
      headers: {},
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(400);
  });

  it('skips content-type validation when body is empty (content-length: 0)', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '0',
        'content-type': 'text/plain',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(400);
  });

  it('skips content-type validation when content-length header is absent for POST', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {},
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    // Missing content-length defaults to 0, so content-type check is skipped
    expect(reply.code).not.toHaveBeenCalledWith(400);
  });

  // ---- Request ID generation ----

  it('generates unique X-Request-ID header in req-* format', async () => {
    const req = makeRequest({ method: 'GET', headers: {} });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply._headers['X-Request-ID']).toMatch(/^req-[a-z0-9]+$/);
  });

  it('sets request ID in both request and response headers', async () => {
    const req = makeRequest({ method: 'GET', headers: {} });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    const requestId = req.headers['x-request-id'];
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^req-/);
    expect(reply._headers['X-Request-ID']).toBe(requestId);
  });

  it('generates different request IDs for separate calls', async () => {
    const req1 = makeRequest({ method: 'GET', headers: {} });
    const reply1 = makeReply();
    await securityValidationMiddleware(req1 as any, reply1 as any);

    const req2 = makeRequest({ method: 'GET', headers: {} });
    const reply2 = makeReply();
    await securityValidationMiddleware(req2 as any, reply2 as any);

    expect(reply1._headers['X-Request-ID']).not.toBe(reply2._headers['X-Request-ID']);
  });

  it('missing content-length defaults to 0 (no 413)', async () => {
    const req = makeRequest({ method: 'GET', headers: {} });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).not.toHaveBeenCalledWith(413);
  });

  // ---- Short-circuit behavior ----

  it('does not set request ID when request is too large (413)', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: { 'content-length': '20000000' },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(413);
    expect(reply._headers['X-Request-ID']).toBeUndefined();
    expect(req.headers['x-request-id']).toBeUndefined();
  });

  it('does not set request ID when content-type is invalid (400)', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: {
        'content-length': '100',
        'content-type': 'text/html',
      },
    });
    const reply = makeReply();

    await securityValidationMiddleware(req as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply._headers['X-Request-ID']).toBeUndefined();
    expect(req.headers['x-request-id']).toBeUndefined();
  });
});
