import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      username: string;
      role: string;
    };
    apiKeyId?: string;
    apiKeyScopes?: string[];
    apiKeyRateLimit?: number | null;
    rawBody?: Buffer;
  }
}
