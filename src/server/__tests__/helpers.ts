/**
 * Shared test helpers — builds a lightweight Fastify instance with
 * the same plugins/routes as production, plus JWT token utilities.
 */
import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { registerPlugins } from '../plugins';
import { registerRoutes } from '../routes';

/**
 * Build a ready-to-inject Fastify instance (never listens on a port).
 * Call `app.close()` in afterAll / afterEach to clean up.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true, // Allows x-forwarded-for to set request.ip in tests
  });
  await registerPlugins(app);
  await registerRoutes(app);
  await app.ready();
  return app;
}

/** Default test user payload used for generating tokens. */
export const TEST_USER = {
  userId: '1',
  username: 'admin',
  role: 'admin' as const,
};

/** Sign a valid access-token JWT for the given user payload. */
export function signAccessToken(
  payload: Record<string, unknown> = TEST_USER,
  options: jwt.SignOptions = { expiresIn: '15m' },
): string {
  return jwt.sign(payload, config.JWT_SECRET, options);
}

/** Return a cookie header string that Fastify.inject understands. */
export function authCookie(token?: string): string {
  const t = token ?? signAccessToken();
  return `access_token=${t}`;
}
