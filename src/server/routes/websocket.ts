import { FastifyInstance } from 'fastify';
import { WebSocketService } from '../services/WebSocketService';

export async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get('/', { websocket: true }, (socket, _request) => {
    WebSocketService.addClient(socket);

    socket.send(JSON.stringify({
      type: 'connected',
      payload: { message: 'WebSocket connected', clients: WebSocketService.getClientCount() },
    }));
  });
}
