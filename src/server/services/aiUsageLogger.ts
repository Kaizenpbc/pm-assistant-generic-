import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { TokenUsage } from './claudeService';

export interface AIUsageEntry {
  userId?: string;
  feature: string;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  requestContext?: Record<string, unknown>;
}

// Pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-4-20250414': { input: 0.80, output: 4.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function logAIUsage(fastify: FastifyInstance, entry: AIUsageEntry): void {
  const db = (fastify as any).db;
  if (!db || !db.isHealthy()) return;

  const id = randomUUID();
  const costEstimate = calculateCost(entry.model, entry.usage);

  // Fire-and-forget — don't await, don't block the response
  db.query(
    `INSERT INTO ai_usage_log (id, user_id, feature, model, input_tokens, output_tokens, cost_estimate, latency_ms, success, error_message, request_context)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.userId || null,
      entry.feature,
      entry.model,
      entry.usage.inputTokens,
      entry.usage.outputTokens,
      costEstimate,
      entry.latencyMs,
      entry.success,
      entry.errorMessage || null,
      entry.requestContext ? JSON.stringify(entry.requestContext) : null,
    ],
  ).catch((err: Error) => {
    fastify.log.warn({ err }, 'Failed to log AI usage (non-critical)');
  });
}
