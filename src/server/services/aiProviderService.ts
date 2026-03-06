// AI Provider Service — selects the appropriate AI backend for Akil.
//
// Priority: OpenAI (gpt-4o-mini) > Anthropic Claude > disabled
// Provider selection is transparent to callers.

import { openAIService, type OpenAITool, type OpenAIMessage } from './openAIService';
import { claudeService } from './claudeService';
import Anthropic from '@anthropic-ai/sdk';

export type AkilProvider = 'openai' | 'anthropic' | 'none';

export interface AkilToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AkilProviderResult {
  finalText: string;
  toolResults: Array<{ toolName: string; result: string }>;
  provider: AkilProvider;
  inputTokens: number;
  outputTokens: number;
}

export class AIProviderService {
  getProvider(): AkilProvider {
    if (openAIService.isAvailable()) return 'openai';
    if (claudeService.isAvailable()) return 'anthropic';
    return 'none';
  }

  isAvailable(): boolean {
    return this.getProvider() !== 'none';
  }

  /**
   * Run an agentic tool loop using whichever provider is available.
   * Callers pass tool definitions in a provider-agnostic format.
   */
  async completeToolLoop(options: {
    systemPrompt: string;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    tools: AkilToolDefinition[];
    executeToolFn: (toolName: string, toolInput: Record<string, unknown>) => Promise<string>;
    maxIterations?: number;
  }): Promise<AkilProviderResult> {
    const provider = this.getProvider();

    if (provider === 'openai') {
      return this.runWithOpenAI(options);
    }
    if (provider === 'anthropic') {
      return this.runWithAnthropic(options);
    }

    throw new Error(
      'No AI provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable Akil.',
    );
  }

  private async runWithOpenAI(options: {
    systemPrompt: string;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    tools: AkilToolDefinition[];
    executeToolFn: (toolName: string, toolInput: Record<string, unknown>) => Promise<string>;
    maxIterations?: number;
  }): Promise<AkilProviderResult> {
    const openAITools: OpenAITool[] = options.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const messages: OpenAIMessage[] = [
      ...options.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: options.userMessage },
    ];

    const result = await openAIService.completeToolLoop({
      systemPrompt: options.systemPrompt,
      messages,
      tools: openAITools,
      executeToolFn: options.executeToolFn as (toolName: string, toolInput: Record<string, unknown>) => Promise<string>,
      maxIterations: options.maxIterations,
    });

    return {
      finalText: result.finalText,
      toolResults: result.toolResults,
      provider: 'openai',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  }

  private async runWithAnthropic(options: {
    systemPrompt: string;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    tools: AkilToolDefinition[];
    executeToolFn: (toolName: string, toolInput: Record<string, unknown>) => Promise<string>;
    maxIterations?: number;
  }): Promise<AkilProviderResult> {
    const anthropicTools: Anthropic.Tool[] = options.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }));

    const result = await claudeService.completeToolLoop({
      systemPrompt: options.systemPrompt,
      userMessage: options.userMessage,
      conversationHistory: options.conversationHistory,
      tools: anthropicTools,
      executeToolFn: options.executeToolFn as (toolName: string, toolInput: Record<string, any>) => Promise<string>,
      maxIterations: options.maxIterations,
    });

    return {
      finalText: result.finalText,
      toolResults: result.toolResults,
      provider: 'anthropic',
      inputTokens: result.totalUsage.inputTokens,
      outputTokens: result.totalUsage.outputTokens,
    };
  }
}

// Singleton
export const aiProviderService = new AIProviderService();
