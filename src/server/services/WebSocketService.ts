import { WebSocket } from 'ws';

export interface WSMessage {
  type: 'task_updated' | 'task_created' | 'task_deleted' | 'schedule_updated';
  payload: unknown;
}

interface ClientMeta {
  userId: string;
}

export class WebSocketService {
  private static clients: Map<WebSocket, ClientMeta> = new Map();
  private static readonly MAX_CLIENTS = 1000;
  private static readonly MAX_PER_USER = 10;

  static addClient(ws: WebSocket, userId: string) {
    // Enforce global connection limit
    if (WebSocketService.clients.size >= WebSocketService.MAX_CLIENTS) {
      ws.close(4429, 'Too many connections');
      return;
    }

    // Enforce per-user connection limit
    let userCount = 0;
    for (const meta of WebSocketService.clients.values()) {
      if (meta.userId === userId) userCount++;
    }
    if (userCount >= WebSocketService.MAX_PER_USER) {
      ws.close(4429, 'Too many connections for this user');
      return;
    }

    WebSocketService.clients.set(ws, { userId });

    ws.on('close', () => {
      WebSocketService.clients.delete(ws);
    });

    ws.on('error', () => {
      WebSocketService.clients.delete(ws);
    });
  }

  /**
   * Broadcast a message to all connected clients (backward compatible).
   * Prefer broadcastToUser() for user-scoped messages.
   */
  static broadcast(message: WSMessage) {
    const data = JSON.stringify(message);
    for (const [client] of WebSocketService.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Broadcast a message only to clients belonging to a specific user.
   */
  static broadcastToUser(userId: string, message: WSMessage) {
    const data = JSON.stringify(message);
    for (const [client, meta] of WebSocketService.clients) {
      if (meta.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  static getClientCount(): number {
    return WebSocketService.clients.size;
  }
}
