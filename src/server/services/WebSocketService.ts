import { WebSocket } from 'ws';

export interface WSMessage {
  type: 'task_updated' | 'task_created' | 'task_deleted' | 'schedule_updated';
  payload: unknown;
}

export class WebSocketService {
  private static clients: Set<WebSocket> = new Set();

  static addClient(ws: WebSocket) {
    WebSocketService.clients.add(ws);

    ws.on('close', () => {
      WebSocketService.clients.delete(ws);
    });

    ws.on('error', () => {
      WebSocketService.clients.delete(ws);
    });
  }

  static broadcast(message: WSMessage) {
    const data = JSON.stringify(message);
    for (const client of WebSocketService.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  static getClientCount(): number {
    return WebSocketService.clients.size;
  }
}
