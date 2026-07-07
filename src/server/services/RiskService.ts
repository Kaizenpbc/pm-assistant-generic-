import { riskRepository, ProjectRisk, RiskFilters, RiskStats } from '../database/RiskRepository';
import logger from '../utils/logger';

class RiskService {
  async findByProject(projectId: string, filters: RiskFilters = {}): Promise<ProjectRisk[]> {
    return riskRepository.findByProject(projectId, filters);
  }

  async findById(id: string): Promise<ProjectRisk | null> {
    return riskRepository.findById(id);
  }

  async getStats(projectId: string): Promise<RiskStats> {
    return riskRepository.getStats(projectId);
  }

  async create(data: {
    projectId: string;
    type: 'risk' | 'issue';
    title: string;
    description?: string;
    category?: string;
    severity?: string;
    probability?: number;
    impact?: number;
    status?: string;
    triggerCondition?: string;
    mitigationPlan?: string;
    responsePlan?: string;
    ownerId?: string;
    source?: 'manual' | 'ai_detected' | 'agent';
    sourceAgentId?: string;
    aiConfidence?: number;
    linkedTaskIds?: string[];
    linkedProposalId?: string;
    createdBy: string;
  }): Promise<ProjectRisk> {
    const risk = await riskRepository.create(data);
    logger.info('Risk created: %s project=%s type=%s source=%s', risk.id, data.projectId, data.type, data.source || 'manual');
    return risk;
  }

  async update(id: string, data: Record<string, any>): Promise<ProjectRisk | null> {
    const existing = await riskRepository.findById(id);
    if (!existing) return null;

    // Auto-set resolvedAt when closing
    if (data.status && ['closed', 'resolved', 'mitigated'].includes(data.status) && !existing.resolvedAt) {
      data.resolvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    // Clear resolvedAt if reopening
    if (data.status && ['open', 'monitoring', 'mitigating'].includes(data.status) && existing.resolvedAt) {
      data.resolvedAt = null;
    }

    const updated = await riskRepository.update(id, data);
    logger.info('Risk updated: %s fields=%s', id, Object.keys(data).join(','));
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await riskRepository.deleteById(id);
    if (deleted) logger.info('Risk deleted: %s', id);
    return deleted;
  }

  /**
   * Import risks from AI scan (PredictiveIntelligenceService output).
   * Deduplicates by matching title against existing AI-detected risks.
   */
  async importFromAIScan(
    projectId: string,
    aiRisks: Array<{
      type?: string;
      title: string;
      description: string;
      probability?: number;
      impact?: number;
      severity: string;
      mitigations?: string[];
      affectedTasks?: string[];
    }>,
    userId: string,
  ): Promise<{ imported: number; updated: number; skipped: number }> {
    const existing = await riskRepository.findByProject(projectId, { source: 'ai_detected' });
    const existingTitles = new Map(existing.map(r => [r.title.toLowerCase().trim(), r]));

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const aiRisk of aiRisks) {
      const titleKey = aiRisk.title.toLowerCase().trim();
      const match = existingTitles.get(titleKey);

      if (match) {
        // Update severity/probability if changed
        const updates: Record<string, any> = {};
        if (aiRisk.severity !== match.severity) updates.severity = aiRisk.severity;
        if (aiRisk.probability && aiRisk.probability !== match.probability) updates.probability = aiRisk.probability;
        if (aiRisk.impact && aiRisk.impact !== match.impact) updates.impact = aiRisk.impact;

        if (Object.keys(updates).length > 0) {
          await riskRepository.update(match.id, updates);
          updated++;
        } else {
          skipped++;
        }
      } else {
        await riskRepository.create({
          projectId,
          type: 'risk',
          title: aiRisk.title,
          description: aiRisk.description,
          category: this.mapAICategory(aiRisk.type),
          severity: aiRisk.severity as any,
          probability: aiRisk.probability ?? 3,
          impact: aiRisk.impact ?? 3,
          mitigationPlan: aiRisk.mitigations?.join('\n') || undefined,
          linkedTaskIds: aiRisk.affectedTasks,
          source: 'ai_detected',
          createdBy: userId,
        });
        imported++;
      }
    }

    logger.info('AI risk scan imported: project=%s imported=%d updated=%d skipped=%d', projectId, imported, updated, skipped);
    return { imported, updated, skipped };
  }

  /**
   * Import risks from an agent run. Links to proposal if provided.
   */
  async importFromAgent(
    projectId: string,
    agentId: string,
    risks: Array<{
      title: string;
      description: string;
      category?: string;
      severity: string;
      probability?: number;
      impact?: number;
      linkedTaskIds?: string[];
      aiConfidence?: number;
    }>,
    proposalId?: string,
    userId?: string,
  ): Promise<number> {
    const existing = await riskRepository.findByAgentSource(projectId, agentId);
    const existingTitles = new Set(existing.map(r => r.title.toLowerCase().trim()));

    let created = 0;
    for (const risk of risks) {
      if (existingTitles.has(risk.title.toLowerCase().trim())) continue;

      await riskRepository.create({
        projectId,
        type: 'risk',
        title: risk.title,
        description: risk.description,
        category: risk.category || 'other',
        severity: risk.severity as any,
        probability: risk.probability ?? 3,
        impact: risk.impact ?? 3,
        source: 'agent',
        sourceAgentId: agentId,
        aiConfidence: risk.aiConfidence,
        linkedTaskIds: risk.linkedTaskIds,
        linkedProposalId: proposalId,
        createdBy: userId || 'system',
      });
      created++;
    }

    logger.info('Agent risks imported: project=%s agent=%s created=%d', projectId, agentId, created);
    return created;
  }

  private mapAICategory(aiType?: string): string {
    if (!aiType) return 'other';
    const map: Record<string, string> = {
      schedule: 'schedule',
      budget: 'budget',
      resource: 'resource',
      weather: 'weather',
      regulatory: 'regulatory',
      technical: 'technical',
      stakeholder: 'stakeholder',
      dependency: 'dependency',
    };
    return map[aiType.toLowerCase()] || 'other';
  }
}

export const riskService = new RiskService();
