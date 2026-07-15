import { z } from 'zod';
import { claudeService } from './claudeService';
import { databaseService } from '../database/connection';
import logger from '../utils/logger';
import { config } from '../config';

const EstimationResponseSchema = z.object({
  estimatedDays: z.number().min(0.25).max(365),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

type EstimationResponse = z.infer<typeof EstimationResponseSchema>;

export interface TaskEstimationRequest {
  taskName: string;
  taskDescription?: string;
  projectId: string;
  scheduleId?: string;
}

export interface TaskEstimationResult {
  estimatedDays: number;
  confidence: number;
  reasoning: string;
  historicalDataPoints: number;
  aiPowered: boolean;
}

export class AiTaskEstimationService {
  async estimate(request: TaskEstimationRequest): Promise<TaskEstimationResult> {
    // Gather historical data: completed tasks with both estimated and actual days
    const historicalData = await this.getHistoricalData(request.projectId);

    if (!config.AI_ENABLED || !claudeService.isAvailable()) {
      return this.fallbackEstimate(request.taskName, historicalData);
    }

    try {
      const result = await this.aiEstimate(request, historicalData);
      return result;
    } catch (err) {
      logger.error('[AiTaskEstimation] AI estimation failed, using fallback:', err);
      return this.fallbackEstimate(request.taskName, historicalData);
    }
  }

  private async getHistoricalData(projectId: string): Promise<Array<{
    name: string;
    estimatedDays: number | null;
    actualDays: number | null;
    priority: string;
    status: string;
  }>> {
    // Get completed tasks from the same project + other projects for broader context
    const rows = await databaseService.query<any>(
      `SELECT t.name, t.estimated_days, t.priority, t.status,
              DATEDIFF(t.end_date, t.start_date) AS actual_days
       FROM tasks t
       JOIN schedules s ON t.schedule_id = s.id
       WHERE t.status = 'completed'
         AND t.start_date IS NOT NULL
         AND t.end_date IS NOT NULL
       ORDER BY t.updated_at DESC
       LIMIT 200`,
    );

    return rows.map((r: any) => ({
      name: r.name,
      estimatedDays: r.estimated_days != null ? Number(r.estimated_days) : null,
      actualDays: r.actual_days != null ? Number(r.actual_days) : null,
      priority: r.priority || 'medium',
      status: r.status,
    }));
  }

  private async aiEstimate(
    request: TaskEstimationRequest,
    historicalData: Array<{ name: string; estimatedDays: number | null; actualDays: number | null; priority: string }>,
  ): Promise<TaskEstimationResult> {
    const historyContext = historicalData.length > 0
      ? historicalData
          .slice(0, 50)
          .map((t) => `- "${t.name}" (priority: ${t.priority}) — estimated: ${t.estimatedDays ?? '?'} days, actual: ${t.actualDays ?? '?'} days`)
          .join('\n')
      : '(No historical data available)';

    const systemPrompt = `You are an expert project estimation assistant. Based on historical task data from the project and the new task description, estimate how many working days this task will take.

Consider:
1. Similar tasks in the historical data (name patterns, scope)
2. Whether historical estimates were typically optimistic or pessimistic
3. Task complexity implied by the description
4. Industry norms for similar work

Respond in JSON with: estimatedDays (number, can be fractional like 0.5), confidence (0-100), reasoning (brief explanation).`;

    const userMessage = `## New Task to Estimate
Name: ${request.taskName}
${request.taskDescription ? `Description: ${request.taskDescription}` : ''}

## Historical Completed Tasks (${historicalData.length} total)
${historyContext}

Estimate the duration in working days for this new task.`;

    const result = await claudeService.completeWithJsonSchema<EstimationResponse>({
      systemPrompt,
      userMessage,
      schema: EstimationResponseSchema,
      maxTokens: 512,
    });

    return {
      estimatedDays: result.data.estimatedDays,
      confidence: result.data.confidence,
      reasoning: result.data.reasoning,
      historicalDataPoints: historicalData.length,
      aiPowered: true,
    };
  }

  private fallbackEstimate(
    taskName: string,
    historicalData: Array<{ name: string; estimatedDays: number | null; actualDays: number | null }>,
  ): TaskEstimationResult {
    // Simple heuristic: average actual days of completed tasks, or default to 3
    const withActual = historicalData.filter((t) => t.actualDays != null && t.actualDays > 0);

    if (withActual.length === 0) {
      return {
        estimatedDays: 3,
        confidence: 20,
        reasoning: 'No historical data available. Using default estimate of 3 days.',
        historicalDataPoints: 0,
        aiPowered: false,
      };
    }

    const avgDays = withActual.reduce((sum, t) => sum + t.actualDays!, 0) / withActual.length;
    const rounded = Math.round(avgDays * 2) / 2; // Round to nearest 0.5

    return {
      estimatedDays: Math.max(0.5, rounded),
      confidence: Math.min(60, 20 + withActual.length),
      reasoning: `Based on average actual duration of ${withActual.length} completed tasks (${rounded} days). AI unavailable.`,
      historicalDataPoints: withActual.length,
      aiPowered: false,
    };
  }
}

export const aiTaskEstimationService = new AiTaskEstimationService();
