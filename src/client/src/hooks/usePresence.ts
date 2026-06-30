import { useEffect } from 'react';
import { sendWsMessage, usePresenceViewers } from './useWebSocket';

export function usePresence(projectId: string | undefined) {
  const viewers = usePresenceViewers(projectId);

  useEffect(() => {
    if (!projectId) return;

    sendWsMessage({ type: 'presence:join', projectId });

    return () => {
      sendWsMessage({ type: 'presence:leave' });
    };
  }, [projectId]);

  return viewers;
}
