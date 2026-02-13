import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Use vi.hoisted() so these are available inside vi.mock factories
// (vi.mock is hoisted above all other code, so regular const is not visible)
// ---------------------------------------------------------------------------

const {
  mockIsAvailable,
  mockComplete,
  mockCompleteToolLoop,
  mockStream,
  mockRender,
  mockBuildProjectContext,
  mockBuildPortfolioContext,
  mockToPromptString,
  mockPortfolioToPromptString,
  mockExecute,
  mockLogAIUsage,
  mockLogUserAction,
  mockDbQuery,
} = vi.hoisted(() => ({
  mockIsAvailable: vi.fn().mockReturnValue(false),
  mockComplete: vi.fn(),
  mockCompleteToolLoop: vi.fn(),
  mockStream: vi.fn(),
  mockRender: vi.fn().mockReturnValue('You are a PM assistant.'),
  mockBuildProjectContext: vi.fn().mockResolvedValue({
    project: { id: 'p1', name: 'Test Project', status: 'active', priority: 'high', projectType: 'it' },
    schedules: [],
  }),
  mockBuildPortfolioContext: vi.fn().mockResolvedValue({
    totalProjects: 3,
    projects: [],
    summary: { byStatus: {}, byPriority: {}, totalBudget: 0, totalSpent: 0 },
  }),
  mockToPromptString: vi.fn().mockReturnValue('Project: Test Project\nStatus: active'),
  mockPortfolioToPromptString: vi.fn().mockReturnValue('Portfolio Overview: 3 projects'),
  mockExecute: vi.fn().mockResolvedValue({
    success: true,
    toolName: 'create_task',
    summary: 'Created task "Design UI"',
    data: { taskId: 't-1' },
  }),
  mockLogAIUsage: vi.fn(),
  mockLogUserAction: vi.fn(),
  mockDbQuery: vi.fn().mockResolvedValue([[]]),
}));

// ---------------------------------------------------------------------------
// Mock config BEFORE any imports
// ---------------------------------------------------------------------------

vi.mock('../../config', () => ({
  config: {
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
    query: mockDbQuery,
  },
}));

vi.mock('../claudeService', () => ({
  claudeService: {
    isAvailable: mockIsAvailable,
    complete: mockComplete,
    completeToolLoop: mockCompleteToolLoop,
    stream: mockStream,
  },
  promptTemplates: {
    conversational: {
      render: mockRender,
    },
  },
  PromptTemplate: class {
    render() { return ''; }
    getVersion() { return '1.0.0'; }
  },
}));

vi.mock('../aiContextBuilder', () => ({
  AIContextBuilder: class {
    constructor() {}
    buildProjectContext = mockBuildProjectContext;
    buildPortfolioContext = mockBuildPortfolioContext;
    toPromptString = mockToPromptString;
    portfolioToPromptString = mockPortfolioToPromptString;
  },
}));

vi.mock('../aiActionExecutor', () => ({
  AIActionExecutor: class {
    constructor() {}
    execute = mockExecute;
  },
}));

vi.mock('../ProjectService', () => ({
  ProjectService: class {
    async findById() { return null; }
    async findAll() { return []; }
  },
}));

vi.mock('../ScheduleService', () => ({
  ScheduleService: class {
    async findByProjectId() { return []; }
    async findTasksByScheduleId() { return []; }
  },
}));

vi.mock('../ResourceService', () => ({
  ResourceService: class {},
}));

vi.mock('../auditService', () => ({
  auditService: {
    logUserAction: mockLogUserAction,
  },
}));

vi.mock('../aiUsageLogger', () => ({
  logAIUsage: mockLogAIUsage,
}));

vi.mock('../aiToolDefinitions', () => ({
  AI_TOOLS: [
    { name: 'create_task', description: 'Create a task', input_schema: { type: 'object', properties: {}, required: [] } },
  ],
  MUTATING_TOOLS: ['create_task', 'update_task', 'delete_task'],
}));

// ---------------------------------------------------------------------------
// Import the service under test AFTER all mocks are registered
// ---------------------------------------------------------------------------

import { AIChatService, ChatRequest } from '../aiChatService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFastify = () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}) as any;

function baseRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    message: 'How is the project going?',
    userId: 'user-1',
    userRole: 'manager',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AIChatService', () => {
  let service: AIChatService;
  let fastify: any;

  beforeEach(() => {
    // Reset static conversations between tests
    (AIChatService as any).conversations = new Map();

    // Reset all mocks
    vi.clearAllMocks();

    // Default: Claude unavailable
    mockIsAvailable.mockReturnValue(false);

    fastify = makeFastify();
    service = new AIChatService(fastify);
  });

  // =========================================================================
  // 1. sendMessage - Claude unavailable
  // =========================================================================

  describe('sendMessage - Claude unavailable', () => {
    it('returns graceful fallback with aiPowered: false when Claude is unavailable', async () => {
      const result = await service.sendMessage(baseRequest());

      expect(result.aiPowered).toBe(false);
      expect(result.reply).toContain('AI features are currently disabled');
      expect(result.conversationId).toBeDefined();
      expect(typeof result.conversationId).toBe('string');
    });

    it('preserves provided conversationId when Claude is unavailable', async () => {
      const result = await service.sendMessage(baseRequest({ conversationId: 'conv-existing' }));

      expect(result.conversationId).toBe('conv-existing');
      expect(result.aiPowered).toBe(false);
    });

    it('generates a new conversationId when none is provided and Claude is unavailable', async () => {
      const result = await service.sendMessage(baseRequest());

      expect(result.conversationId).toBeTruthy();
      // UUID format: 8-4-4-4-12 hex chars
      expect(result.conversationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  // =========================================================================
  // 2. sendMessage - Claude available (no tools)
  // =========================================================================

  describe('sendMessage - Claude available (no tools / enableTools=false)', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
      mockComplete.mockResolvedValue({
        content: 'The project is on track with 60% completion.',
        usage: { inputTokens: 100, outputTokens: 50 },
        latencyMs: 350,
        model: 'claude-sonnet-4-5-20250929',
      });
    });

    it('calls claudeService.complete() and returns reply with aiPowered: true', async () => {
      const result = await service.sendMessage(baseRequest({ enableTools: false }));

      expect(mockComplete).toHaveBeenCalledTimes(1);
      expect(result.aiPowered).toBe(true);
      expect(result.reply).toBe('The project is on track with 60% completion.');
      expect(result.conversationId).toBeDefined();
    });

    it('does not call completeToolLoop when tools are disabled', async () => {
      await service.sendMessage(baseRequest({ enableTools: false }));

      expect(mockCompleteToolLoop).not.toHaveBeenCalled();
    });

    it('passes conversation history to complete()', async () => {
      await service.sendMessage(baseRequest({ enableTools: false }));

      const callArgs = mockComplete.mock.calls[0][0];
      expect(callArgs).toHaveProperty('systemPrompt');
      expect(callArgs).toHaveProperty('userMessage', 'How is the project going?');
      expect(callArgs).toHaveProperty('conversationHistory');
      expect(callArgs).toHaveProperty('temperature', 0.5);
    });
  });

  // =========================================================================
  // 3. sendMessage - Claude available (with tools)
  // =========================================================================

  describe('sendMessage - Claude available (with tools)', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'I created the task "Design UI" for you.',
        toolResults: [{ toolName: 'create_task', result: '{"success":true}' }],
        totalUsage: { inputTokens: 200, outputTokens: 100 },
        totalLatencyMs: 800,
      });
    });

    it('calls claudeService.completeToolLoop() when tools are enabled (default)', async () => {
      const result = await service.sendMessage(baseRequest());

      expect(mockCompleteToolLoop).toHaveBeenCalledTimes(1);
      expect(result.aiPowered).toBe(true);
      expect(result.reply).toBe('I created the task "Design UI" for you.');
    });

    it('returns action results when tools were used', async () => {
      // The executeToolFn inside sendMessage calls actionExecutor.execute
      // We need the completeToolLoop mock to actually invoke the executeToolFn
      mockCompleteToolLoop.mockImplementation(async (opts: any) => {
        // Simulate the tool loop calling executeToolFn once
        await opts.executeToolFn('create_task', { name: 'Design UI', scheduleId: 's-1' });
        return {
          finalText: 'Done! I created the task.',
          toolResults: [{ toolName: 'create_task', result: '{"success":true}' }],
          totalUsage: { inputTokens: 200, outputTokens: 100 },
          totalLatencyMs: 600,
        };
      });

      const result = await service.sendMessage(baseRequest());

      expect(result.actions).toBeDefined();
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].toolName).toBe('create_task');
      expect(result.actions![0].success).toBe(true);
    });

    it('returns undefined actions when no tools were invoked', async () => {
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Here is the status summary.',
        toolResults: [],
        totalUsage: { inputTokens: 150, outputTokens: 80 },
        totalLatencyMs: 400,
      });

      const result = await service.sendMessage(baseRequest());

      expect(result.actions).toBeUndefined();
    });

    it('passes tools and executeToolFn to completeToolLoop', async () => {
      await service.sendMessage(baseRequest());

      const callArgs = mockCompleteToolLoop.mock.calls[0][0];
      expect(callArgs).toHaveProperty('tools');
      expect(callArgs.tools).toHaveLength(1);
      expect(callArgs.tools[0].name).toBe('create_task');
      expect(typeof callArgs.executeToolFn).toBe('function');
    });
  });

  // =========================================================================
  // 4. sendMessage - error handling
  // =========================================================================

  describe('sendMessage - error handling', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
    });

    it('returns a generic error message when completeToolLoop throws', async () => {
      mockCompleteToolLoop.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await service.sendMessage(baseRequest());

      expect(result.aiPowered).toBe(false);
      expect(result.reply).toContain('error processing your request');
      expect(result.conversationId).toBeDefined();
    });

    it('returns a generic error message when complete() throws', async () => {
      mockComplete.mockRejectedValue(new Error('Authentication failed'));

      const result = await service.sendMessage(baseRequest({ enableTools: false }));

      expect(result.aiPowered).toBe(false);
      expect(result.reply).toContain('error processing your request');
    });

    it('logs the error via fastify.log.error', async () => {
      mockCompleteToolLoop.mockRejectedValue(new Error('Something broke'));

      await service.sendMessage(baseRequest());

      expect(fastify.log.error).toHaveBeenCalled();
    });

    it('preserves conversationId on error when one was provided', async () => {
      mockCompleteToolLoop.mockRejectedValue(new Error('Timeout'));

      const result = await service.sendMessage(baseRequest({ conversationId: 'conv-123' }));

      expect(result.conversationId).toBe('conv-123');
    });
  });

  // =========================================================================
  // 5. Conversation lifecycle
  // =========================================================================

  describe('Conversation lifecycle', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Reply from AI.',
        toolResults: [],
        totalUsage: { inputTokens: 50, outputTokens: 30 },
        totalLatencyMs: 200,
      });
    });

    it('first message creates a new conversation with a generated ID', async () => {
      const result = await service.sendMessage(baseRequest());

      expect(result.conversationId).toBeDefined();
      expect(result.conversationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      // Conversation should be stored
      const conv = await service.getConversation(result.conversationId, 'user-1');
      expect(conv).not.toBeNull();
      expect(conv.messages).toHaveLength(2); // user + assistant
    });

    it('title is first 100 characters of the first user message', async () => {
      const shortMsg = 'Short message';
      const result = await service.sendMessage(baseRequest({ message: shortMsg }));
      const conv = await service.getConversation(result.conversationId, 'user-1');

      expect(conv.title).toBe('Short message');
    });

    it('title is truncated with ellipsis when message exceeds 100 chars', async () => {
      const longMsg = 'A'.repeat(120);
      const result = await service.sendMessage(baseRequest({ message: longMsg }));
      const conv = await service.getConversation(result.conversationId, 'user-1');

      expect(conv.title).toBe('A'.repeat(100) + '...');
      expect(conv.title.length).toBe(103);
    });

    it('second message on same conversationId appends to existing conversation', async () => {
      // First message
      const result1 = await service.sendMessage(baseRequest({ message: 'First question' }));
      const convId = result1.conversationId;

      // Second message on the same conversation
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Second reply.',
        toolResults: [],
        totalUsage: { inputTokens: 40, outputTokens: 20 },
        totalLatencyMs: 150,
      });

      const result2 = await service.sendMessage(
        baseRequest({ message: 'Follow-up question', conversationId: convId }),
      );

      expect(result2.conversationId).toBe(convId);

      const conv = await service.getConversation(convId, 'user-1');
      expect(conv.messages).toHaveLength(4); // 2 from first + 2 from second
    });

    it('messages accumulate in conversation (threading)', async () => {
      const result1 = await service.sendMessage(baseRequest({ message: 'Msg 1' }));
      const convId = result1.conversationId;

      for (let i = 2; i <= 4; i++) {
        mockCompleteToolLoop.mockResolvedValue({
          finalText: `Reply ${i}`,
          toolResults: [],
          totalUsage: { inputTokens: 10, outputTokens: 10 },
          totalLatencyMs: 100,
        });
        await service.sendMessage(baseRequest({ message: `Msg ${i}`, conversationId: convId }));
      }

      const conv = await service.getConversation(convId, 'user-1');
      // 4 exchanges * 2 messages each = 8 total
      expect(conv.messages).toHaveLength(8);
      expect(conv.messages[0].role).toBe('user');
      expect(conv.messages[0].content).toBe('Msg 1');
      expect(conv.messages[1].role).toBe('assistant');
      expect(conv.messages[6].role).toBe('user');
      expect(conv.messages[6].content).toBe('Msg 4');
    });

    it('token count accumulates across messages', async () => {
      const result1 = await service.sendMessage(baseRequest({ message: 'Q1' }));
      const convId = result1.conversationId;

      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'A2',
        toolResults: [],
        totalUsage: { inputTokens: 60, outputTokens: 40 },
        totalLatencyMs: 100,
      });
      await service.sendMessage(baseRequest({ message: 'Q2', conversationId: convId }));

      const conv = await service.getConversation(convId, 'user-1');
      // First: 50+30=80, Second: 60+40=100 => total 180
      expect(conv.tokenCount).toBe(180);
    });
  });

  // =========================================================================
  // 6. getConversations
  // =========================================================================

  describe('getConversations', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Reply.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });
    });

    it('returns conversations for a specific user', async () => {
      // Create two conversations for user-1
      await service.sendMessage(baseRequest({ message: 'Conv 1', userId: 'user-1' }));
      await service.sendMessage(baseRequest({ message: 'Conv 2', userId: 'user-1' }));

      // Create one for user-2
      await service.sendMessage(baseRequest({ message: 'Conv 3', userId: 'user-2' }));

      const convos = await service.getConversations('user-1');

      expect(convos).toHaveLength(2);
      convos.forEach((c: any) => {
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('title');
        expect(c).toHaveProperty('contextType');
        expect(c).toHaveProperty('createdAt');
        expect(c).toHaveProperty('updatedAt');
      });
    });

    it('returns conversations sorted by updatedAt desc', async () => {
      await service.sendMessage(baseRequest({ message: 'Older conversation' }));
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.sendMessage(baseRequest({ message: 'Newer conversation' }));

      const convos = await service.getConversations('user-1');

      expect(convos).toHaveLength(2);
      expect(convos[0].title).toBe('Newer conversation');
      expect(convos[1].title).toBe('Older conversation');
    });

    it('does not return conversations from other users', async () => {
      await service.sendMessage(baseRequest({ message: 'User 2 conv', userId: 'user-2' }));

      const convos = await service.getConversations('user-1');

      expect(convos).toHaveLength(0);
    });
  });

  // =========================================================================
  // 7. getConversation
  // =========================================================================

  describe('getConversation', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'AI response.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });
    });

    it('returns full conversation with messages for correct userId', async () => {
      const result = await service.sendMessage(baseRequest());
      const conv = await service.getConversation(result.conversationId, 'user-1');

      expect(conv).not.toBeNull();
      expect(conv.id).toBe(result.conversationId);
      expect(conv.userId).toBe('user-1');
      expect(conv.messages).toHaveLength(2);
      expect(conv.isActive).toBe(true);
    });

    it('returns null for wrong userId', async () => {
      const result = await service.sendMessage(baseRequest({ userId: 'user-1' }));
      const conv = await service.getConversation(result.conversationId, 'user-OTHER');

      expect(conv).toBeNull();
    });

    it('returns null for non-existent conversationId', async () => {
      const conv = await service.getConversation('non-existent-id', 'user-1');

      expect(conv).toBeNull();
    });
  });

  // =========================================================================
  // 8. deleteConversation
  // =========================================================================

  describe('deleteConversation', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'OK.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });
    });

    it('soft-deletes a conversation (sets isActive=false)', async () => {
      const result = await service.sendMessage(baseRequest());
      const deleted = await service.deleteConversation(result.conversationId, 'user-1');

      expect(deleted).toBe(true);

      // After deletion, getConversation should return null (isActive=false)
      const conv = await service.getConversation(result.conversationId, 'user-1');
      expect(conv).toBeNull();
    });

    it('returns false for wrong userId', async () => {
      const result = await service.sendMessage(baseRequest({ userId: 'user-1' }));
      const deleted = await service.deleteConversation(result.conversationId, 'user-OTHER');

      expect(deleted).toBe(false);
    });

    it('returns false for non-existent conversationId', async () => {
      const deleted = await service.deleteConversation('does-not-exist', 'user-1');

      expect(deleted).toBe(false);
    });

    it('deleted conversation does not appear in getConversations', async () => {
      const result = await service.sendMessage(baseRequest());
      await service.deleteConversation(result.conversationId, 'user-1');

      const convos = await service.getConversations('user-1');
      expect(convos).toHaveLength(0);
    });
  });

  // =========================================================================
  // 9. prepareConversation context
  // =========================================================================

  describe('prepareConversation context', () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Context reply.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });
    });

    it('calls buildProjectContext when projectId is provided', async () => {
      await service.sendMessage(
        baseRequest({ context: { type: 'project', projectId: 'proj-42' } }),
      );

      expect(mockBuildProjectContext).toHaveBeenCalledWith('proj-42');
      expect(mockToPromptString).toHaveBeenCalled();
    });

    it('calls buildPortfolioContext for dashboard context', async () => {
      await service.sendMessage(baseRequest({ context: { type: 'dashboard' } }));

      expect(mockBuildPortfolioContext).toHaveBeenCalled();
      expect(mockPortfolioToPromptString).toHaveBeenCalled();
    });

    it('calls buildPortfolioContext for reports context', async () => {
      await service.sendMessage(baseRequest({ context: { type: 'reports' } }));

      expect(mockBuildPortfolioContext).toHaveBeenCalled();
      expect(mockPortfolioToPromptString).toHaveBeenCalled();
    });

    it('does not call context builders for general context', async () => {
      await service.sendMessage(baseRequest({ context: { type: 'general' } }));

      expect(mockBuildProjectContext).not.toHaveBeenCalled();
      expect(mockBuildPortfolioContext).not.toHaveBeenCalled();
    });

    it('passes last 20 messages as history for existing conversation', async () => {
      // Build a conversation with 12 exchanges (24 messages)
      const result1 = await service.sendMessage(baseRequest({ message: 'Msg 1' }));
      const convId = result1.conversationId;

      for (let i = 2; i <= 12; i++) {
        mockCompleteToolLoop.mockResolvedValue({
          finalText: `Reply ${i}`,
          toolResults: [],
          totalUsage: { inputTokens: 10, outputTokens: 10 },
          totalLatencyMs: 50,
        });
        await service.sendMessage(baseRequest({ message: `Msg ${i}`, conversationId: convId }));
      }

      // Now send one more message with the conversation ID
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Final reply',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });
      await service.sendMessage(baseRequest({ message: 'Msg 13', conversationId: convId }));

      // The last call to completeToolLoop should have received a history
      // window of at most 20 messages (the last 20 of the stored messages)
      const lastCall = mockCompleteToolLoop.mock.calls.at(-1)![0];
      expect(lastCall.conversationHistory.length).toBeLessThanOrEqual(20);
    });

    it('handles buildProjectContext failure gracefully', async () => {
      mockBuildProjectContext.mockRejectedValueOnce(new Error('Project not found'));

      const result = await service.sendMessage(
        baseRequest({ context: { type: 'project', projectId: 'bad-id' } }),
      );

      // Should still succeed, just with fallback context
      expect(result.aiPowered).toBe(true);
      expect(result.reply).toBeDefined();
    });

    it('handles buildPortfolioContext failure gracefully', async () => {
      mockBuildPortfolioContext.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.sendMessage(
        baseRequest({ context: { type: 'dashboard' } }),
      );

      expect(result.aiPowered).toBe(true);
      expect(result.reply).toBeDefined();
    });
  });

  // =========================================================================
  // 10. streamMessage
  // =========================================================================

  describe('streamMessage', () => {
    it('yields fallback text_delta and done when Claude is unavailable', async () => {
      const chunks: any[] = [];
      for await (const chunk of service.streamMessage(baseRequest())) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      const textChunks = chunks.filter(c => c.type === 'text_delta');
      expect(textChunks.length).toBeGreaterThanOrEqual(1);
      expect(textChunks[0].content).toContain('AI features are currently disabled');

      const doneChunk = chunks.find(c => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect(doneChunk.conversationId).toBeDefined();
    });

    it('yields streaming chunks when Claude is available', async () => {
      mockIsAvailable.mockReturnValue(true);

      // Create an async generator that yields text deltas
      async function* mockStreamGen() {
        yield { type: 'text_delta', content: 'Hello ' };
        yield { type: 'text_delta', content: 'world!' };
        yield { type: 'usage', usage: { inputTokens: 30, outputTokens: 15 } };
        yield { type: 'done' };
      }

      mockStream.mockReturnValue(mockStreamGen());

      const chunks: any[] = [];
      for await (const chunk of service.streamMessage(baseRequest())) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter(c => c.type === 'text_delta');
      expect(textChunks).toHaveLength(2);
      expect(textChunks[0].content).toBe('Hello ');
      expect(textChunks[1].content).toBe('world!');

      const usageChunk = chunks.find(c => c.type === 'usage');
      expect(usageChunk).toBeDefined();

      const doneChunk = chunks.find(c => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect(doneChunk.conversationId).toBeDefined();
    });

    it('yields error message when stream throws', async () => {
      mockIsAvailable.mockReturnValue(true);

      async function* failingStream(): AsyncGenerator<any> {
        yield { type: 'text_delta', content: 'Start...' };
        throw new Error('Stream broken');
      }

      mockStream.mockReturnValue(failingStream());

      const chunks: any[] = [];
      for await (const chunk of service.streamMessage(baseRequest())) {
        chunks.push(chunk);
      }

      // Should have the partial text, an error text_delta, and a done chunk
      const errorChunk = chunks.find(
        c => c.type === 'text_delta' && c.content?.includes('error occurred'),
      );
      expect(errorChunk).toBeDefined();

      const doneChunk = chunks.find(c => c.type === 'done');
      expect(doneChunk).toBeDefined();
    });

    it('preserves conversationId in done chunk when unavailable', async () => {
      const chunks: any[] = [];
      for await (const chunk of service.streamMessage(
        baseRequest({ conversationId: 'stream-conv-1' }),
      )) {
        chunks.push(chunk);
      }

      const doneChunk = chunks.find(c => c.type === 'done');
      expect(doneChunk.conversationId).toBe('stream-conv-1');
    });
  });

  // =========================================================================
  // Additional edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('stores contextType from request', async () => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Done.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });

      const result = await service.sendMessage(
        baseRequest({ context: { type: 'schedule' } }),
      );

      const conv = await service.getConversation(result.conversationId, 'user-1');
      expect(conv.contextType).toBe('schedule');
    });

    it('defaults contextType to general when context is not provided', async () => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'General reply.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });

      const result = await service.sendMessage(baseRequest());

      const conv = await service.getConversation(result.conversationId, 'user-1');
      expect(conv.contextType).toBe('general');
    });

    it('stores projectId from context in conversation', async () => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Project info.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });

      const result = await service.sendMessage(
        baseRequest({ context: { type: 'project', projectId: 'proj-99' } }),
      );

      const conv = await service.getConversation(result.conversationId, 'user-1');
      expect(conv.projectId).toBe('proj-99');
    });

    it('independent service instances share static conversations map', async () => {
      mockIsAvailable.mockReturnValue(true);
      mockCompleteToolLoop.mockResolvedValue({
        finalText: 'Shared.',
        toolResults: [],
        totalUsage: { inputTokens: 10, outputTokens: 10 },
        totalLatencyMs: 50,
      });

      const service2 = new AIChatService(fastify);
      const result = await service.sendMessage(baseRequest());

      // service2 should see the conversation created by service
      const conv = await service2.getConversation(result.conversationId, 'user-1');
      expect(conv).not.toBeNull();
    });
  });
});
