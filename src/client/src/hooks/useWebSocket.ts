import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001/api/v1/ws'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws`;
const RECONNECT_DELAY = 3000;

// Module-level WebSocket reference for sending messages from anywhere
let globalWs: WebSocket | null = null;

export function sendWsMessage(data: object) {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(data));
  }
}

// Module-level presence state with custom event dispatch
const PRESENCE_EVENT = 'ws:presence_update';
const presenceMap = new Map<string, { userId: string; username: string }[]>();

export function getPresenceViewers(projectId: string): { userId: string; username: string }[] {
  return presenceMap.get(projectId) || [];
}

export function usePresenceViewers(projectId: string | undefined): { userId: string; username: string }[] {
  const [viewers, setViewers] = useState<{ userId: string; username: string }[]>(() =>
    projectId ? getPresenceViewers(projectId) : []
  );

  useEffect(() => {
    if (!projectId) return;
    setViewers(getPresenceViewers(projectId));

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.projectId === projectId) {
        setViewers(detail.viewers);
      }
    };
    window.addEventListener(PRESENCE_EVENT, handler);
    return () => window.removeEventListener(PRESENCE_EVENT, handler);
  }, [projectId]);

  return viewers;
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        globalWs = ws;

        ws.onopen = () => {
          console.log('[WS] Connected');
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case 'task_updated':
              case 'task_created':
              case 'task_deleted':
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['criticalPath'] });
                queryClient.invalidateQueries({ queryKey: ['portfolio'] });
                queryClient.invalidateQueries({ queryKey: ['workflowExecutions'] });
                break;
              case 'schedule_updated':
                queryClient.invalidateQueries({ queryKey: ['schedules'] });
                queryClient.invalidateQueries({ queryKey: ['portfolio'] });
                break;
              case 'presence_update': {
                const { projectId, viewers } = message.payload;
                presenceMap.set(projectId, viewers);
                window.dispatchEvent(new CustomEvent(PRESENCE_EVENT, {
                  detail: { projectId, viewers },
                }));
                break;
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected, reconnecting...');
          wsRef.current = null;
          if (globalWs === ws) globalWs = null;
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);
}
