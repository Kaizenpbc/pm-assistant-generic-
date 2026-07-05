import { databaseService } from './connection';

class AIUsageLogRepository {
  insert(
    id: string, userId: string | null, feature: string, model: string,
    inputTokens: number, outputTokens: number, costEstimate: number,
    latencyMs: number, success: boolean, errorMessage: string | null,
    requestContext: string | null,
  ): Promise<any> {
    return databaseService.query(
      `INSERT INTO ai_usage_log (id, user_id, feature, model, input_tokens, output_tokens, cost_estimate, latency_ms, success, error_message, request_context)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, feature, model, inputTokens, outputTokens, costEstimate, latencyMs, success, errorMessage, requestContext],
    );
  }
}

export const aiUsageLogRepository = new AIUsageLogRepository();
