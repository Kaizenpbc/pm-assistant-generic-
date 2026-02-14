import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted runs before vi.mock factory functions
// ---------------------------------------------------------------------------

const { mockCreate, mockStream, MockAPIError, MockAPIConnectionTimeoutError, MockAPIConnectionError } = vi.hoisted(() => {
  class _APIError extends Error {
    status: number;
    constructor(s: number, m: any) {
      super(String(m));
      this.status = s;
    }
  }
  class _APIConnectionTimeoutError extends Error {
    constructor() {
      super('timeout');
    }
  }
  class _APIConnectionError extends Error {
    constructor() {
      super('connection');
    }
  }
  return {
    mockCreate: vi.fn(),
    mockStream: vi.fn(),
    MockAPIError: _APIError,
    MockAPIConnectionTimeoutError: _APIConnectionTimeoutError,
    MockAPIConnectionError: _APIConnectionError,
  };
});

// ---------------------------------------------------------------------------
// Mock config BEFORE any service imports
// ---------------------------------------------------------------------------

vi.mock('../../config', () => ({
  config: {
    AI_ENABLED: true,
    ANTHROPIC_API_KEY: 'test-key-123',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

// ---------------------------------------------------------------------------
// Mock Anthropic SDK — share the same error classes between static and named
// ---------------------------------------------------------------------------

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate, stream: mockStream };
    constructor() {}
    static APIError = MockAPIError;
    static APIConnectionTimeoutError = MockAPIConnectionTimeoutError;
    static APIConnectionError = MockAPIConnectionError;
  },
  APIError: MockAPIError,
  APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
  APIConnectionError: MockAPIConnectionError,
}));

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

