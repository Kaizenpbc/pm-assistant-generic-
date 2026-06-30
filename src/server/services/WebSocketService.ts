import { WebSocket } from 'ws';

export interface WSMessage {
  type: 'task_updated' | 'task_created' | 'task_deleted' | 'schedule_updated' | 'notification' | 'presence_update';
  payload: unknown;
}

interface ClientInfo {
  userId: string;
  username: string;
  projectId: string | null;
}

export class WebSocketService {
  private static clients: Set<WebSocket> = new Set();
  private static clientInfo: Map<WebSocket, ClientInfo> = new Map();

  static addClient(ws: WebSocket, userInfo?: { userId: string; username: string }) {
    WebSocketService.clients.add(ws);

    if (userInfo) {
      WebSocketService.clientInfo.set(ws, {
        userId: userInfo.userId,
        username: userInfo.username,
        projectId: null,
      });
    }

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
        if (msg.type === 'presence:join' && typeof msg.projectId === 'string') {
          const info = WebSocketService.clientInfo.get(ws);
          if (info) {
            const oldProjectId = info.projectId;
            info.projectId = msg.projectId;
            // Broadcast to old project (someone left) and new project (someone joined)
            if (oldProjectId && oldProjectId !== msg.projectId) {
              WebSocketService.broadcastPresence(oldProjectId);
            }
            WebSocketService.broadcastPresence(msg.projectId);
          }
        } else if (msg.type === 'presence:leave') {
          const info = WebSocketService.clientInfo.get(ws);
          if (info && info.projectId) {
            const projectId = info.projectId;
            info.projectId = null;
            WebSocketService.broadcastPresence(projectId);
          }
        }
      } catch { /* ignore non-JSON messages */ }
    });

    ws.on('close', () => {
      const info = WebSocketService.clientInfo.get(ws);
      const projectId = info?.projectId;
      WebSocketService.clients.delete(ws);
      WebSocketService.clientInfo.delete(ws);
      if (projectId) {
        WebSocketService.broadcastPresence(projectId);
      }
    });

    ws.on('error', () => {
      const info = WebSocketService.clientInfo.get(ws);
      const projectId = info?.projectId;
      WebSocketService.clients.delete(ws);
      WebSocketService.clientInfo.delete(ws);
      if (projectId) {
        WebSocketService.broadcastPresence(projectId);
      }
    });
  }

  static broadcastPresence(projectId: string) {
    // Collect unique viewers for this project
    const viewers: { userId: string; username: string }[] = [];
    const seen = new Set<string>();
    for (const [, info] of WebSocketService.clientInfo) {
      if (info.projectId === projectId && !seen.has(info.userId)) {
        seen.add(info.userId);
        viewers.push({ userId: info.userId, username: info.username });
      }
    }

    const message = JSON.stringify({
      type: 'presence_update',
      payload: { projectId, viewers },
    });

    // Send only to clients viewing this project
    for (const [ws, info] of WebSocketService.clientInfo) {
      if (info.projectId === projectId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
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
