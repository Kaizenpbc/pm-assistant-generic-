// ---------------------------------------------------------------------------
// Request logger hook for Fastify
// ---------------------------------------------------------------------------
// Fastify already uses pino internally (fastify.log), so we do NOT need
// a separate Winston/pino instance.  This file exports a lightweight
// request-level hook and convenience functions that delegate to
// `request.log` (which is the Fastify-managed pino child logger).
// ---------------------------------------------------------------------------

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * onRequest hook — logs every incoming request at debug level.
 * Fastify's built-in logger already logs request/response at info level when
 * `logger: true`, so this only adds extra structured metadata.
 */
export const requestLogger = (
  request: FastifyRequest,
  _reply: FastifyReply,
  done: () => void,
) => {
  request.log.debug(
    {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    },
    'Incoming request',
  );
  done();
};
