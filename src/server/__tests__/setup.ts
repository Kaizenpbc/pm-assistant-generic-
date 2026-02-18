/**
 * Vitest global setup — sets environment variables required by config.ts
 * before any test modules are imported.
 */

// These must be set BEFORE config.ts is first imported (Zod validation runs at import time)
process.env['NODE_ENV'] = 'test';
process.env['DB_PASSWORD'] = 'rootpassword'; // SECURITY: dev/test-only seed password
process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-at-least-32-chars-long!!';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-at-least-32-chars!!';
process.env['COOKIE_SECRET'] = 'test-cookie-secret-at-least-32-characters!!';
process.env['CORS_ORIGIN'] = 'http://localhost:5174';
process.env['LOG_LEVEL'] = 'error'; // Keep test output clean
process.env['AI_ENABLED'] = 'false';
