import { create } from 'zustand';
import { apiService } from '../services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  context?: {
    type: string;
    projectId?: string;
  };
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

interface AIChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  conversationId: string | null;
  error: string | null;

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastAssistantMessage: (content: string) => void;
  setStreaming: (messageId: string, isStreaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConversationId: (id: string | null) => void;
  clearChat: () => void;
  sendMessage: (
    userMessage: string,
    context?: { type: string; projectId?: string },
  ) => Promise<void>;
}

let messageIdCounter = 0;

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I\'m your AI Project Management Assistant. I can help you analyze projects, identify risks, optimize schedules, and answer questions about your portfolio. What would you like to know?',
  timestamp: new Date().toISOString(),
};

export const useAIChatStore = create<AIChatState>()((set, get) => ({
  messages: [WELCOME_MESSAGE],
  isLoading: false,
  conversationId: null,
  error: null,

  addMessage: (message) => set((state) => {
    const id = `msg-${Date.now()}-${++messageIdCounter}`;
    const newMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date().toISOString(),
    };
    return { messages: [...state.messages, newMessage], error: null };
  }),

  updateLastAssistantMessage: (content) => set((state) => {
    const messages = [...state.messages];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        messages[i] = { ...messages[i], content };
        break;
      }
    }
    return { messages };
  }),

  setStreaming: (messageId, isStreaming) => set((state) => ({
    messages: state.messages.map(m =>
      m.id === messageId ? { ...m, isStreaming } : m
    ),
  })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setConversationId: (conversationId) => set({ conversationId }),

  clearChat: () => set({
    messages: [WELCOME_MESSAGE],
    conversationId: null,
    error: null,
    isLoading: false,
  }),

  sendMessage: async (userMessage, context) => {
    const { addMessage, updateLastAssistantMessage, setLoading, setError, setConversationId, conversationId } = get();

    setLoading(true);

    // Add placeholder assistant message for streaming
    addMessage({ role: 'assistant', content: '', isStreaming: true });

    const placeholderMsg = get().messages[get().messages.length - 1];

    try {
      const response = await apiService.streamChatMessage({
        message: userMessage,
        conversationId: conversationId || undefined,
        context,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          try {
            const chunk = JSON.parse(jsonStr);

            if (chunk.type === 'text_delta' && chunk.content) {
              accumulated += chunk.content;
              updateLastAssistantMessage(accumulated);
            } else if (chunk.type === 'done') {
              if (chunk.conversationId) {
                setConversationId(chunk.conversationId);
              }
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      }

      // Mark streaming as done
      set((state) => ({
        messages: state.messages.map(m =>
          m.id === placeholderMsg.id ? { ...m, isStreaming: false } : m
        ),
      }));

      setLoading(false);
    } catch (error) {
      updateLastAssistantMessage(
        'Sorry, I encountered an error connecting to the AI service. Please try again.',
      );

      set((state) => ({
        messages: state.messages.map(m =>
          m.id === placeholderMsg.id ? { ...m, isStreaming: false } : m
        ),
      }));

      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  },
}));

export const dashboardQuickActions: QuickAction[] = [
  { id: 'risk-scan', label: 'Risk Scan', icon: 'Shield', prompt: 'Scan all active projects for risks and give me a summary of the top concerns.' },
  { id: 'daily-brief', label: 'Daily Brief', icon: 'Sun', prompt: 'Give me a daily briefing on my projects. What needs attention today?' },
  { id: 'create-project', label: 'New Project', icon: 'Plus', prompt: 'Help me create a new project. Ask me what I need.' },
  { id: 'report', label: 'Status Report', icon: 'FileText', prompt: 'Generate a status report for all active projects.' },
];

export const projectQuickActions: QuickAction[] = [
  { id: 'analyze', label: 'Analyze', icon: 'BarChart3', prompt: 'Analyze this project and tell me how it\'s doing overall.' },
  { id: 'risks', label: 'Find Risks', icon: 'AlertTriangle', prompt: 'What are the biggest risks for this project right now?' },
  { id: 'optimize', label: 'Optimize', icon: 'Zap', prompt: 'How can I optimize the schedule for this project?' },
  { id: 'tasks', label: 'Break Down', icon: 'List', prompt: 'Break down this project into detailed tasks and phases.' },
];
