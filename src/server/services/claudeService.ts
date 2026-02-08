import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompletionOptions {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  responseFormat?: 'text' | 'json';
  maxTokens?: number;
  temperature?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResult {
  content: string;
  usage: TokenUsage;
  latencyMs: number;
  model: string;
}

export interface StreamChunk {
  type: 'text_delta' | 'usage' | 'done';
  content?: string;
  usage?: TokenUsage;
}

interface UsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
}

// Pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-4-20250414': { input: 0.80, output: 4.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };
const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// PromptTemplate
// ---------------------------------------------------------------------------

export class PromptTemplate {
  constructor(
    private template: string,
    private version: string,
  ) {}

  render(variables: Record<string, string>): string {
    let result = this.template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  }

  getVersion(): string {
    return this.version;
  }
}

// ---------------------------------------------------------------------------
// Prompt Templates (GENERIC - no Guyana references)
// ---------------------------------------------------------------------------

export const promptTemplates = {
  taskBreakdown: new PromptTemplate(
    `You are a senior project management AI assistant. Your role is to analyze project descriptions and generate comprehensive, actionable task breakdowns.

Context:
- You operate within a project management application used for diverse project types including IT, construction, infrastructure, roads, and other industries.
- Projects may involve software development, civil engineering, construction, public infrastructure, or any other domain.
- Best practices for project management methodologies (PMBOK, PRINCE2, Agile) should be applied as appropriate.

When analyzing a project, you must:

1. **Identify the project type** (e.g., software development, road construction, building construction, IT infrastructure, etc.).
2. **Break the project into logical phases** with clear milestones and deliverables.
3. **Generate detailed tasks** for each phase. Each task must include:
   - A clear, specific name and description
   - Estimated duration in working days
   - Complexity rating (low, medium, high)
   - Priority level (low, medium, high, urgent)
   - Dependencies on other tasks (by task ID)
   - Risk level (0-100 scale)
   - Required skills and competencies
   - Expected deliverables
4. **Identify the critical path** through the project.
5. **Flag regulatory and compliance requirements** relevant to the project type.
6. **Estimate resource requirements** including personnel categories and approximate headcount.

Project to analyze:
{{projectDescription}}

{{additionalContext}}

Respond in valid JSON matching the requested schema. Be thorough, realistic, and conservative with time estimates.`,
    '1.0.0',
  ),

  riskAssessment: new PromptTemplate(
    `You are a risk management specialist AI. Your role is to identify, categorize, and score project risks with actionable mitigation strategies.

Context:
- You serve a project management platform used across diverse industries.
- Risks span technical, regulatory, financial, environmental, and stakeholder dimensions.
- Risk assessments should be practical and actionable.

When assessing risks, you must:

1. **Identify all material risks** across these categories:
   - Technical risks, Schedule risks, Financial risks, Regulatory risks, Stakeholder risks, Environmental risks, Safety risks, Resource risks

2. **Score each risk** using:
   - Probability (1-5 scale)
   - Impact (1-5 scale)
   - Overall risk score = Probability x Impact (1-25)
   - Risk rating: Low (1-5), Medium (6-10), High (11-15), Critical (16-25)

3. **Provide mitigation strategies** for each risk

4. **Generate an overall risk profile**

Project information:
{{projectDescription}}

Current project status:
{{projectStatus}}

Respond in valid JSON matching the requested schema.`,
    '1.0.0',
  ),

  projectInsights: new PromptTemplate(
    `You are a project health analytics AI. Your role is to analyze project data and generate actionable insights about project health, performance trends, and recommendations.

Context:
- You operate within a project management platform.
- Project health assessments must balance schedule, budget, quality, and resource dimensions.
- Insights should be practical and actionable.

When generating insights, analyze:
1. Schedule Health (planned vs actual, critical path, completion estimate)
2. Budget Health (budgeted vs actual, CPI/SPI, cost forecast)
3. Quality & Compliance
4. Risk Trajectory
5. Prioritized Recommendations

Project data:
{{projectData}}

Time period for analysis:
{{timePeriod}}

Respond in valid JSON matching the requested schema. Insights should be specific, data-driven, and actionable.`,
    '1.0.0',
  ),

  reportGeneration: new PromptTemplate(
    `You are a senior project management reporting AI. Your role is to generate comprehensive, professional reports suitable for executives, project managers, and stakeholders.

Context:
- You serve a project management platform used across diverse industries.
- Reports must be accurate, data-driven, and formatted for professional consumption.
- Use markdown formatting for structure: headings, bullet points, tables, bold/italic emphasis.

Report type requested: {{reportType}}

Instructions by report type:
- **weekly-status**: Summarize project progress, key milestones achieved and upcoming, blockers, resource status, and recommended actions for the coming week.
- **risk-assessment**: Identify and categorize all material risks, score them, provide mitigation strategies, and highlight top risks.
- **budget-forecast**: Analyze budget utilization, calculate earned value metrics (CPI, SPI), forecast final costs, identify variance drivers.
- **resource-utilization**: Analyze team allocation, identify overloaded or underutilized resources, assess capacity, recommend rebalancing.

Current data:
{{projectData}}

Generate a complete, professional report in markdown format. Include an executive summary, detailed analysis, and actionable recommendations.`,
    '1.0.0',
  ),

  meetingNotesExtraction: new PromptTemplate(
    `You are an expert meeting analyst AI. Your role is to analyze raw meeting notes and extract structured, actionable information.

Context:
- Action items must be specific and assignable.
- Decisions should be clearly documented.
- Tasks should be concrete enough to be added directly to a project management tool.

Meeting notes to analyze:
{{meetingNotes}}

{{additionalContext}}

Extract the following:
1. **Summary**: A concise 2-3 sentence summary.
2. **Action Items**: Specific actions with assignees and deadlines where mentioned.
3. **Decisions**: Key decisions made during the meeting.
4. **Tasks**: Concrete tasks for the project management system.
5. **Follow-ups**: Items needing follow-up.

Respond in valid JSON matching the requested schema. Be thorough but concise.`,
    '1.0.0',
  ),

  conversational: new PromptTemplate(
    `You are a knowledgeable and professional AI project management assistant. Your name is PM Assistant.

Context:
- You help project managers, team leads, and executives manage projects across diverse industries.
- Your expertise covers project planning, scheduling, risk management, resource allocation, budgeting, procurement, and stakeholder management.
- You are familiar with project management methodologies (PMBOK, PRINCE2, Agile, Lean) and tools (Gantt charts, critical path method, earned value management).

Guidelines for your responses:
- Be professional, clear, and concise.
- Support your recommendations with reasoning.
- When you are uncertain, say so clearly. Never fabricate information.
- Format responses for readability: use bullet points, numbered lists, and clear headings when appropriate.

Current project context:
{{projectContext}}

User's role: {{userRole}}`,
    '1.0.0',
  ),
};

