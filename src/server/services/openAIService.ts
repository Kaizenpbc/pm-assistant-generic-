// OpenAI gpt-4o-mini service for Akil conversational AI layer.
// Uses fetch (no openai SDK) to stay consistent with EmbeddingService pattern.

import { config } from '../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface ToolCallResult {
  toolName: string;
  toolCallId: string;
  result: string;
}

export interface OpenAIToolLoopResult {
  finalText: string;
  toolResults: Array<{ toolName: string; result: string }>;
  inputTokens: number;
  outputTokens: number;
}

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// OpenAIService
// ---------------------------------------------------------------------------

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;

export class OpenAIService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.OPENAI_API_KEY ?? '';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Agentic tool loop: calls OpenAI, executes tool calls, repeats until
   * the model returns a final text response (up to maxIterations).
   */
  async completeToolLoop(options: {
    systemPrompt: string;
    messages: OpenAIMessage[];
    tools: OpenAITool[];
    executeToolFn: (toolName: string, toolInput: Record<string, unknown>) => Promise<string>;
    maxIterations?: number;
    temperature?: number;
    maxTokens?: number;
  }): Promise<OpenAIToolLoopResult> {
    if (!this.isAvailable()) {
      throw new Error('[OpenAIService] OPENAI_API_KEY is not configured.');
    }

    const maxIter = options.maxIterations ?? 5;
    const allToolResults: Array<{ toolName: string; result: string }> = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Build messages array: system prompt + conversation
    const messages: OpenAIMessage[] = [
      { role: 'system', content: options.systemPrompt },
      ...options.messages,
    ];

    for (let i = 0; i < maxIter; i++) {
      const response = await this.callOpenAI({
        messages,
        tools: options.tools,
        temperature: options.temperature ?? 0.3,
        maxTokens: options.maxTokens ?? 1024,
      });

      totalInputTokens += response.usage.prompt_tokens;
      totalOutputTokens += response.usage.completion_tokens;

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('[OpenAIService] No response choice returned from OpenAI.');
      }

      const assistantMessage = choice.message;

      // No tool calls — return final text
      if (choice.finish_reason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
        return {
          finalText: assistantMessage.content ?? '',
          toolResults: allToolResults,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        };
      }

      // Add assistant message (with tool_calls) to history
      messages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls as OpenAIMessage['tool_calls'],
      });

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        let toolResult: string;
        try {
          const toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          toolResult = await options.executeToolFn(toolCall.function.name, toolInput);
        } catch (err) {
          toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }

        allToolResults.push({ toolName: toolCall.function.name, result: toolResult });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // Max iterations reached — make a final call without tools
    const finalResponse = await this.callOpenAI({
      messages,
      tools: [],
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 1024,
    });

    totalInputTokens += finalResponse.usage.prompt_tokens;
    totalOutputTokens += finalResponse.usage.completion_tokens;

    return {
      finalText: finalResponse.choices[0]?.message.content ?? '',
      toolResults: allToolResults,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }

  private async callOpenAI(options: {
    messages: OpenAIMessage[];
    tools: OpenAITool[];
    temperature: number;
    maxTokens: number;
  }): Promise<OpenAIChatResponse> {
    const body: Record<string, unknown> = {
      model: OPENAI_MODEL,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    };

    if (options.tools.length > 0) {
      body['tools'] = options.tools;
      body['tool_choice'] = 'auto';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`[OpenAIService] API error ${res.status}: ${text.slice(0, 300)}`);
      }

      return (await res.json()) as OpenAIChatResponse;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`[OpenAIService] Request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Singleton
export const openAIService = new OpenAIService();
