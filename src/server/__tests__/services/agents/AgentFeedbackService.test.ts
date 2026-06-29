import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/agents/ActionProposalService', () => ({
  actionProposalService: {
    getById: vi.fn(),
    submitFeedback: vi.fn().mockResolvedValue(undefined),
  },
}));

import { AgentFeedbackService } from '../../../services/agents/AgentFeedbackService';
import { actionProposalService } from '../../../services/agents/ActionProposalService';
import { databaseService } from '../../../database/connection';

describe('AgentFeedbackService', () => {
  let service: AgentFeedbackService;

  beforeEach(() => {
    service = new AgentFeedbackService();
    vi.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('throws if proposal not found', async () => {
      vi.mocked(actionProposalService.getById).mockResolvedValue(null);
      await expect(service.submitFeedback({
        proposalId: 'missing', submittedBy: 'user-1', outcome: 'effective',
      })).rejects.toThrow('Proposal missing not found');
    });

    it('submits feedback with health metrics', async () => {
      vi.mocked(actionProposalService.getById).mockResolvedValue({
        id: 'p1', projectId: 'proj-1',
      } as any);

      // captureProjectHealthSnapshot query
      vi.mocked(databaseService.query).mockResolvedValue([
        { status: 'completed', cnt: 5, end_date: null },
        { status: 'in_progress', cnt: 3, end_date: '2099-12-31' },
      ] as any);

      await service.submitFeedback({
        proposalId: 'p1', submittedBy: 'user-1', outcome: 'effective', comment: 'Great fix',
      });

      expect(actionProposalService.submitFeedback).toHaveBeenCalledWith(
        'p1', 'user-1', 'effective', 'Great fix', undefined,
        expect.objectContaining({ totalTasks: 8, completedPercent: 63 }),
      );
    });
  });

  describe('captureProjectHealthSnapshot', () => {
    it('returns zeroes on error', async () => {
      vi.mocked(databaseService.query).mockRejectedValue(new Error('db error'));
      const snapshot = await service.captureProjectHealthSnapshot('proj-1');
      expect(snapshot.totalTasks).toBe(0);
    });

    it('counts overdue tasks correctly', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([
        { status: 'in_progress', cnt: 2, end_date: '2020-01-01' }, // overdue
        { status: 'completed', cnt: 3, end_date: null },
      ] as any);

      const snapshot = await service.captureProjectHealthSnapshot('proj-1');
      expect(snapshot.overdue).toBe(2);
      expect(snapshot.onTrack).toBe(3); // completed
      expect(snapshot.completedPercent).toBe(60);
    });
  });

  describe('getStatsByAgent', () => {
    it('aggregates feedback stats by agent', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([
        { agent_id: 'agent-a', outcome: 'effective', cnt: 5 },
        { agent_id: 'agent-a', outcome: 'ineffective', cnt: 2 },
        { agent_id: 'agent-b', outcome: 'effective', cnt: 3 },
      ] as any);

      const stats = await service.getStatsByAgent();
      expect(stats).toHaveLength(2);

      const agentA = stats.find(s => s.agentId === 'agent-a')!;
      expect(agentA.effective).toBe(5);
      expect(agentA.ineffective).toBe(2);
      expect(agentA.total).toBe(7);
      expect(agentA.successRate).toBe(71); // 5/7 = 71%

      const agentB = stats.find(s => s.agentId === 'agent-b')!;
      expect(agentB.successRate).toBe(100);
    });

    it('filters by agent when specified', async () => {
      vi.mocked(databaseService.query).mockResolvedValue([] as any);
      await service.getStatsByAgent('agent-a');
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.agent_id = ?'),
        ['agent-a'],
      );
    });
  });
});
