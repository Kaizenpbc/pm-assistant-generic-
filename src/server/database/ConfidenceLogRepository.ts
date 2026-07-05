import { databaseService } from './connection';

class ConfidenceLogRepository {
  async insert(
    id: string, proposalId: string | null, agentId: string, projectId: string,
    confidenceScore: number, dataQualityScore: number, historicalAccuracyScore: number,
    modelCertaintyScore: number, factors: string,
  ): Promise<void> {
    await databaseService.query(
      `INSERT INTO agent_confidence_log (id, proposal_id, agent_id, project_id, confidence_score, data_quality_score, historical_accuracy_score, model_certainty_score, factors, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, proposalId, agentId, projectId, confidenceScore, dataQualityScore, historicalAccuracyScore, modelCertaintyScore, factors],
    );
  }

  async findFeedbackOutcomes(agentId: string, projectId: string): Promise<Array<{ outcome: string; cnt: number }>> {
    return databaseService.query<{ outcome: string; cnt: number }>(
      `SELECT f.outcome, COUNT(*) AS cnt
       FROM agent_feedback f
       JOIN agent_proposals p ON p.id = f.proposal_id
       WHERE p.agent_id = ? AND p.project_id = ?
       GROUP BY f.outcome
       ORDER BY f.created_at DESC
       LIMIT 20`,
      [agentId, projectId],
    );
  }
}

export const confidenceLogRepository = new ConfidenceLogRepository();
