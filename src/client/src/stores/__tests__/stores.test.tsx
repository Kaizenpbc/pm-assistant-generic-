/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';

// ---------------------------------------------------------------------------
// Mock apiService for aiChatStore
// ---------------------------------------------------------------------------
const mockSendChatMessage = vi.fn();

vi.mock('../../services/api', () => ({
  apiService: {
    sendChatMessage: (...args: any[]) => mockSendChatMessage(...args),
  },
}));

import { useAIChatStore, dashboardQuickActions, projectQuickActions, ChatMessage } from '../../stores/aiChatStore';
import { useAuthStore, User } from '../../stores/authStore';
import { useUIStore, Notification, AIPanelContext } from '../../stores/uiStore';

// ===================================================================
// aiChatStore
// ===================================================================

describe('aiChatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useAIChatStore.getState().clearChat();
    });
  });

  describe('initial state', () => {
    it('starts with a welcome message', () => {
      const { messages } = useAIChatStore.getState();
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('welcome');
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toContain('AI Project Management Assistant');
    });

    it('starts not loading', () => {
      expect(useAIChatStore.getState().isLoading).toBe(false);
    });

    it('starts with no conversation ID', () => {
      expect(useAIChatStore.getState().conversationId).toBeNull();
    });

    it('starts with no error', () => {
      expect(useAIChatStore.getState().error).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('adds a user message with auto-generated ID and timestamp', () => {
      act(() => {
        useAIChatStore.getState().addMessage({ role: 'user', content: 'Hello' });
      });
      const { messages } = useAIChatStore.getState();
      expect(messages.length).toBe(2);
      const userMsg = messages[1];
      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toBe('Hello');
      expect(userMsg.id).toMatch(/^msg-/);
      expect(userMsg.timestamp).toBeTruthy();
    });

    it('clears error when adding a message', () => {
      act(() => {
        useAIChatStore.getState().setError('some error');
      });
      expect(useAIChatStore.getState().error).toBe('some error');

      act(() => {
        useAIChatStore.getState().addMessage({ role: 'user', content: 'test' });
      });
      expect(useAIChatStore.getState().error).toBeNull();
    });

    it('preserves existing messages', () => {
      act(() => {
        useAIChatStore.getState().addMessage({ role: 'user', content: 'First' });
        useAIChatStore.getState().addMessage({ role: 'assistant', content: 'Second' });
      });
      const { messages } = useAIChatStore.getState();
      expect(messages.length).toBe(3); // welcome + 2
      expect(messages[1].content).toBe('First');
      expect(messages[2].content).toBe('Second');
    });
  });

  describe('updateLastAssistantMessage', () => {
    it('updates the most recent assistant message content', () => {
      act(() => {
        useAIChatStore.getState().addMessage({ role: 'user', content: 'query' });
        useAIChatStore.getState().addMessage({ role: 'assistant', content: 'old response' });
        useAIChatStore.getState().updateLastAssistantMessage('new response');
      });
      const { messages } = useAIChatStore.getState();
      const lastAssistant = messages.filter((m) => m.role === 'assistant').pop();
      expect(lastAssistant!.content).toBe('new response');
    });

    it('only updates the last assistant message, not earlier ones', () => {
      act(() => {
        useAIChatStore.getState().addMessage({ role: 'assistant', content: 'first reply' });
        useAIChatStore.getState().addMessage({ role: 'user', content: 'follow-up' });
        useAIChatStore.getState().addMessage({ role: 'assistant', content: 'second reply' });
        useAIChatStore.getState().updateLastAssistantMessage('updated');
      });
      const assistantMsgs = useAIChatStore.getState().messages.filter((m) => m.role === 'assistant');
      // welcome (index 0), first reply (index 1), second reply (index 2)
      expect(assistantMsgs[0].content).toContain('AI Project Management Assistant'); // welcome
      expect(assistantMsgs[1].content).toBe('first reply');
      expect(assistantMsgs[2].content).toBe('updated');
    });
  });

  describe('setStreaming', () => {
    it('sets isStreaming on a specific message', () => {
      act(() => {
        useAIChatStore.getState().addMessage({ role: 'assistant', content: 'streaming...', isStreaming: true });
      });
      const msg = useAIChatStore.getState().messages.at(-1)!;
      expect(msg.isStreaming).toBe(true);

      act(() => {
        useAIChatStore.getState().setStreaming(msg.id, false);
      });
      const updated = useAIChatStore.getState().messages.find((m) => m.id === msg.id);
      expect(updated!.isStreaming).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('toggles isLoading', () => {
      act(() => {
        useAIChatStore.getState().setLoading(true);
      });
      expect(useAIChatStore.getState().isLoading).toBe(true);

      act(() => {
        useAIChatStore.getState().setLoading(false);
      });
      expect(useAIChatStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('sets error and clears loading', () => {
      act(() => {
        useAIChatStore.getState().setLoading(true);
        useAIChatStore.getState().setError('Network failure');
      });
      const state = useAIChatStore.getState();
      expect(state.error).toBe('Network failure');
      expect(state.isLoading).toBe(false);
    });

    it('clears error when set to null', () => {
      act(() => {
        useAIChatStore.getState().setError('err');
        useAIChatStore.getState().setError(null);
      });
      expect(useAIChatStore.getState().error).toBeNull();
    });
  });

  describe('setConversationId', () => {
    it('sets and clears conversation ID', () => {
      act(() => {
        useAIChatStore.getState().setConversationId('conv-123');
      });
      expect(useAIChatStore.getState().conversationId).toBe('conv-123');

      act(() => {
        useAIChatStore.getState().setConversationId(null);
      });
      expect(useAIChatStore.getState().conversationId).toBeNull();
    });
  });

  describe('clearChat', () => {
    it('resets to initial state with welcome message', () => {
      act(() => {
        useAIChatStore.getState().addMessage({ role: 'user', content: 'hello' });
        useAIChatStore.getState().setConversationId('conv-1');
        useAIChatStore.getState().setError('error');
        useAIChatStore.getState().setLoading(true);
        useAIChatStore.getState().clearChat();
      });
      const state = useAIChatStore.getState();
      expect(state.messages.length).toBe(1);
      expect(state.messages[0].id).toBe('welcome');
      expect(state.conversationId).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('adds placeholder assistant message and updates on success', async () => {
      mockSendChatMessage.mockResolvedValue({
        reply: 'AI response',
        conversationId: 'conv-new',
        actions: [{ success: true, toolName: 'list_projects', summary: 'Found 3 projects' }],
      });

      await act(async () => {
        useAIChatStore.getState().addMessage({ role: 'user', content: 'Show my projects' });
        await useAIChatStore.getState().sendMessage('Show my projects');
      });

      const state = useAIChatStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.conversationId).toBe('conv-new');

      const lastMsg = state.messages.at(-1)!;
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toBe('AI response');
      expect(lastMsg.isStreaming).toBe(false);
      expect(lastMsg.actions).toHaveLength(1);
      expect(lastMsg.actions![0].toolName).toBe('list_projects');
    });

    it('handles API error gracefully', async () => {
      mockSendChatMessage.mockRejectedValue(new Error('API down'));

      await act(async () => {
        await useAIChatStore.getState().sendMessage('test');
      });

      const state = useAIChatStore.getState();
      expect(state.error).toBe('API down');
      // Last assistant message should contain error text
      const lastAssistant = state.messages.filter((m) => m.role === 'assistant').pop()!;
      expect(lastAssistant.content).toContain('error');
      expect(lastAssistant.isStreaming).toBe(false);
    });

    it('passes context to API', async () => {
      mockSendChatMessage.mockResolvedValue({ reply: 'ok', conversationId: null });

      const context = { type: 'project', projectId: 'p1' };
      await act(async () => {
        await useAIChatStore.getState().sendMessage('analyze', context);
      });

      expect(mockSendChatMessage).toHaveBeenCalledWith({
        message: 'analyze',
        conversationId: undefined,
        context,
      });
    });

    it('sends existing conversationId with subsequent messages', async () => {
      act(() => {
        useAIChatStore.getState().setConversationId('conv-existing');
      });

      mockSendChatMessage.mockResolvedValue({ reply: 'ok' });

      await act(async () => {
        await useAIChatStore.getState().sendMessage('follow up');
      });

      expect(mockSendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-existing' }),
      );
    });
  });

  describe('quick actions', () => {
    it('has 4 dashboard quick actions', () => {
      expect(dashboardQuickActions).toHaveLength(4);
      expect(dashboardQuickActions.map((a) => a.id)).toContain('risk-scan');
      expect(dashboardQuickActions.map((a) => a.id)).toContain('daily-brief');
    });

    it('has 4 project quick actions', () => {
      expect(projectQuickActions).toHaveLength(4);
      expect(projectQuickActions.map((a) => a.id)).toContain('analyze');
      expect(projectQuickActions.map((a) => a.id)).toContain('risks');
    });

    it('all quick actions have required fields', () => {
      for (const action of [...dashboardQuickActions, ...projectQuickActions]) {
        expect(action.id).toBeTruthy();
        expect(action.label).toBeTruthy();
        expect(action.icon).toBeTruthy();
        expect(action.prompt).toBeTruthy();
      }
    });
  });
});

// ===================================================================
// authStore
// ===================================================================

describe('authStore', () => {
  beforeEach(() => {
    // Reset store
    act(() => {
      useAuthStore.getState().logout();
    });
  });

  const testUser: User = {
    id: 'u1',
    username: 'john',
    email: 'john@test.com',
    fullName: 'John Doe',
    role: 'manager',
  };

  describe('initial state', () => {
    it('starts with no user', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('starts with no error', () => {
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('setUser', () => {
    it('sets user and marks as authenticated', () => {
      act(() => {
        useAuthStore.getState().setUser(testUser);
      });
      const state = useAuthStore.getState();
      expect(state.user).toEqual(testUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('clears user when set to null', () => {
      act(() => {
        useAuthStore.getState().setUser(testUser);
        useAuthStore.getState().setUser(null);
      });
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('clears any existing error', () => {
      act(() => {
        useAuthStore.getState().setError('old error');
        useAuthStore.getState().setUser(testUser);
      });
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('sets loading state', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
      });
      expect(useAuthStore.getState().isLoading).toBe(true);

      act(() => {
        useAuthStore.getState().setLoading(false);
      });
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('sets error and stops loading', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
        useAuthStore.getState().setError('Invalid credentials');
      });
      const state = useAuthStore.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears all state', () => {
      act(() => {
        useAuthStore.getState().setUser(testUser);
        useAuthStore.getState().logout();
      });
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears error without affecting other state', () => {
      act(() => {
        useAuthStore.getState().setUser(testUser);
        useAuthStore.getState().setError('temp error');
        useAuthStore.getState().clearError();
      });
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
      expect(state.user).toEqual(testUser); // user unchanged
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('role types', () => {
    it('supports admin role', () => {
      act(() => {
        useAuthStore.getState().setUser({ ...testUser, role: 'admin' });
      });
      expect(useAuthStore.getState().user!.role).toBe('admin');
    });

    it('supports executive role', () => {
      act(() => {
        useAuthStore.getState().setUser({ ...testUser, role: 'executive' });
      });
      expect(useAuthStore.getState().user!.role).toBe('executive');
    });

    it('supports member role', () => {
      act(() => {
        useAuthStore.getState().setUser({ ...testUser, role: 'member' });
      });
      expect(useAuthStore.getState().user!.role).toBe('member');
    });
  });
});

// ===================================================================
// uiStore
// ===================================================================

describe('uiStore', () => {
  beforeEach(() => {
    act(() => {
      useUIStore.getState().clearNotifications();
      useUIStore.getState().setSidebarCollapsed(false);
      useUIStore.getState().setAIPanelOpen(true);
      useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
    });
  });

  describe('initial state', () => {
    it('starts with sidebar expanded', () => {
      act(() => {
        useUIStore.getState().setSidebarCollapsed(false);
      });
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('starts with AI panel open', () => {
      expect(useUIStore.getState().aiPanelOpen).toBe(true);
    });

    it('starts with dashboard context', () => {
      expect(useUIStore.getState().aiPanelContext.type).toBe('dashboard');
    });

    it('starts with empty notifications', () => {
      expect(useUIStore.getState().notifications).toHaveLength(0);
      expect(useUIStore.getState().unreadCount).toBe(0);
    });
  });

  describe('sidebar', () => {
    it('toggles sidebar collapsed state', () => {
      act(() => {
        useUIStore.getState().toggleSidebar();
      });
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      act(() => {
        useUIStore.getState().toggleSidebar();
      });
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('sets sidebar collapsed directly', () => {
      act(() => {
        useUIStore.getState().setSidebarCollapsed(true);
      });
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });
  });

  describe('AI panel', () => {
    it('toggles AI panel', () => {
      act(() => {
        useUIStore.getState().toggleAIPanel();
      });
      expect(useUIStore.getState().aiPanelOpen).toBe(false);

      act(() => {
        useUIStore.getState().toggleAIPanel();
      });
      expect(useUIStore.getState().aiPanelOpen).toBe(true);
    });

    it('sets AI panel open directly', () => {
      act(() => {
        useUIStore.getState().setAIPanelOpen(false);
      });
      expect(useUIStore.getState().aiPanelOpen).toBe(false);
    });

    it('sets AI panel context', () => {
      const ctx: AIPanelContext = { type: 'project', projectId: 'p1', projectName: 'Alpha' };
      act(() => {
        useUIStore.getState().setAIPanelContext(ctx);
      });
      expect(useUIStore.getState().aiPanelContext).toEqual(ctx);
    });

    it('switches context between types', () => {
      act(() => {
        useUIStore.getState().setAIPanelContext({ type: 'schedule' });
      });
      expect(useUIStore.getState().aiPanelContext.type).toBe('schedule');

      act(() => {
        useUIStore.getState().setAIPanelContext({ type: 'reports' });
      });
      expect(useUIStore.getState().aiPanelContext.type).toBe('reports');
    });
  });

  describe('notifications', () => {
    const testNotification: Omit<Notification, 'id' | 'createdAt'> = {
      type: 'risk',
      severity: 'high',
      title: 'High risk detected',
      message: 'Project Beta has critical risk factors.',
      projectId: 'p2',
      projectName: 'Beta',
      read: false,
    };

    it('adds a notification with auto-generated ID and timestamp', () => {
      act(() => {
        useUIStore.getState().addNotification(testNotification);
      });
      const { notifications } = useUIStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].id).toMatch(/^notif-/);
      expect(notifications[0].createdAt).toBeTruthy();
      expect(notifications[0].title).toBe('High risk detected');
      expect(notifications[0].read).toBe(false);
    });

    it('increments unread count when adding notification', () => {
      act(() => {
        useUIStore.getState().addNotification(testNotification);
        useUIStore.getState().addNotification({ ...testNotification, title: 'Second' });
      });
      expect(useUIStore.getState().unreadCount).toBe(2);
    });

    it('adds new notifications at the beginning (most recent first)', () => {
      act(() => {
        useUIStore.getState().addNotification({ ...testNotification, title: 'First' });
        useUIStore.getState().addNotification({ ...testNotification, title: 'Second' });
      });
      const { notifications } = useUIStore.getState();
      expect(notifications[0].title).toBe('Second');
      expect(notifications[1].title).toBe('First');
    });

    it('limits notifications to 100', () => {
      act(() => {
        for (let i = 0; i < 110; i++) {
          useUIStore.getState().addNotification({ ...testNotification, title: `Notif ${i}` });
        }
      });
      expect(useUIStore.getState().notifications.length).toBeLessThanOrEqual(100);
    });

    it('dismisses a notification (marks as read)', () => {
      act(() => {
        useUIStore.getState().addNotification(testNotification);
      });
      const id = useUIStore.getState().notifications[0].id;
      expect(useUIStore.getState().unreadCount).toBe(1);

      act(() => {
        useUIStore.getState().dismissNotification(id);
      });
      const notif = useUIStore.getState().notifications.find((n) => n.id === id);
      expect(notif!.read).toBe(true);
      expect(useUIStore.getState().unreadCount).toBe(0);
    });

    it('does not decrement unread for already-read notification', () => {
      act(() => {
        useUIStore.getState().addNotification(testNotification);
      });
      const id = useUIStore.getState().notifications[0].id;

      act(() => {
        useUIStore.getState().dismissNotification(id); // first dismiss
        useUIStore.getState().dismissNotification(id); // second dismiss
      });
      expect(useUIStore.getState().unreadCount).toBe(0); // not -1
    });

    it('marks all as read', () => {
      act(() => {
        useUIStore.getState().addNotification({ ...testNotification, title: 'A' });
        useUIStore.getState().addNotification({ ...testNotification, title: 'B' });
        useUIStore.getState().addNotification({ ...testNotification, title: 'C' });
      });
      expect(useUIStore.getState().unreadCount).toBe(3);

      act(() => {
        useUIStore.getState().markAllRead();
      });
      const state = useUIStore.getState();
      expect(state.unreadCount).toBe(0);
      expect(state.notifications.every((n) => n.read)).toBe(true);
    });

    it('clears all notifications', () => {
      act(() => {
        useUIStore.getState().addNotification(testNotification);
        useUIStore.getState().addNotification(testNotification);
        useUIStore.getState().clearNotifications();
      });
      const state = useUIStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });

    it('supports different notification types', () => {
      const types: Notification['type'][] = ['risk', 'budget', 'schedule', 'resource', 'info'];
      act(() => {
        for (const type of types) {
          useUIStore.getState().addNotification({ ...testNotification, type });
        }
      });
      const { notifications } = useUIStore.getState();
      const resultTypes = notifications.map((n) => n.type);
      for (const type of types) {
        expect(resultTypes).toContain(type);
      }
    });

    it('supports different severity levels', () => {
      const severities: Notification['severity'][] = ['critical', 'high', 'medium', 'low'];
      act(() => {
        for (const severity of severities) {
          useUIStore.getState().addNotification({ ...testNotification, severity });
        }
      });
      const { notifications } = useUIStore.getState();
      const resultSeverities = notifications.map((n) => n.severity);
      for (const severity of severities) {
        expect(resultSeverities).toContain(severity);
      }
    });
  });
});
