import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { WebSocketService } from '../services/WebSocketService';

/** Parse a Cookie header string into key-value pairs (handles URL-encoded values). */
function parseCookieHeader(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

export async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get('/', { websocket: true }, (socket, request) => {
    // Authenticate the WebSocket upgrade request via JWT cookie
    try {
      const cookieHeader = request.headers.cookie || '';
      const cookies = parseCookieHeader(cookieHeader);
      const token = cookies['access_token'];

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
