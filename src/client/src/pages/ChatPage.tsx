import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Trash2,
  Loader2,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { apiService } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  provider?: string;
  isLoading?: boolean;
}

const QUICK_PROMPTS = [
  'Which projects are due this week?',
  'Show me overdue projects',
  'List high-risk projects',
  'What tasks are overdue?',
  'Show all active projects',
];

// ---------------------------------------------------------------------------
// ChatPage
// ---------------------------------------------------------------------------

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [providerStatus, setProviderStatus] = useState<{
    available: boolean;
    provider: string;
    model: string | null;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check provider status on mount
  useEffect(() => {
    apiService.getAkilStatus().then(setProviderStatus).catch(() => {
      setProviderStatus({ available: false, provider: 'none', model: null });
    });
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track scroll position to show/hide scroll button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
    };
    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const addUserMessage = useCallback((text: string) => {
    const msg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const addLoadingMessage = useCallback((): string => {
    const id = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id, role: 'assistant', content: '', isLoading: true },
    ]);
    return id;
  }, []);

  const resolveLoadingMessage = useCallback(
    (id: string, content: string, toolsUsed: string[], provider: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content, toolsUsed, provider, isLoading: false } : m,
        ),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      addUserMessage(trimmed);
      setInput('');
      setIsLoading(true);
      const loadingId = addLoadingMessage();

      try {
        const result = await apiService.sendAkilMessage({ message: trimmed });
        resolveLoadingMessage(loadingId, result.response, result.toolsUsed, result.provider);
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ??
          err?.message ??
          'Something went wrong. Please try again.';
        resolveLoadingMessage(loadingId, `Sorry, I encountered an error: ${errMsg}`, [], '');
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addUserMessage, addLoadingMessage, resolveLoadingMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = useCallback(async () => {
    setMessages([]);
    try {
      await apiService.clearAkilConversation();
    } catch {
      // ignore — conversation was cleared client-side regardless
    }
  }, []);

  const providerBadge =
    providerStatus?.provider === 'openai'
      ? 'GPT-4o Mini'
      : providerStatus?.provider === 'anthropic'
        ? 'Claude'
        : null;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Akil</h1>
              <p className="text-xs text-gray-500">
                AI assistant for your projects
                {providerBadge && (
                  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                    <Zap className="w-2.5 h-2.5" />
                    {providerBadge}
                  </span>
                )}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-6 relative">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            {/* Welcome state */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Hello, I'm Akil</h2>
              <p className="text-gray-500 text-base leading-relaxed">
                Ask me anything about your projects, tasks, and schedules. I can answer
                questions, identify risks, and help you take action.
              </p>
            </div>

            {providerStatus && !providerStatus.available && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
                Akil is not available. Ask your administrator to configure{' '}
                <code className="font-mono">OPENAI_API_KEY</code> or{' '}
                <code className="font-mono">ANTHROPIC_API_KEY</code>.
              </div>
            )}

            {/* Quick prompts */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={isLoading || (providerStatus !== null && !providerStatus.available)}
                    className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="fixed bottom-28 right-8 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
          >
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your projects..."
              rows={1}
              disabled={isLoading || (providerStatus !== null && !providerStatus.available)}
              className="flex-1 bg-transparent resize-none text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading || (providerStatus !== null && !providerStatus.available)}
              className="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Akil can make mistakes. Verify important information before acting.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-gray-200 text-gray-600' : 'bg-indigo-600 text-white'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          }`}
        >
          {message.isLoading ? (
            <TypingIndicator />
          ) : (
            <FormattedContent content={message.content} isUser={isUser} />
          )}
        </div>

        {/* Tool usage badge */}
        {!message.isLoading && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100"
              >
                {tool.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 h-5">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function FormattedContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (!content) return null;

  // Split on double newlines to form paragraphs, handle simple markdown-like lists
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={key++} className="flex gap-2 items-start">
          <span className={`flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${isUser ? 'bg-white/60' : 'bg-gray-400'}`} />
          <span>{line.slice(2)}</span>
        </div>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={key++} className="flex gap-2 items-start">
            <span className={`flex-shrink-0 font-medium text-xs mt-0.5 ${isUser ? 'text-white/70' : 'text-gray-500'}`}>
              {match[1]}.
            </span>
            <span>{match[2]}</span>
          </div>,
        );
      }
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      // Bold: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <div key={key++}>
          {parts.map((part, i) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={i}>{part.slice(2, -2)}</strong>
            ) : (
              part
            ),
          )}
        </div>,
      );
    }
  }

  return <div className="space-y-1">{elements}</div>;
}
