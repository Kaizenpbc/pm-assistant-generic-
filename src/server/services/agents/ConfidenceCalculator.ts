import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../../database/connection';

export interface ConfidenceFactors {
  dataQuality: number;         // 0-100
  historicalAccuracy: number;  // 0-100
  modelCertainty: number;      // 0-100
}

export interface ConfidenceResult {
  score: number;               // 0-100 weighted average
  label: 'very_low' | 'low' | 'medium' | 'high';
  factors: ConfidenceFactors;
  canPropose: boolean;         // score >= 40
  canAutoExecute: boolean;     // score >= 80
}

export interface DataQualityInput {
  totalTasks: number;
  tasksWithDates: number;
  tasksWithAssignments: number;
  tasksUpdatedRecently: number; // updated within 14 days
  hasBudgetData: boolean;
  hasResourceData: boolean;
}

export class ConfidenceCalculator {
  /**
   * Compute overall confidence score from component factors.
   * Weights: data quality 40%, historical accuracy 30%, model certainty 30%
   */
  compute(factors: ConfidenceFactors): ConfidenceResult {
    const score = Math.round(
      factors.dataQuality * 0.4 +
      factors.historicalAccuracy * 0.3 +
      factors.modelCertainty * 0.3,
    );

    const clampedScore = Math.max(0, Math.min(100, score));
    let label: ConfidenceResult['label'];
    if (clampedScore < 40) label = 'very_low';
    else if (clampedScore < 60) label = 'low';
    else if (clampedScore < 80) label = 'medium';
    else label = 'high';

    return {
      score: clampedScore,
      label,
      factors,
      canPropose: clampedScore >= 40,
      canAutoExecute: clampedScore >= 80,
    };
  }

  /**
   * Calculate data quality score based on project data completeness.
   */
  computeDataQuality(input: DataQualityInput): number {
    let score = 100;

    if (input.totalTasks === 0) return 10;

    // Missing dates: -5 per task without dates
    const tasksWithoutDates = input.totalTasks - input.tasksWithDates;
    score -= tasksWithoutDates * 5;

    // Unassigned tasks: -3 per task
    const unassignedTasks = input.totalTasks - input.tasksWithAssignments;
    score -= unassignedTasks * 3;

    // Stale progress: -5 per stale task
    const staleTasks = input.totalTasks - input.tasksUpdatedRecently;
    score -= staleTasks * 5;

    // Missing budget data: -15
    if (!input.hasBudgetData) score -= 15;

    // No resource data: -10
    if (!input.hasResourceData) score -= 10;

    // Very few tasks: -10
    if (input.totalTasks < 5) score -= 10;

    return Math.max(10, Math.min(100, score));
  }

  /**
   * Calculate historical accuracy from past proposal outcomes.
   * Default 50 for new agents with no history.
   */
  async computeHistoricalAccuracy(agentId: string, projectId: string): Promise<number> {
    try {
      const rows = await databaseService.query<{
        outcome: string;
        cnt: number;
      }>(
        `SELECT f.outcome, COUNT(*) AS cnt
         FROM agent_feedback f
         JOIN agent_proposals p ON p.id = f.proposal_id
         WHERE p.agent_id = ? AND p.project_id = ?
         GROUP BY f.outcome
         ORDER BY f.created_at DESC
         LIMIT 20`,
        [agentId, projectId],
      );

      if (rows.length === 0) return 50; // No history — neutral default

      let score = 0;
      let total = 0;
      for (const row of rows) {
        const cnt = Number(row.cnt);
        total += cnt;
        switch (row.outcome) {
          case 'effective': score += cnt * 5; break;
          case 'partially_effective': score += cnt * 2; break;
          case 'ineffective': score -= cnt * 1; break;
          case 'made_worse': score -= cnt * 5; break;
          case 'rolled_back': score -= cnt * 10; break;
        }
      }

      // Normalize to 0-100 range based on max possible score
      const maxPossible = total * 5;
      const normalized = ((score + maxPossible) / (2 * maxPossible)) * 100;
      return Math.max(0, Math.min(100, Math.round(normalized)));
    } catch {
      return 50; // DB error — return neutral
    }
  }

  /**
   * Log confidence score for trend analysis.
   */
  async log(
    agentId: string,
    projectId: string,
    result: ConfidenceResult,
    proposalId?: string,
  ): Promise<void> {
    try {
      await databaseService.query(
        `INSERT INTO agent_confidence_log (id, proposal_id, agent_id, project_id, confidence_score, data_quality_score, historical_accuracy_score, model_certainty_score, factors, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(),
          proposalId ?? null,
          agentId,
          projectId,
          result.score,
          result.factors.dataQuality,
          result.factors.historicalAccuracy,
          result.factors.modelCertainty,
          JSON.stringify(result.factors),
        ],
      );
    } catch (err) {
      console.error('[ConfidenceCalculator] Failed to log confidence:', err);
    }
  }
}

export const confidenceCalculator = new ConfidenceCalculator();