// ---------------------------------------------------------------------------
// ClaudeService
// ---------------------------------------------------------------------------

export class ClaudeService {
  private client: Anthropic | null = null;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private aiEnabled: boolean;
  private stats: UsageStats = {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCost: 0,
  };

  constructor() {
    this.model = config.AI_MODEL;
    this.maxTokens = config.AI_MAX_TOKENS;
    this.temperature = config.AI_TEMPERATURE;
    this.aiEnabled = config.AI_ENABLED;

    if (this.aiEnabled) {
      if (!config.ANTHROPIC_API_KEY) {
        console.warn(
          '[ClaudeService] AI_ENABLED is true but ANTHROPIC_API_KEY is not configured. ' +
            'AI features will be unavailable until a valid API key is provided.',
        );
        this.aiEnabled = false;
      } else {
        this.client = new Anthropic({
          apiKey: config.ANTHROPIC_API_KEY,
          timeout: REQUEST_TIMEOUT_MS,
          maxRetries: 2,
        });
      }
    }
  }

  isAvailable(): boolean {
    return this.aiEnabled && this.client !== null;
  }

  getUsageStats(): UsageStats {
    return { ...this.stats };
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    this.assertAvailable();

    const startMs = Date.now();
    const effectiveMaxTokens = options.maxTokens ?? this.maxTokens;
    const effectiveTemperature = options.temperature ?? this.temperature;
    const systemPrompt = this.buildSystemPrompt(options.systemPrompt, options.responseFormat);
    const messages = this.buildMessages(options);

    try {
      const response = await this.client!.messages.create({
        model: this.model,
        max_tokens: effectiveMaxTokens,
        temperature: effectiveTemperature,
        system: systemPrompt,
        messages,
        stream: false,
      });

      const latencyMs = Date.now() - startMs;
      const content = this.extractTextContent(response);
      const usage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };

      this.recordUsage(usage);

      return { content, usage, latencyMs, model: response.model };
    } catch (error: unknown) {
      throw this.wrapError(error, 'complete');
    }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    this.assertAvailable();

