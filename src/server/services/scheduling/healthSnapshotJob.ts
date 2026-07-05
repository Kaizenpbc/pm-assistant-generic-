import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../../database/connection';
import { PredictiveIntelligenceService } from '../predictiveIntelligence';
import logger from '../../utils/logger';

// Minimal fastify-like object for PredictiveIntelligenceService constructor
const fakeFastify = { log: logger } as any;

export async function runHealthSnapshot(): Promise<number> {
  let projects: any[];
  try {
    projects = await databaseService.query(
      "SELECT id FROM projects WHERE status IN ('active', 'in_progress')"
    );
  } catch {
    logger.warn('[HealthSnapshot] Could not query projects — table may not exist');
    return 0;
  }

  if (projects.length === 0) return 0;

  const service = new PredictiveIntelligenceService(fakeFastify);
  let recorded = 0;

  for (const project of projects) {
    try {
      const result = await service.getProjectHealthScore(project.id);
      await databaseService.query(
        `INSERT INTO project_health_history (id, project_id, health_score, risk_level, schedule_health, budget_health, risk_health, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(),
          project.id,
          result.healthScore,
          result.riskLevel,
          result.breakdown.scheduleHealth,
          result.breakdown.budgetHealth,
          result.breakdown.riskHealth,
        ]
      );
      recorded++;
    } catch (err) {
      logger.error(`[HealthSnapshot] Failed for project ${project.id}:`, err);
    }
  }

  if (recorded > 0) {
    logger.info(`[HealthSnapshot] Recorded health scores for ${recorded}/${projects.length} projects`);
  }
  return recorded;
}
