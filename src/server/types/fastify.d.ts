import 'fastify';
import { ServiceContainer } from '../container';
import { ProjectMember } from '../database/ProjectMemberRepository';

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
    projectMembership?: ProjectMember;
    tenantOrg?: {
      id: string;
      slug: string;
      dbName: string;
    };
  }

  interface FastifyInstance {
    services: ServiceContainer;
  }
}
