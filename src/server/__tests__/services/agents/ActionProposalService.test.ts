import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionProposalService, CreateProposalInput } from '../../../services/agents/ActionProposalService';

// Mock databaseService
vi.mock('../../../database/connection', () => {
  const rows: any[] = [];
  return {
    databaseService: {
      query: vi.fn(async (sql: string, params?: any[]) => {
        if (sql.startsWith('INSERT')) return { affectedRows: 1 };
        if (sql.startsWith('UPDATE')) return { affectedRows: 1 };
        if (sql.startsWith('SELECT COUNT')) return [{ cnt: 0 }];
        if (sql.startsWith('SELECT')) return rows;
        return [];
      }),
      getConnection: vi.fn(async () => ({
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      })),
    },
  };
});

describe('ActionProposalService', () => {
  let service: ActionProposalService;

  beforeEach(() => {
    service = new ActionProposalService();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a proposal with actions via transaction', async () => {
      const { databaseService } = await import('../../../database/connection');
      const mockConn = {
        beginTransaction: vi.fn(),
        query: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      vi.mocked(databaseService.getConnection).mockResolvedValue(mockConn as any);

      // Mock getById to return the created proposal
      vi.mocked(databaseService.query).mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM agent_proposals')) {
          return [{
            id: 'test-id',
            project_id: 'proj-1',
            schedule_id: 'sched-1',
            agent_id: 'schedule-recovery-v1',
            agent_version: '1.0.0',
            status: 'pending',
            title: 'Test Proposal',
            reasoning: 'Test reasoning',
            summary: 'Test summary',
            confidence_score: 75,
            confidence_factors: null,
            risk_level: 'medium',
            data_snapshot_version: null,
            expires_at: null,
            created_by: 'user-1',
            reviewed_by: null,
            reviewed_at: null,
            executed_at: null,
            rolled_back_at: null,
            created_at: '2026-06-28',
            updated_at: '2026-06-28',
          }];
        }
        if (sql.includes('SELECT * FROM agent_proposal_actions')) {
          return [{
            id: 'action-1',
            proposal_id: 'test-id',
            execution_order: 1,
            action_type: 'update_task_dates',
            target_entity_type: 'task',
            target_entity_id: 'task-1',
            old_value: '{"endDate":"2026-07-01"}',
            new_value: '{"endDate":"2026-07-05"}',
            reasoning: 'Delay accommodation',
            status: 'pending',
            executed_at: null,
            error_message: null,
          }];
        }
        return [];
      });

      const input: CreateProposalInput = {
        projectId: 'proj-1',
        scheduleId: 'sched-1',
        agentId: 'schedule-recovery-v1',
        agentVersion: '1.0.0',
        title: 'Test Proposal',
        reasoning: 'Test reasoning',
        summary: 'Test summary',
        confidenceScore: 75,
        riskLevel: 'medium',
        createdBy: 'user-1',
        actions: [{
          executionOrder: 1,
          actionType: 'update_task_dates',
          targetEntityType: 'task',
          targetEntityId: 'task-1',
          oldValue: { endDate: '2026-07-01' },
          newValue: { endDate: '2026-07-05' },
          reasoning: 'Delay accommodation',
        }],
      };

      const result = await service.create(input);

      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.query).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
      expect(result.status).toBe('pending');
      expect(result.actions).toHaveLength(1);
    });

    it('rolls back transaction on error', async () => {
      const { databaseService } = await import('../../../database/connection');
      const mockConn = {
        beginTransaction: vi.fn(),
        query: vi.fn().mockRejectedValue(new Error('DB error')),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      vi.mocked(databaseService.getConnection).mockResolvedValue(mockConn as any);

      const input: CreateProposalInput = {
        projectId: 'proj-1',
        agentId: 'test',
        agentVersion: '1.0.0',
        title: 'Test',
        reasoning: 'Test',
        summary: 'Test',
        confidenceScore: 50,
        riskLevel: 'low',
        createdBy: 'user-1',
        actions: [],
      };

      await expect(service.create(input)).rejects.toThrow('DB error');
      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('builds correct WHERE clause from filters', async () => {
      const { databaseService } = await import('../../../database/connection');
      vi.mocked(databaseService.query).mockImplementation(async (sql: string) => {
        if (sql.includes('COUNT')) return [{ cnt: 0 }];
        return [];
      });

      await service.list({ projectId: 'proj-1', status: 'pending' });

      const calls = vi.mocked(databaseService.query).mock.calls;
      const countCall = calls.find(c => (c[0] as string).includes('COUNT'));
      expect(countCall).toBeDefined();
      expect(countCall![0]).toContain('project_id = ?');
      expect(countCall![0]).toContain('status = ?');
    });
  });
});
