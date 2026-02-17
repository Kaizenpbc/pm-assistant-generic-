import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { WebSocketService } from '../services/WebSocketService';

export async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get('/', { websocket: true }, (socket, request) => {
    // Authenticate the WebSocket upgrade request via JWT cookie
    try {
      const cookieHeader = request.headers.cookie || '';
      const tokenMatch = cookieHeader.match(/access_token=([^;]+)/);
      const token = tokenMatch?.[1];

      if (!token) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Authentication required' } }));
        socket.close(4401, 'Unauthorized');
        return;
      }

      jwt.verify(token, config.JWT_SECRET);
    } catch {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid or expired token' } }));
      socket.close(4401, 'Unauthorized');
      return;
    }

    WebSocketService.addClient(socket);

    socket.send(JSON.stringify({
      type: 'connected',
      payload: { message: 'WebSocket connected', clients: WebSocketService.getClientCount() },
    }));
  });
}
