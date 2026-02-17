import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/api/v1/ws';
const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

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
                // Invalidate all task queries so views refetch
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['criticalPath'] });
                queryClient.invalidateQueries({ queryKey: ['portfolio'] });
                queryClient.invalidateQueries({ queryKey: ['workflowExecutions'] });
                break;
              case 'schedule_updated':
                queryClient.invalidateQueries({ queryKey: ['schedules'] });
                queryClient.invalidateQueries({ queryKey: ['portfolio'] });
                break;
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected, reconnecting...');
          wsRef.current = null;
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
