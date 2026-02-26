import path from 'path';
import { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { config } from './config';
import { requestLogger } from './utils/logger';
import { toCamelCaseKeys } from './utils/caseConverter';
import { auditService } from './services/auditService';
import { securityMiddleware, securityValidationMiddleware } from './middleware/securityMiddleware';

export async function registerPlugins(fastify: FastifyInstance) {
  await fastify.register(websocket);

  fastify.addHook('onRequest', requestLogger);
  fastify.addHook('onRequest', securityMiddleware);
  fastify.addHook('preHandler', securityValidationMiddleware);

  // Normalize DB snake_case keys to camelCase in JSON API responses only
  fastify.addHook('preSerialization', async (request, _reply, payload) => {
    if (request.url.startsWith('/api/') && payload && typeof payload === 'object') {
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
          ...(config.NODE_ENV === 'development' ? ["'unsafe-eval'", "'unsafe-inline'"] : ["'unsafe-inline'"])
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          ...(config.NODE_ENV === 'development' ? [
            "http://localhost:3001", "ws://localhost:3001", "wss://localhost:3001"
          ] : [
            "wss:",
          ])
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
      reportOnly: true
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-user-role', 'x-user-id'],
  });

  await fastify.register(cookie, {
    secret: config.COOKIE_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
    },
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
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    console.error('Global error handler:', error);

    auditService.logSystemEvent(request, 'error', {
      error: error.message, url: request.url, method: request.method
    });

    reply.status(statusCode).send({
      statusCode,
      error: statusCode === 500 ? 'Internal Server Error' : error.name || 'Error',
      message: statusCode === 500 ? 'Internal Server Error' : error.message,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  });

  // Serve static client build in production
  if (config.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '..', '..', 'src', 'client', 'dist');
    await fastify.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: serve index.html for non-API routes
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/documentation')) {
        reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Route ${request.method}:${request.url} not found`,
          timestamp: new Date().toISOString()
        });
      } else {
        return reply.sendFile('index.html');
      }
    });
  } else {
    fastify.setNotFoundHandler(async (request, reply) => {
      reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Route ${request.method}:${request.url} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  fastify.get('/health', async (_request, reply) => {
    reply.send({
      status: 'OK',
      service: 'PM Assistant Generic',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV
    });
  });
}
