import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/api/v1/ws';
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const attemptRef = useRef(0);

  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] Connected');
          attemptRef.current = 0; // Reset on successful connection
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
          } catch (err) {
            console.warn('[WS] Failed to parse message:', err);
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (attemptRef.current >= MAX_RETRIES) {
            console.warn('[WS] Max reconnect attempts reached, giving up');
            return;
          }
          // Exponential backoff: min(BASE * 2^attempt, MAX) + 10% jitter
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attemptRef.current), MAX_DELAY_MS);
          const jitter = delay * 0.1 * Math.random();
          attemptRef.current++;
          console.log(`[WS] Disconnected, reconnecting in ${Math.round(delay + jitter)}ms (attempt ${attemptRef.current}/${MAX_RETRIES})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay + jitter);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (attemptRef.current < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attemptRef.current), MAX_DELAY_MS);
          const jitter = delay * 0.1 * Math.random();
          attemptRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay + jitter);
        }
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
