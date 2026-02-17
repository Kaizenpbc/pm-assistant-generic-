import { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import csrfProtection from '@fastify/csrf-protection';
import websocket from '@fastify/websocket';
import { config } from './config';
import { requestLogger } from './utils/logger';
import { toCamelCaseKeys } from './utils/caseConverter';
import { auditService } from './services/auditService';
import { securityMiddleware, securityValidationMiddleware } from './middleware/securityMiddleware';
import { databaseService } from './database/connection';

export async function registerPlugins(fastify: FastifyInstance) {
  // Decorate Fastify with the database pool so services can access it via fastify.db
  fastify.decorate('db', databaseService);

  await fastify.register(websocket);

  fastify.addHook('onRequest', requestLogger);
  fastify.addHook('onRequest', securityMiddleware);
  fastify.addHook('preHandler', securityValidationMiddleware);

  // Normalize DB snake_case keys to camelCase in all JSON responses
  fastify.addHook('preSerialization', async (_request, _reply, payload) => {
    if (payload && typeof payload === 'object') {
      return toCamelCaseKeys(payload);
    }
    return payload;
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: [
          "'self'",
          ...(config.NODE_ENV === 'development' ? ["'unsafe-eval'", "'unsafe-inline'"] : [])
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          ...(config.NODE_ENV === 'development' ? [
            "http://localhost:3001", "ws://localhost:3001", "wss://localhost:3001"
          ] : [])
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
      reportOnly: config.NODE_ENV === 'development'
    },
    hsts: config.NODE_ENV === 'production' ? {
      maxAge: 31536000, includeSubDomains: true, preload: true
    } : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hidePoweredBy: true,
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
        return callback(null, true);
      }
      if (origin === config.CORS_ORIGIN) return callback(null, true);
      if (config.NODE_ENV === 'development') return callback(null, true);
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-user-role', 'x-user-id', 'x-csrf-token'],
  });

  await fastify.register(cookie, {
    secret: config.COOKIE_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  });

  // CSRF protection — requires cookie plugin to be registered first
  await fastify.register(csrfProtection, {
    sessionPlugin: '@fastify/cookie',
    cookieOpts: {
      signed: true,
      httpOnly: true,
      sameSite: 'strict',
      secure: config.NODE_ENV === 'production',
      path: '/',
    },
    getToken: (request) => {
      // Accept token from header (preferred for SPA) or body
      return request.headers['x-csrf-token'] as string
        || (request.body as any)?.['_csrf'] as string;
    },
  });

  // Expose CSRF token endpoint for SPA clients
  fastify.get('/api/v1/csrf-token', async (request, reply) => {
    const token = reply.generateCsrf();
    return { csrfToken: token };
  });

  // Rate limiting — protect against brute force and API abuse
  await fastify.register(rateLimit, {
    max: 100,               // 100 requests per window
    timeWindow: '1 minute',
    // No allowList — rate-limit all IPs equally (including localhost behind proxy)
    keyGenerator: (request) => {
      // Use authenticated userId if available, otherwise IP
      const user = (request as any).user;
      return user?.userId || request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry in ${Math.ceil(context.ttl / 1000)} seconds.`,
    }),
  });

  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'PM Assistant API',
        description: 'AI-Powered Project Management API',
        version: '1.0.0',
      },
      host: `${config.HOST}:${config.PORT}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: { docExpansion: 'list', deepLinking: false },
    staticCSP: true,
    transformSpecificationClone: true,
  });

  fastify.setErrorHandler(async (err: unknown, request, reply) => {
    const error = err instanceof Error ? err : new Error(String(err));
    // Fastify plugins (rate-limit, auth) set statusCode on the error object
    const statusCode = (err as { statusCode?: number }).statusCode
      ?? (error as { statusCode?: number }).statusCode
      ?? 500;
    fastify.log.error({ err: error, url: request.url, method: request.method }, 'Global error handler');

    auditService.logSystemEvent(request, 'error', {
      error: error.message, url: request.url, method: request.method
    });

    // In production, never leak raw error messages for server errors
    const isProduction = config.NODE_ENV === 'production';
    const safeMessage = statusCode >= 500 && isProduction
      ? 'Internal Server Error'
      : error.message;

    reply.status(statusCode).send({
      statusCode,
      error: statusCode >= 500 ? 'Internal Server Error' : error.name || 'Error',
      message: safeMessage,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  });

  fastify.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      timestamp: new Date().toISOString()
    });
  });

  // ---------------------------------------------------------------------------
  // Health & Readiness endpoints
  // ---------------------------------------------------------------------------

  // Liveness probe — always returns OK if the process is running
  fastify.get('/health', async (_request, reply) => {
    reply.send({
      status: 'OK',
      service: 'PM Assistant Generic',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
    });
  });

  // Readiness probe — checks all subsystems
  fastify.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; detail?: string }> = {};

    // Database check
    const dbStart = Date.now();
    try {
      const connected = await databaseService.testConnection();
      checks.database = {
        status: connected ? 'up' : 'down',
        latencyMs: Date.now() - dbStart,
      };
    } catch (err) {
      checks.database = {
        status: 'down',
        latencyMs: Date.now() - dbStart,
        detail: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    // Claude AI check
    const { claudeService } = await import('./services/claudeService');
    checks.ai = {
      status: claudeService.isAvailable() ? 'up' : 'down',
      detail: claudeService.isAvailable() ? undefined : 'ANTHROPIC_API_KEY not configured',
    };

    // Memory check (warn if RSS > 512MB)
    const memUsage = process.memoryUsage();
    const rssBytes = memUsage.rss;
    const heapUsedBytes = memUsage.heapUsed;
    const heapTotalBytes = memUsage.heapTotal;
    const RSS_WARNING_BYTES = 512 * 1024 * 1024;
    checks.memory = {
      status: rssBytes < RSS_WARNING_BYTES ? 'up' : 'down',
      detail: `RSS: ${(rssBytes / 1024 / 1024).toFixed(1)}MB, Heap: ${(heapUsedBytes / 1024 / 1024).toFixed(1)}/${(heapTotalBytes / 1024 / 1024).toFixed(1)}MB`,
    };

    const allUp = Object.values(checks).every((c) => c.status === 'up');
    const statusCode = allUp ? 200 : 503;

    reply.status(statusCode).send({
      status: allUp ? 'OK' : 'DEGRADED',
      service: 'PM Assistant Generic',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      checks,
    });
  });

  // Basic metrics endpoint (lightweight, no external dependencies)
  fastify.get('/health/metrics', async (_request, reply) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    reply.send({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        externalBytes: mem.external,
        arrayBuffersBytes: mem.arrayBuffers,
      },
      cpu: {
        userMicroseconds: cpu.user,
        systemMicroseconds: cpu.system,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  });
}
