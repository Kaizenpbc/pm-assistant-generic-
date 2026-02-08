import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  Loader2,
  Bot,
  User,
  ChevronDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useAIChatStore, dashboardQuickActions, projectQuickActions, type QuickAction, type ActionResult } from '../../stores/aiChatStore';
import { AIChatContext } from './AIChatContext';
import { QuickActions } from './QuickActions';
import type { AIPanelContext } from '../../stores/uiStore';

interface AIChatPanelProps {
  context: AIPanelContext;
}

export function AIChatPanel({ context }: AIChatPanelProps) {
  const { messages, isLoading, error, addMessage, clearChat, sendMessage } = useAIChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const quickActions = context.type === 'project' ? projectQuickActions : dashboardQuickActions;

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    addMessage({ role: 'user', content: trimmed });
    setInput('');
    sendMessage(trimmed, context);
  }

  function handleQuickAction(action: QuickAction) {
    if (isLoading) return;
    addMessage({ role: 'user', content: action.prompt });
    sendMessage(action.prompt, context);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Context Bar */}
      <AIChatContext context={context} />

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                  message.role === 'assistant'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {message.role === 'assistant' ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === 'assistant'
                    ? 'bg-gray-50 text-gray-800'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {message.content.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                      part.startsWith('**') && part.endsWith('**') ? (
                        <strong key={j}>{part.slice(2, -2)}</strong>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                    {i < message.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
                {message.isStreaming && (
                  <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                )}
                {/* Action Results */}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-2">
                    {message.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                          action.success
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {action.success ? (
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        )}
                        <span>{action.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && !messages.some(m => m.isStreaming) && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-gray-50 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '200ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom */}
      {showScrollButton && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2">
          <button
            onClick={scrollToBottom}
            className="rounded-full bg-white p-1.5 shadow-md ring-1 ring-gray-200 hover:bg-gray-50"
          >
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <QuickActions actions={quickActions} onAction={handleQuickAction} />
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your projects..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-gray-400">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
