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

  // Close DB pool when Fastify shuts down — registered early so it runs AFTER
  // all other onClose hooks (LIFO order), ensuring in-flight requests can still
  // use the database during drain.
  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Closing database connection pool...');
    try {
      await databaseService.close();
      instance.log.info('Database connection pool closed');
    } catch (err) {
      instance.log.error({ err }, 'Error closing database connection pool');
    }
  });

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

  // Permissions-Policy — disable browser features not needed by this application
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // Only allow localhost origins in development/test — NOT in production
      if (config.NODE_ENV !== 'production' &&
          (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'))) {
        return callback(null, true);
      }
      if (origin === config.CORS_ORIGIN) return callback(null, true);
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-csrf-token'],
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

  // CSRF enforcement — validate token on all mutating requests that have a session.
  // Skip for: safe methods (GET/HEAD/OPTIONS), auth routes (login/register — no session yet),
  // health checks, WebSocket upgrades, and requests with no CSRF cookie (pre-auth state).
  // Use a Set with exact-match on the pathname (strip query string) to prevent
  // prefix-based bypass (e.g. /api/v1/auth/login-history would bypass CSRF if using startsWith).
  const CSRF_EXEMPT_PATHS = new Set([
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/logout',
    '/api/v1/auth/forgot-password',
    '/api/v1/csrf-token',
  ]);
  fastify.addHook('onRequest', async (request, reply) => {
    const method = request.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
    // Use pathname without query string for exact match
    const pathname = request.url.split('?')[0];
    if (CSRF_EXEMPT_PATHS.has(pathname)) return;
    if (pathname.startsWith('/health')) return;
    if (request.headers.upgrade?.toLowerCase() === 'websocket') return;
    // Enforce CSRF when the request has both session (access_token) AND a CSRF cookie (_csrf).
    // If only access_token is present (client hasn't fetched /csrf-token yet), skip —
    // the client will get a CSRF token on next GET. This prevents breaking clients that
    // have an auth cookie but haven't established a CSRF session yet.
    const cookieHeader = request.headers.cookie || '';
    if (!cookieHeader.includes('access_token') || !cookieHeader.includes('_csrf')) return;
    // csrfProtection uses callback-style (req, reply, next) — wrap in a Promise
    await new Promise<void>((resolve, reject) => {
      (fastify as any).csrfProtection(request, reply, (err: Error | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
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

  // Only expose Swagger/API docs in non-production environments
  if (config.NODE_ENV !== 'production') {
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
  }

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
      path: request.url.split('?')[0]
    });
  });

  fastify.setNotFoundHandler(async (_request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'The requested resource was not found',
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
  // In production, return only up/down status without operational details
  fastify.get('/health/ready', async (_request, reply) => {
    const isProduction = config.NODE_ENV === 'production';
    const checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; detail?: string }> = {};

    // Database check
    const dbStart = Date.now();
    try {
      const connected = await databaseService.testConnection();
      checks.database = {
        status: connected ? 'up' : 'down',
        ...(isProduction ? {} : { latencyMs: Date.now() - dbStart }),
      };
    } catch (err) {
      checks.database = {
        status: 'down',
        ...(isProduction ? {} : {
          latencyMs: Date.now() - dbStart,
          detail: err instanceof Error ? err.message : 'Unknown error',
        }),
      };
    }

    // Claude AI check — only expose in non-production
    if (!isProduction) {
      const { claudeService } = await import('./services/claudeService');
      checks.ai = {
        status: claudeService.isAvailable() ? 'up' : 'down',
        detail: claudeService.isAvailable() ? undefined : 'ANTHROPIC_API_KEY not configured',
      };
    }

    // Memory check (warn if RSS > 512MB) — only expose in non-production
    if (!isProduction) {
      const memUsage = process.memoryUsage();
      const rssBytes = memUsage.rss;
      const heapUsedBytes = memUsage.heapUsed;
      const heapTotalBytes = memUsage.heapTotal;
      const RSS_WARNING_BYTES = 512 * 1024 * 1024;
      checks.memory = {
        status: rssBytes < RSS_WARNING_BYTES ? 'up' : 'down',
        detail: `RSS: ${(rssBytes / 1024 / 1024).toFixed(1)}MB, Heap: ${(heapUsedBytes / 1024 / 1024).toFixed(1)}/${(heapTotalBytes / 1024 / 1024).toFixed(1)}MB`,
      };
    }

    const allUp = Object.values(checks).every((c) => c.status === 'up');
    const statusCode = allUp ? 200 : 503;

    reply.status(statusCode).send({
      status: allUp ? 'OK' : 'DEGRADED',
      service: 'PM Assistant Generic',
      timestamp: new Date().toISOString(),
      ...(isProduction ? {} : {
        version: '1.0.0',
        uptime: process.uptime(),
        environment: config.NODE_ENV,
      }),
      checks,
    });
  });

  // Metrics endpoint — only expose in non-production; production returns 404
  fastify.get('/health/metrics', async (_request, reply) => {
    if (config.NODE_ENV === 'production') {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'The requested resource was not found',
      });
    }

    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    reply.send({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
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
