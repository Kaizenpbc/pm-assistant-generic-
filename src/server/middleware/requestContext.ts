import { AsyncLocalStorage } from 'async_hooks';
import { FastifyRequest, FastifyReply } from 'fastify';

export interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

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
