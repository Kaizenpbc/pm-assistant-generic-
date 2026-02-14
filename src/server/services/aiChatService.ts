import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { claudeService, promptTemplates, type StreamChunk, type CompletionResult } from './claudeService';
import { AIContextBuilder } from './aiContextBuilder';
import { logAIUsage } from './aiUsageLogger';
import { AI_TOOLS, MUTATING_TOOLS } from './aiToolDefinitions';
import { AIActionExecutor, type ActionResult } from './aiActionExecutor';
import { databaseService } from '../database/connection';
import { toCamelCaseKeys } from '../utils/caseConverter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    type: 'dashboard' | 'project' | 'schedule' | 'reports' | 'general';
    projectId?: string;
  };
  userId: string;
  userRole: string;
  enableTools?: boolean;
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: ActionResult[];
}

interface StoredConversation {
  id: string;
  userId: string;
  projectId?: string;
  contextType: string;
  title: string;
  messages: StoredMessage[];
  tokenCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// AIChatService
// ---------------------------------------------------------------------------

export class AIChatService {
  private fastify: FastifyInstance;
  private contextBuilder: AIContextBuilder;
  private actionExecutor: AIActionExecutor;
  private static conversations: Map<string, StoredConversation> = new Map();

  private get useDb() { return databaseService.isHealthy(); }

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.contextBuilder = new AIContextBuilder(fastify);
    this.actionExecutor = new AIActionExecutor();
  }

  private rowToConversation(row: any): StoredConversation {
    const c = toCamelCaseKeys(row);
    return {
      ...c,
      messages: typeof c.messages === 'string' ? JSON.parse(c.messages) : c.messages,
      tokenCount: Number(c.tokenCount),
      isActive: Boolean(c.isActive),
      createdAt: new Date(c.createdAt).toISOString(),
      updatedAt: new Date(c.updatedAt).toISOString(),
    } as StoredConversation;
  }

  // -----------------------------------------------------------------------
  // Non-streaming chat WITH tool execution
  // -----------------------------------------------------------------------

