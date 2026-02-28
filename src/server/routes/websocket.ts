import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocketService } from '../services/WebSocketService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function websocketRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/', { websocket: true, preHandler: [requireScope('read')] }, (socket, _request) => {
    WebSocketService.addClient(socket);

    socket.send(JSON.stringify({
      type: 'connected',
      payload: { message: 'WebSocket connected', clients: WebSocketService.getClientCount() },
    }));
  });
}
