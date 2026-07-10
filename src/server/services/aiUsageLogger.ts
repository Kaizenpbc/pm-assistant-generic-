import { randomUUID } from 'crypto';
import { aiUsageLogRepository } from '../database/AIUsageLogRepository';
import { TokenUsage } from './claudeService';
import { config } from '../config';
import logger from '../utils/logger';

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

export function calculateCost(_model: string, usage: TokenUsage): number {
  const inputCost = (usage.inputTokens / 1_000_000) * config.AI_PRICING_INPUT;
  const outputCost = (usage.outputTokens / 1_000_000) * config.AI_PRICING_OUTPUT;
  return inputCost + outputCost;
}

export function logAIUsage(entry: AIUsageEntry): void {
  const id = randomUUID();
  const costEstimate = calculateCost(entry.model, entry.usage);

  // Fire-and-forget — don't await, don't block the response
  aiUsageLogRepository.insert(
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
  ).catch((err: Error) => {
    logger.warn('Failed to log AI usage (non-critical):', err.message);
  });
}