  async sendMessage(req: ChatRequest): Promise<{
    reply: string;
    conversationId: string;
    aiPowered: boolean;
    actions?: ActionResult[];
  }> {
    if (!claudeService.isAvailable()) {
      return {
        reply:
          'AI features are currently disabled. Please check that the ANTHROPIC_API_KEY is configured and AI_ENABLED is set to true.',
        conversationId: req.conversationId || randomUUID(),
        aiPowered: false,
      };
    }

    const { systemPrompt, history } = await this.prepareConversation(req);
    const enableTools = req.enableTools !== false; // tools enabled by default

    try {
      if (enableTools) {
        // Use the tool loop — Claude can call tools and we execute them
        const actionContext = { userId: req.userId, userRole: req.userRole };
        const allActions: ActionResult[] = [];

        const result = await claudeService.completeToolLoop({
          systemPrompt,
          userMessage: req.message,
          conversationHistory: history,
          temperature: 0.5,
          tools: AI_TOOLS,
          executeToolFn: async (toolName: string, toolInput: Record<string, any>) => {
            const actionResult = await this.actionExecutor.execute(toolName, toolInput, actionContext);
            allActions.push(actionResult);
            // Return the result as a string for Claude to interpret
            return JSON.stringify(actionResult);
          },
        });

        const conversationId = await this.persistConversation(
          req,
          result.finalText,
          result.totalUsage.inputTokens + result.totalUsage.outputTokens,
          allActions.length > 0 ? allActions : undefined,
        );

        logAIUsage(this.fastify, {
          userId: req.userId,
          feature: 'chat-tools',
          model: 'claude',
          usage: result.totalUsage,
          latencyMs: result.totalLatencyMs,
          success: true,
          requestContext: {
            conversationId,
            contextType: req.context?.type,
            toolsUsed: result.toolResults.map(t => t.toolName),
          },
        });

        return {
          reply: result.finalText,
          conversationId,
          aiPowered: true,
          actions: allActions.length > 0 ? allActions : undefined,
        };
      } else {
        // Plain completion without tools
        const result: CompletionResult = await claudeService.complete({
          systemPrompt,
          userMessage: req.message,
          conversationHistory: history,
          temperature: 0.5,
        });

        const conversationId = await this.persistConversation(req, result.content, result.usage.inputTokens + result.usage.outputTokens);

        logAIUsage(this.fastify, {
          userId: req.userId,
          feature: 'chat',
          model: 'claude',
          usage: result.usage,
          latencyMs: result.latencyMs,
          success: true,
          requestContext: { conversationId, contextType: req.context?.type },
        });

        return { reply: result.content, conversationId, aiPowered: true };
      }
    } catch (error) {
      this.fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Chat completion failed');

      logAIUsage(this.fastify, {
        userId: req.userId,
        feature: 'chat-tools',
        model: 'claude',
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return {
        reply: 'I encountered an error processing your request. Please try again in a moment.',
        conversationId: req.conversationId || randomUUID(),
        aiPowered: false,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Streaming chat (tools not supported in streaming mode)
  // -----------------------------------------------------------------------

  async *streamMessage(req: ChatRequest): AsyncGenerator<
    StreamChunk & { conversationId?: string; actions?: ActionResult[] }
  > {
    if (!claudeService.isAvailable()) {
      yield {
        type: 'text_delta' as const,
        content:
          'AI features are currently disabled. Please check that the ANTHROPIC_API_KEY is configured and AI_ENABLED is set to true.',
      };
      yield { type: 'done' as const, conversationId: req.conversationId || randomUUID() };
      return;
    }

    const { systemPrompt, history } = await this.prepareConversation(req);

    let fullReply = '';
    let conversationId = req.conversationId || randomUUID();

    try {
      const stream = claudeService.stream({
        systemPrompt,
        userMessage: req.message,
        conversationHistory: history,
        temperature: 0.5,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'text_delta') {
          fullReply += chunk.content ?? '';
          yield chunk;
        } else if (chunk.type === 'usage') {
          conversationId = await this.persistConversation(
            req,
            fullReply,
            (chunk.usage?.inputTokens ?? 0) + (chunk.usage?.outputTokens ?? 0),
          );

          logAIUsage(this.fastify, {
            userId: req.userId,
            feature: 'chat-stream',
            model: 'claude',
            usage: chunk.usage!,
            latencyMs: 0,
            success: true,
            requestContext: { conversationId, contextType: req.context?.type },
          });

          yield chunk;
        } else if (chunk.type === 'done') {
          yield { ...chunk, conversationId };
        }
      }
    } catch (error) {
      this.fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Chat stream failed');

      logAIUsage(this.fastify, {
        userId: req.userId,
        feature: 'chat-stream',
        model: 'claude',
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      yield {
        type: 'text_delta' as const,
        content: '\n\n[An error occurred while generating the response. Please try again.]',
      };
      yield { type: 'done' as const, conversationId };
    }
  }

  // -----------------------------------------------------------------------
  // Conversation CRUD (dual-mode: DB + in-memory)
  // -----------------------------------------------------------------------

  async getConversations(userId: string): Promise<any[]> {
    if (this.useDb) {
      const rows = await databaseService.query(
        `SELECT * FROM chat_conversations WHERE user_id = ? AND is_active = TRUE ORDER BY updated_at DESC LIMIT 50`,
        [userId],
      );
      return rows.map((row: any) => {
        const c = this.rowToConversation(row);
        return {
          id: c.id,
          title: c.title,
          contextType: c.contextType,
          projectId: c.projectId,
          tokenCount: c.tokenCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      });
    }

    const convos: any[] = [];
    for (const conv of AIChatService.conversations.values()) {
      if (conv.userId === userId && conv.isActive) {
        convos.push({
          id: conv.id,
          title: conv.title,
          contextType: conv.contextType,
          projectId: conv.projectId,
          tokenCount: conv.tokenCount,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        });
      }
    }
    return convos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50);
  }

  async getConversation(conversationId: string, userId: string): Promise<any | null> {
    if (this.useDb) {
      const rows = await databaseService.query(
        `SELECT * FROM chat_conversations WHERE id = ? AND user_id = ? AND is_active = TRUE`,
        [conversationId, userId],
      );
      if (rows.length === 0) return null;
      return this.rowToConversation(rows[0]);
    }

    const conv = AIChatService.conversations.get(conversationId);
    if (!conv || conv.userId !== userId || !conv.isActive) return null;
    return { ...conv };
  }

  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    if (this.useDb) {
      await databaseService.query(
        `UPDATE chat_conversations SET is_active = FALSE WHERE id = ? AND user_id = ?`,
        [conversationId, userId],
      );
    }

    const conv = AIChatService.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) return false;
    conv.isActive = false;
    return true;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async prepareConversation(req: ChatRequest): Promise<{
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }> {
    let projectContext = 'No specific project context.';
    if (req.context?.projectId) {
      try {
        const ctx = await this.contextBuilder.buildProjectContext(req.context.projectId);
        projectContext = this.contextBuilder.toPromptString(ctx);
      } catch {
        projectContext = `Project ID: ${req.context.projectId} (context unavailable)`;
      }
    } else if (req.context?.type === 'dashboard' || req.context?.type === 'reports') {
      try {
        const ctx = await this.contextBuilder.buildPortfolioContext();
        projectContext = this.contextBuilder.portfolioToPromptString(ctx);
      } catch {
        projectContext = 'Portfolio context unavailable.';
      }
    }

    const systemPrompt = promptTemplates.conversational.render({
      projectContext,
      userRole: req.userRole || 'member',
    });

    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (req.conversationId) {
      const conv = await this.getConversation(req.conversationId, req.userId);
      if (conv?.messages) {
        const stored: StoredMessage[] = conv.messages;
        history = stored.slice(-20).map((m: StoredMessage) => ({ role: m.role, content: m.content }));
      }
    }

    return { systemPrompt, history };
  }

  private async persistConversation(
    req: ChatRequest,
    assistantReply: string,
    tokenCount: number,
    actions?: ActionResult[],
  ): Promise<string> {
    const now = new Date().toISOString();
    const userMsg: StoredMessage = { role: 'user', content: req.message, timestamp: now };
    const assistantMsg: StoredMessage = { role: 'assistant', content: assistantReply, timestamp: now, actions };

    if (req.conversationId && AIChatService.conversations.has(req.conversationId)) {
      const conv = AIChatService.conversations.get(req.conversationId)!;
      if (conv.userId === req.userId) {
        conv.messages.push(userMsg, assistantMsg);
        conv.tokenCount += tokenCount;
        conv.updatedAt = now;

        // Update DB
        if (this.useDb) {
          await databaseService.query(
            `UPDATE chat_conversations SET messages = ?, token_count = token_count + ?, updated_at = ? WHERE id = ? AND user_id = ?`,
            [JSON.stringify(conv.messages), tokenCount, new Date(now), req.conversationId, req.userId],
          );
        }

        return req.conversationId;
      }
    }

    // Also check DB for existing conversation not in memory
    if (req.conversationId && this.useDb) {
      const rows = await databaseService.query(
        `SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?`,
        [req.conversationId, req.userId],
      );
      if (rows.length > 0) {
        const existing = this.rowToConversation(rows[0]);
        existing.messages.push(userMsg, assistantMsg);
        await databaseService.query(
          `UPDATE chat_conversations SET messages = ?, token_count = token_count + ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          [JSON.stringify(existing.messages), tokenCount, new Date(now), req.conversationId, req.userId],
        );
        return req.conversationId;
      }
    }

    const id = randomUUID();
    const title = req.message.slice(0, 100) + (req.message.length > 100 ? '...' : '');

    const newConv: StoredConversation = {
      id,
      userId: req.userId,
      projectId: req.context?.projectId,
      contextType: req.context?.type || 'general',
      title,
      messages: [userMsg, assistantMsg],
      tokenCount,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // Persist to DB
    if (this.useDb) {
      await databaseService.query(
        `INSERT INTO chat_conversations (id, user_id, project_id, context_type, title, messages, token_count, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.userId,
          req.context?.projectId || null,
          req.context?.type || 'general',
          title,
          JSON.stringify([userMsg, assistantMsg]),
          tokenCount,
          true,
          new Date(now),
          new Date(now),
        ],
      );
    }

    // Also keep in-memory
    AIChatService.conversations.set(id, newConv);

    return id;
  }
}