    const effectiveMaxTokens = options.maxTokens ?? this.maxTokens;
    const effectiveTemperature = options.temperature ?? this.temperature;
    const systemPrompt = this.buildSystemPrompt(options.systemPrompt, options.responseFormat);
    const messages = this.buildMessages(options);

    try {
      const messageStream = this.client!.messages.stream({
        model: this.model,
        max_tokens: effectiveMaxTokens,
        temperature: effectiveTemperature,
        system: systemPrompt,
        messages,
      });

      let accumulatedInputTokens = 0;
      let accumulatedOutputTokens = 0;

      for await (const event of messageStream) {
        switch (event.type) {
          case 'content_block_delta': {
            if (event.delta.type === 'text_delta') {
              yield { type: 'text_delta', content: event.delta.text };
            }
            break;
          }
          case 'message_start': {
            if (event.message?.usage) {
              accumulatedInputTokens = event.message.usage.input_tokens;
              accumulatedOutputTokens = event.message.usage.output_tokens;
            }
            break;
          }
          case 'message_delta': {
            if (event.usage) {
              accumulatedOutputTokens = event.usage.output_tokens;
            }
            break;
          }
          default:
            break;
        }
      }

      const finalUsage: TokenUsage = {
        inputTokens: accumulatedInputTokens,
        outputTokens: accumulatedOutputTokens,
      };

      this.recordUsage(finalUsage);

      yield { type: 'usage', usage: finalUsage };
      yield { type: 'done' };
    } catch (error: unknown) {
      throw this.wrapError(error, 'stream');
    }
  }

  async completeWithJsonSchema<T>(
    options: CompletionOptions & { schema: z.ZodType<T> },
  ): Promise<{ data: T; usage: TokenUsage; latencyMs: number }> {
    const { schema, ...completionOptions } = options;

    const firstResult = await this.complete({
      ...completionOptions,
      responseFormat: 'json',
    });

    const firstParseResult = this.tryParseJson<T>(firstResult.content, schema);
    if (firstParseResult.success) {
      return {
        data: firstParseResult.data,
        usage: firstResult.usage,
        latencyMs: firstResult.latencyMs,
      };
    }

    const correctionHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...(completionOptions.conversationHistory ?? []),
      { role: 'user', content: completionOptions.userMessage },
      { role: 'assistant', content: firstResult.content },
    ];

    const retryResult = await this.complete({
      ...completionOptions,
      responseFormat: 'json',
      conversationHistory: correctionHistory,
      userMessage:
        `Your previous JSON response failed validation. Here is the error:\n\n${firstParseResult.error}\n\n` +
        'Please correct the JSON output and respond with only the fixed, valid JSON. ' +
        'Do not include any explanation or markdown formatting, just the raw JSON object.',
    });

    const retryParseResult = this.tryParseJson<T>(retryResult.content, schema);
    if (retryParseResult.success) {
      const combinedUsage: TokenUsage = {
        inputTokens: firstResult.usage.inputTokens + retryResult.usage.inputTokens,
        outputTokens: firstResult.usage.outputTokens + retryResult.usage.outputTokens,
      };
      return {
        data: retryParseResult.data,
        usage: combinedUsage,
        latencyMs: firstResult.latencyMs + retryResult.latencyMs,
      };
    }

    throw new Error(
      `[ClaudeService] Failed to get valid JSON after retry. Validation error: ${retryParseResult.error}`,
    );
  }

  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error(
        '[ClaudeService] AI service is unavailable. Either AI_ENABLED is false or ' +
          'ANTHROPIC_API_KEY is not configured. Check your environment variables.',
      );
    }
  }

  private buildSystemPrompt(basePrompt: string, responseFormat?: 'text' | 'json'): string {
    if (responseFormat === 'json') {
      return (
        basePrompt +
        '\n\nIMPORTANT: You must respond with ONLY valid JSON. ' +
        'Do not include any markdown code fences, explanatory text, or comments. ' +
        'Your entire response must be a single, parseable JSON object or array.'
      );
    }
    return basePrompt;
  }

  private buildMessages(
    options: CompletionOptions,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (options.conversationHistory && options.conversationHistory.length > 0) {
      for (const msg of options.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: options.userMessage });
    return messages;
  }

  private extractTextContent(response: Anthropic.Message): string {
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );

    if (textBlocks.length === 0) {
      throw new Error(
        '[ClaudeService] Response contained no text content blocks. ' +
          `Stop reason: ${response.stop_reason}`,
      );
    }

    return textBlocks.map((block) => block.text).join('');
  }

  private tryParseJson<T>(
    raw: string,
    schema: z.ZodType<T>,
  ): { success: true; data: T } | { success: false; error: string } {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (jsonError) {
      return {
        success: false,
        error: `JSON parse error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}. Raw content starts with: "${cleaned.slice(0, 200)}"`,
      };
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data as T };
    }

    const issues = (result as { error?: { issues?: Array<{ path?: unknown; message?: string }> } })
      .error?.issues;
    const errorMessage = issues
      ? issues
          .map(
            (issue: { path?: unknown; message?: string }) =>
              `  - ${Array.isArray(issue.path) ? issue.path.join('.') : '(root)'}: ${issue.message ?? 'unknown error'}`,
          )
          .join('\n')
      : 'Schema validation failed';

    return { success: false, error: `Zod validation errors:\n${errorMessage}` };
  }

  private recordUsage(usage: TokenUsage): void {
    this.stats.totalRequests += 1;
    this.stats.totalInputTokens += usage.inputTokens;
    this.stats.totalOutputTokens += usage.outputTokens;

    const pricing = PRICING[this.model] ?? DEFAULT_PRICING;
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    this.stats.estimatedCost += inputCost + outputCost;
  }

  private wrapError(error: unknown, method: string): Error {
    if (error instanceof Anthropic.APIError) {
      const statusCode = error.status;
      const errorMessage = error.message;

      if (statusCode === 401) {
        return new Error(
          `[ClaudeService.${method}] Authentication failed. The ANTHROPIC_API_KEY is invalid or expired.`,
        );
      }
      if (statusCode === 429) {
        return new Error(
          `[ClaudeService.${method}] Rate limit exceeded. Please wait before making additional requests. Details: ${errorMessage}`,
        );
      }
      if (statusCode === 529 || statusCode === 503) {
        return new Error(
          `[ClaudeService.${method}] Anthropic API is temporarily overloaded or unavailable. Please retry later. Details: ${errorMessage}`,
        );
      }
      if (statusCode === 400) {
        return new Error(
          `[ClaudeService.${method}] Bad request sent to Anthropic API. Details: ${errorMessage}`,
        );
      }
      return new Error(
        `[ClaudeService.${method}] Anthropic API error (HTTP ${statusCode}): ${errorMessage}`,
      );
    }

    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new Error(
        `[ClaudeService.${method}] Request to Anthropic API timed out after ${REQUEST_TIMEOUT_MS}ms.`,
      );
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return new Error(
        `[ClaudeService.${method}] Failed to connect to Anthropic API. Details: ${error.message}`,
      );
    }

    if (error instanceof Error) {
      return new Error(`[ClaudeService.${method}] Unexpected error: ${error.message}`);
    }

    return new Error(`[ClaudeService.${method}] Unknown error occurred: ${String(error)}`);
  }
}

// Singleton
export const claudeService = new ClaudeService();
