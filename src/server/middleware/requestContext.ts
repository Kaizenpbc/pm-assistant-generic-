import { AsyncLocalStorage } from 'async_hooks';
import { FastifyRequest, FastifyReply } from 'fastify';

export interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
  tenantDbName?: string;
  organizationId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

export function getTenantContext(): { dbName: string; orgId: string } | undefined {
  const ctx = asyncLocalStorage.getStore();
  if (ctx?.tenantDbName && ctx?.organizationId) {
    return { dbName: ctx.tenantDbName, orgId: ctx.organizationId };
  }
  return undefined;
}

export function runWithTenantContext<T>(
  dbName: string,
  orgId: string,
  callback: () => T | Promise<T>,
): Promise<T> {
  const context: RequestContext = {
    requestId: `tenant-${orgId}-${Date.now()}`,
    startTime: Date.now(),
    tenantDbName: dbName,
    organizationId: orgId,
  };
  return asyncLocalStorage.run(context, async () => callback());
}

export { asyncLocalStorage };

export async function requestContextHook(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const requestId = (request.headers['x-request-id'] as string) || `req-${crypto.randomUUID()}`;
  const userId = request.user?.userId;

  const context: RequestContext = {
    requestId,
    userId,
    startTime: Date.now(),
  };

  // Enter the async local storage context for the rest of the request lifecycle
  asyncLocalStorage.enterWith(context);
}
