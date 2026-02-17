// ---------------------------------------------------------------------------
// Logging utilities for PM Assistant
// ---------------------------------------------------------------------------
//
// Provides two logging mechanisms:
//
// 1. requestLogger — Fastify onRequest hook that uses request.log (pino child)
// 2. createServiceLogger — creates a standalone pino logger for services that
//    don't have access to the Fastify instance (singletons, data providers, etc.)
//
// Fastify's built-in logger is pino, so using pino directly for standalone
// loggers ensures consistent JSON-structured output across the entire app.
// ---------------------------------------------------------------------------

import pino from 'pino';
import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

/**
 * Create a named pino logger for services that don't receive a Fastify instance.
 * Output format matches Fastify's built-in pino logger.
 */
export function createServiceLogger(name: string): pino.Logger {
  return pino({
    name,
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  });
}

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