vi.mock('../../database/connection', () => ({
  databaseService: { isHealthy: () => false },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ClaudeService, PromptTemplate, promptTemplates } from '../claudeService';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApiResponse(overrides: Partial<{
  content: any[];
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
  model: string;
}> = {}) {
  return {
    content: overrides.content ?? [{ type: 'text', text: 'response text' }],
    usage: overrides.usage ?? { input_tokens: 10, output_tokens: 20 },
    stop_reason: overrides.stop_reason ?? 'end_turn',
    model: overrides.model ?? 'claude-sonnet-4-5-20250929',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClaudeService', () => {
  let service: ClaudeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClaudeService();
  });

  // =========================================================================
  // 1. PromptTemplate
  // =========================================================================

  describe('PromptTemplate', () => {
    it('render() substitutes single variable correctly', () => {
      const tpl = new PromptTemplate('Hello {{name}}!', '1.0.0');
      expect(tpl.render({ name: 'World' })).toBe('Hello World!');
    });

    it('render() substitutes multiple variables', () => {
      const tpl = new PromptTemplate('{{greeting}} {{name}}, you have {{count}} items.', '2.0.0');
      const result = tpl.render({ greeting: 'Hi', name: 'Alice', count: '3' });
      expect(result).toBe('Hi Alice, you have 3 items.');
    });

    it('render() replaces all occurrences of the same variable', () => {
      const tpl = new PromptTemplate('{{x}} and {{x}} again', '1.0.0');
      expect(tpl.render({ x: 'foo' })).toBe('foo and foo again');
    });

    it('render() leaves unreferenced placeholders intact', () => {
      const tpl = new PromptTemplate('{{a}} and {{b}}', '1.0.0');
      expect(tpl.render({ a: 'replaced' })).toBe('replaced and {{b}}');
    });

    it('getVersion() returns the version string', () => {
      const tpl = new PromptTemplate('template', '3.2.1');
      expect(tpl.getVersion()).toBe('3.2.1');
    });

    it('built-in conversational template is version 2.0.0', () => {
      expect(promptTemplates.conversational.getVersion()).toBe('2.0.0');
    });

    it('built-in taskBreakdown template renders projectDescription', () => {
      const rendered = promptTemplates.taskBreakdown.render({
        projectDescription: 'Build a bridge',
        additionalContext: 'Budget is $1M',
      });
      expect(rendered).toContain('Build a bridge');
      expect(rendered).toContain('Budget is $1M');
    });
  });

  // =========================================================================
  // 2. isAvailable()
  // =========================================================================

  describe('isAvailable()', () => {
    it('returns true when AI is enabled and API key is present', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('returns false when AI is disabled', async () => {
      const { config } = await import('../../config');
      const origEnabled = config.AI_ENABLED;
      const origKey = config.ANTHROPIC_API_KEY;

      // Temporarily override config for this constructor call
      (config as any).AI_ENABLED = false;
      const disabledService = new ClaudeService();
      expect(disabledService.isAvailable()).toBe(false);

      // Restore
      (config as any).AI_ENABLED = origEnabled;
      (config as any).ANTHROPIC_API_KEY = origKey;
    });

    it('returns false when API key is empty', async () => {
      const { config } = await import('../../config');
      const origKey = config.ANTHROPIC_API_KEY;

      (config as any).ANTHROPIC_API_KEY = '';
      const noKeyService = new ClaudeService();
      expect(noKeyService.isAvailable()).toBe(false);

      (config as any).ANTHROPIC_API_KEY = origKey;
    });
  });

  // =========================================================================
  // 3. complete()
  // =========================================================================

  describe('complete()', () => {
    it('returns content, usage, latencyMs, and model', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      const result = await service.complete({
        systemPrompt: 'You are helpful.',
        userMessage: 'Hello',
      });

      expect(result.content).toBe('response text');
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('passes correct params to the API', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({
        systemPrompt: 'System prompt here',
        userMessage: 'User message here',
        maxTokens: 1024,
        temperature: 0.7,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          temperature: 0.7,
          system: 'System prompt here',
          stream: false,
          messages: [{ role: 'user', content: 'User message here' }],
        }),
      );
    });

    it('uses default maxTokens and temperature from config when not specified', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({
        systemPrompt: 'test',
        userMessage: 'test',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096,
          temperature: 0.3,
        }),
      );
    });

    it('appends JSON instructions when responseFormat is json', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({
        systemPrompt: 'Base prompt',
        userMessage: 'test',
        responseFormat: 'json',
      });

      const call = mockCreate.mock.calls[0][0];
      expect(call.system).toContain('Base prompt');
      expect(call.system).toContain('IMPORTANT: You must respond with ONLY valid JSON.');
    });

    it('does not append JSON instructions for text format', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({
        systemPrompt: 'Base prompt',
        userMessage: 'test',
        responseFormat: 'text',
      });

      const call = mockCreate.mock.calls[0][0];
      expect(call.system).toBe('Base prompt');
    });

    it('throws when service is unavailable', async () => {
      const { config } = await import('../../config');
      (config as any).AI_ENABLED = false;
      const unavailableService = new ClaudeService();
      (config as any).AI_ENABLED = true;

      await expect(
        unavailableService.complete({
          systemPrompt: 'test',
          userMessage: 'test',
        }),
      ).rejects.toThrow('AI service is unavailable');
    });
  });

  // =========================================================================
  // 4. buildMessages()
  // =========================================================================

  describe('buildMessages() — via complete()', () => {
    it('empty history produces just userMessage', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({
        systemPrompt: 'sys',
        userMessage: 'hello',
      });

      const call = mockCreate.mock.calls[0][0];
      expect(call.messages).toEqual([{ role: 'user', content: 'hello' }]);
    });

    it('with history, builds history + userMessage', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({
        systemPrompt: 'sys',
        userMessage: 'follow up',
        conversationHistory: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'first reply' },
        ],
      });

      const call = mockCreate.mock.calls[0][0];
      expect(call.messages).toEqual([
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'first reply' },
        { role: 'user', content: 'follow up' },
      ]);
    });

    it('empty conversationHistory array still just produces userMessage', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({
        systemPrompt: 'sys',
        userMessage: 'test',
        conversationHistory: [],
      });

      const call = mockCreate.mock.calls[0][0];
      expect(call.messages).toEqual([{ role: 'user', content: 'test' }]);
    });
  });

  // =========================================================================
  // 5. completeWithJsonSchema()
  // =========================================================================

  describe('completeWithJsonSchema()', () => {
    const testSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    it('first-pass success: parses valid JSON, validates with Zod, returns data', async () => {
      mockCreate.mockResolvedValue(
        makeApiResponse({
          content: [{ type: 'text', text: '{"name":"test","value":42}' }],
          usage: { input_tokens: 15, output_tokens: 25 },
        }),
      );

      const result = await service.completeWithJsonSchema({
        systemPrompt: 'sys',
        userMessage: 'msg',
        schema: testSchema,
      });

      expect(result.data).toEqual({ name: 'test', value: 42 });
      expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 25 });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('strips ```json ... ``` fences before parsing', async () => {
      mockCreate.mockResolvedValue(
        makeApiResponse({
          content: [{ type: 'text', text: '```json\n{"name":"test","value":1}\n```' }],
        }),
      );

      const result = await service.completeWithJsonSchema({
        systemPrompt: 'sys',
        userMessage: 'msg',
        schema: testSchema,
      });

      expect(result.data).toEqual({ name: 'test', value: 1 });
    });

    it('strips bare ``` fences before parsing', async () => {
      mockCreate.mockResolvedValue(
        makeApiResponse({
          content: [{ type: 'text', text: '```\n{"name":"stripped","value":99}\n```' }],
        }),
      );

      const result = await service.completeWithJsonSchema({
        systemPrompt: 'sys',
        userMessage: 'msg',
        schema: testSchema,
      });

      expect(result.data).toEqual({ name: 'stripped', value: 99 });
    });

    it('first-pass Zod failure + retry success makes 2 API calls and aggregates tokens', async () => {
      // First call: valid JSON but fails Zod (value is string, not number)
      mockCreate
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":"test","value":"not-a-number"}' }],
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        )
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":"test","value":42}' }],
            usage: { input_tokens: 30, output_tokens: 40 },
          }),
        );

      const result = await service.completeWithJsonSchema({
        systemPrompt: 'sys',
        userMessage: 'msg',
        schema: testSchema,
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual({ name: 'test', value: 42 });
      expect(result.usage).toEqual({ inputTokens: 40, outputTokens: 60 });
    });

    it('retry call includes correction history with the first attempt', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":"test","value":"wrong"}' }],
          }),
        )
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":"test","value":1}' }],
          }),
        );

      await service.completeWithJsonSchema({
        systemPrompt: 'sys',
        userMessage: 'original msg',
        schema: testSchema,
      });

      const retryCall = mockCreate.mock.calls[1][0];
      // The retry should have correction history
      expect(retryCall.messages).toEqual(
        expect.arrayContaining([
          { role: 'user', content: 'original msg' },
          { role: 'assistant', content: '{"name":"test","value":"wrong"}' },
        ]),
      );
      // The retry userMessage should mention validation failure
      const lastMsg = retryCall.messages[retryCall.messages.length - 1];
      expect(lastMsg.content).toContain('failed validation');
    });

    it('both passes fail: throws error with validation details', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":"test","value":"bad"}' }],
          }),
        )
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":"test","value":"still bad"}' }],
          }),
        );

      await expect(
        service.completeWithJsonSchema({
          systemPrompt: 'sys',
          userMessage: 'msg',
          schema: testSchema,
        }),
      ).rejects.toThrow('Failed to get valid JSON after retry');
    });

    it('invalid JSON on first pass + valid retry succeeds', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: 'not json at all {{{' }],
            usage: { input_tokens: 5, output_tokens: 5 },
          }),
        )
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":"recovered","value":7}' }],
            usage: { input_tokens: 10, output_tokens: 10 },
          }),
        );

      const result = await service.completeWithJsonSchema({
        systemPrompt: 'sys',
        userMessage: 'msg',
        schema: testSchema,
      });

      expect(result.data).toEqual({ name: 'recovered', value: 7 });
      expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 15 });
    });

    it('Zod validation error messages contain field paths', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":123}' }],
          }),
        )
        .mockResolvedValueOnce(
          makeApiResponse({
            content: [{ type: 'text', text: '{"name":456}' }],
          }),
        );

      await expect(
        service.completeWithJsonSchema({
          systemPrompt: 'sys',
          userMessage: 'msg',
          schema: testSchema,
        }),
      ).rejects.toThrow('Zod validation errors');
    });
  });

  // =========================================================================
  // 6. completeToolLoop()
  // =========================================================================

  describe('completeToolLoop()', () => {
    const sampleTools: any[] = [
      {
        name: 'get_weather',
        description: 'Get weather',
        input_schema: { type: 'object', properties: { city: { type: 'string' } } },
      },
    ];
    const executeToolFn = vi.fn();

    it('no tool use (stop_reason=end_turn): returns text immediately', async () => {
      mockCreate.mockResolvedValue(makeApiResponse({
        content: [{ type: 'text', text: 'Final answer' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      }));

      const result = await service.completeToolLoop({
        systemPrompt: 'sys',
        userMessage: 'msg',
        tools: sampleTools,
        executeToolFn,
      });

      expect(result.finalText).toBe('Final answer');
      expect(result.toolResults).toEqual([]);
      expect(executeToolFn).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('single tool use: calls executeToolFn and returns result', async () => {
      // First call: tool_use
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'get_weather', input: { city: 'NYC' } },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: 'tool_use',
        model: 'claude-sonnet-4-5-20250929',
      });

      // Second call: final text after tool result
      mockCreate.mockResolvedValueOnce(makeApiResponse({
        content: [{ type: 'text', text: 'The weather in NYC is sunny.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 15, output_tokens: 25 },
      }));

      executeToolFn.mockResolvedValue('Sunny, 75F');

      const result = await service.completeToolLoop({
        systemPrompt: 'sys',
        userMessage: 'What is the weather?',
        tools: sampleTools,
        executeToolFn,
      });

      expect(executeToolFn).toHaveBeenCalledWith('get_weather', { city: 'NYC' });
      expect(result.toolResults).toEqual([{ toolName: 'get_weather', result: 'Sunny, 75F' }]);
      expect(result.finalText).toBe('The weather in NYC is sunny.');
      expect(result.totalUsage.inputTokens).toBe(25);
      expect(result.totalUsage.outputTokens).toBe(45);
    });

    it('multiple iterations: loops until no more tool_use', async () => {
      // Iteration 1: tool_use
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'get_weather', input: { city: 'NYC' } },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'tool_use',
        model: 'claude-sonnet-4-5-20250929',
      });

      // Iteration 2: another tool_use
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tool_2', name: 'get_weather', input: { city: 'LA' } },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'tool_use',
        model: 'claude-sonnet-4-5-20250929',
      });

      // Iteration 3: end_turn
      mockCreate.mockResolvedValueOnce(makeApiResponse({
        content: [{ type: 'text', text: 'Both cities are sunny.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 10 },
      }));

      executeToolFn.mockResolvedValueOnce('Sunny NYC').mockResolvedValueOnce('Sunny LA');

      const result = await service.completeToolLoop({
        systemPrompt: 'sys',
        userMessage: 'Compare weather',
        tools: sampleTools,
        executeToolFn,
      });

      expect(result.toolResults).toHaveLength(2);
      expect(result.finalText).toBe('Both cities are sunny.');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('max iterations: stops after maxIterations and makes final call', async () => {
      // Make every call return tool_use
      const toolUseResponse = {
        content: [
          { type: 'tool_use', id: 'tool_x', name: 'get_weather', input: { city: 'X' } },
        ],
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'tool_use',
        model: 'claude-sonnet-4-5-20250929',
      };

      mockCreate.mockResolvedValueOnce(toolUseResponse); // iter 1
      mockCreate.mockResolvedValueOnce(toolUseResponse); // iter 2 (maxIterations reached)
      // Final call after max iterations
      mockCreate.mockResolvedValueOnce(makeApiResponse({
        content: [{ type: 'text', text: 'Gave up after max iterations.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 5 },
      }));

      executeToolFn.mockResolvedValue('result');

      const result = await service.completeToolLoop({
        systemPrompt: 'sys',
        userMessage: 'Loop me',
        tools: sampleTools,
        executeToolFn,
        maxIterations: 2,
      });

      // 2 loop iterations + 1 final call = 3 total
      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.finalText).toBe('Gave up after max iterations.');
    });

    it('tool execution error: sets is_error=true on tool_result', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tool_err', name: 'get_weather', input: { city: 'X' } },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'tool_use',
        model: 'claude-sonnet-4-5-20250929',
      });

      mockCreate.mockResolvedValueOnce(makeApiResponse({
        content: [{ type: 'text', text: 'Tool failed but I handled it.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 10 },
      }));

      executeToolFn.mockRejectedValue(new Error('Network failure'));

      const result = await service.completeToolLoop({
        systemPrompt: 'sys',
        userMessage: 'msg',
        tools: sampleTools,
        executeToolFn,
      });

      expect(result.toolResults[0].result).toContain('Error: Network failure');
      expect(result.finalText).toBe('Tool failed but I handled it.');

      // Verify the tool_result message sent to the API has is_error=true
      const secondCallMessages = mockCreate.mock.calls[1][0].messages;
      const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
      expect(toolResultMsg.role).toBe('user');
      expect(toolResultMsg.content[0].is_error).toBe(true);
    });
  });

  // =========================================================================
  // 7. Error handling (wrapError)
  // =========================================================================

  describe('error handling (wrapError via complete())', () => {
    it('401 error produces authentication failure message', async () => {
      const { APIError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIError(401, 'Unauthorized'));

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('Authentication failed');
    });

    it('429 error produces rate limit message', async () => {
      const { APIError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIError(429, 'Too many requests'));

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('503 error produces overloaded message', async () => {
      const { APIError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIError(503, 'Service unavailable'));

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('overloaded or unavailable');
    });

    it('529 error produces overloaded message', async () => {
      const { APIError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIError(529, 'Overloaded'));

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('overloaded or unavailable');
    });

    it('400 error produces bad request message', async () => {
      const { APIError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIError(400, 'Invalid parameter'));

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('Bad request');
    });

    it('timeout error produces timeout message', async () => {
      const { APIConnectionTimeoutError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIConnectionTimeoutError());

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('timed out');
    });

    it('connection error produces network message', async () => {
      const { APIConnectionError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIConnectionError());

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('Failed to connect');
    });

    it('generic Error produces unexpected error message', async () => {
      mockCreate.mockRejectedValue(new Error('Something broke'));

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('Unexpected error: Something broke');
    });

    it('non-Error value produces unknown error message', async () => {
      mockCreate.mockRejectedValue('string error');

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('Unknown error occurred');
    });

    it('error message includes method name', async () => {
      const { APIError } = await import('@anthropic-ai/sdk');
      mockCreate.mockRejectedValue(new APIError(401, 'Unauthorized'));

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('ClaudeService.complete');
    });
  });

  // =========================================================================
  // 8. Usage tracking (recordUsage)
  // =========================================================================

  describe('usage tracking', () => {
    it('starts with zero stats', () => {
      const freshService = new ClaudeService();
      const stats = freshService.getUsageStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.estimatedCost).toBe(0);
    });

    it('increments totalRequests on each complete call', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.complete({ systemPrompt: 's', userMessage: 'm' });
      await service.complete({ systemPrompt: 's', userMessage: 'm' });

      const stats = service.getUsageStats();
      expect(stats.totalRequests).toBe(2);
    });

    it('accumulates input and output tokens', async () => {
      mockCreate
        .mockResolvedValueOnce(
          makeApiResponse({ usage: { input_tokens: 100, output_tokens: 200 } }),
        )
        .mockResolvedValueOnce(
          makeApiResponse({ usage: { input_tokens: 50, output_tokens: 75 } }),
        );

      await service.complete({ systemPrompt: 's', userMessage: 'm' });
      await service.complete({ systemPrompt: 's', userMessage: 'm' });

      const stats = service.getUsageStats();
      expect(stats.totalInputTokens).toBe(150);
      expect(stats.totalOutputTokens).toBe(275);
    });

    it('calculates cost based on claude-sonnet-4-5-20250929 pricing', async () => {
      // Pricing: input $3/M, output $15/M
      mockCreate.mockResolvedValue(
        makeApiResponse({ usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } }),
      );

      await service.complete({ systemPrompt: 's', userMessage: 'm' });

      const stats = service.getUsageStats();
      // input cost: (1M / 1M) * 3.0 = 3.0
      // output cost: (1M / 1M) * 15.0 = 15.0
      expect(stats.estimatedCost).toBeCloseTo(18.0, 4);
    });

    it('getUsageStats() returns a copy (not a reference)', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());
      await service.complete({ systemPrompt: 's', userMessage: 'm' });

      const stats1 = service.getUsageStats();
      const stats2 = service.getUsageStats();

      // They should be equal but not the same object
      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2);

      // Mutating the copy should not affect the original
      stats1.totalRequests = 999;
      expect(service.getUsageStats().totalRequests).toBe(1);
    });
  });

  // =========================================================================
  // 9. stream()
  // =========================================================================

  describe('stream()', () => {
    function makeAsyncIterable(events: any[]) {
      return {
        async *[Symbol.asyncIterator]() {
          for (const event of events) {
            yield event;
          }
        },
      };
    }

    it('yields text_delta chunks from content_block_delta events', async () => {
      const events = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' World' } },
      ];
      mockStream.mockReturnValue(makeAsyncIterable(events));

      const chunks: any[] = [];
      for await (const chunk of service.stream({ systemPrompt: 's', userMessage: 'm' })) {
        chunks.push(chunk);
      }

      // text_delta chunks + usage chunk + done chunk
      expect(chunks.filter((c) => c.type === 'text_delta')).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: 'text_delta', content: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'text_delta', content: ' World' });
    });

    it('yields usage chunk at end', async () => {
      const events = [
        { type: 'message_start', message: { usage: { input_tokens: 50, output_tokens: 0 } } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } },
        { type: 'message_delta', usage: { output_tokens: 30 } },
      ];
      mockStream.mockReturnValue(makeAsyncIterable(events));

      const chunks: any[] = [];
      for await (const chunk of service.stream({ systemPrompt: 's', userMessage: 'm' })) {
        chunks.push(chunk);
      }

      const usageChunk = chunks.find((c) => c.type === 'usage');
      expect(usageChunk).toBeDefined();
      expect(usageChunk!.usage).toEqual({ inputTokens: 50, outputTokens: 30 });
    });

    it('yields done chunk at the end', async () => {
      const events = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'done' } },
      ];
      mockStream.mockReturnValue(makeAsyncIterable(events));

      const chunks: any[] = [];
      for await (const chunk of service.stream({ systemPrompt: 's', userMessage: 'm' })) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk).toEqual({ type: 'done' });
    });

    it('records usage from streamed events', async () => {
      const events = [
        { type: 'message_start', message: { usage: { input_tokens: 100, output_tokens: 0 } } },
        { type: 'message_delta', usage: { output_tokens: 50 } },
      ];
      mockStream.mockReturnValue(makeAsyncIterable(events));

      // Drain the generator
      for await (const _ of service.stream({ systemPrompt: 's', userMessage: 'm' })) {
        // consume
      }

      const stats = service.getUsageStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalInputTokens).toBe(100);
      expect(stats.totalOutputTokens).toBe(50);
    });

    it('passes correct params to stream API', async () => {
      mockStream.mockReturnValue(makeAsyncIterable([]));

      // Drain
      for await (const _ of service.stream({
        systemPrompt: 'sys prompt',
        userMessage: 'user msg',
        maxTokens: 2048,
        temperature: 0.5,
      })) {
        // consume
      }

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2048,
          temperature: 0.5,
          system: 'sys prompt',
        }),
      );
    });
  });

  // =========================================================================
  // 10. completeWithTools()
  // =========================================================================

  describe('completeWithTools()', () => {
    const tools: any[] = [
      {
        name: 'lookup',
        description: 'Look up data',
        input_schema: { type: 'object', properties: { query: { type: 'string' } } },
      },
    ];

    it('returns content blocks, usage, latencyMs, model, and stopReason', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'result' }],
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: 'end_turn',
        model: 'claude-sonnet-4-5-20250929',
      });

      const result = await service.completeWithTools({
        systemPrompt: 'sys',
        userMessage: 'msg',
        tools,
      });

      expect(result.content).toEqual([{ type: 'text', text: 'result' }]);
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
      expect(result.stopReason).toBe('end_turn');
      expect(result.model).toBe('claude-sonnet-4-5-20250929');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('passes tools to the API call', async () => {
      mockCreate.mockResolvedValue(makeApiResponse());

      await service.completeWithTools({
        systemPrompt: 'sys',
        userMessage: 'msg',
        tools,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools,
        }),
      );
    });

    it('defaults stopReason to end_turn when stop_reason is null', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'result' }],
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: null,
        model: 'claude-sonnet-4-5-20250929',
      });

      const result = await service.completeWithTools({
        systemPrompt: 'sys',
        userMessage: 'msg',
        tools,
      });

      expect(result.stopReason).toBe('end_turn');
    });
  });

  // =========================================================================
  // 11. extractTextContent edge case
  // =========================================================================

  describe('extractTextContent (via complete)', () => {
    it('throws when response has no text blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'x', name: 'fn', input: {} }],
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: 'tool_use',
        model: 'claude-sonnet-4-5-20250929',
      });

      await expect(
        service.complete({ systemPrompt: 's', userMessage: 'm' }),
      ).rejects.toThrow('no text content blocks');
    });

    it('concatenates multiple text blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'text', text: 'Part 2.' },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
        stop_reason: 'end_turn',
        model: 'claude-sonnet-4-5-20250929',
      });

      const result = await service.complete({ systemPrompt: 's', userMessage: 'm' });
      expect(result.content).toBe('Part 1. Part 2.');
    });
  });
});
