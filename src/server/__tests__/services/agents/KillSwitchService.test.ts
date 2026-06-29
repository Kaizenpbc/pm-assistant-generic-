import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/AuditLedgerService', () => ({
  auditLedgerService: {
    append: vi.fn().mockResolvedValue(undefined),
  },
}));

import { KillSwitchService } from '../../../services/agents/KillSwitchService';
import { auditLedgerService } from '../../../services/AuditLedgerService';

describe('KillSwitchService', () => {
  let service: KillSwitchService;

  beforeEach(() => {
    service = new KillSwitchService();
    vi.clearAllMocks();
  });

  describe('canRun', () => {
    it('allows by default (everything enabled)', () => {
      const result = service.canRun('agent-a', 'proj-1');
      expect(result.allowed).toBe(true);
    });

    it('blocks when global kill switch is disabled', async () => {
      await service.setGlobalKillSwitch('disable', 'admin-1');
      const result = service.canRun('agent-a', 'proj-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global');
    });

    it('blocks when specific agent is disabled', async () => {
      await service.setAgentDisabled('agent-a', true, 'admin-1');
      expect(service.canRun('agent-a', 'proj-1').allowed).toBe(false);
      expect(service.canRun('agent-b', 'proj-1').allowed).toBe(true);
    });

    it('blocks when specific project is disabled', async () => {
      await service.setProjectDisabled('proj-1', true, 'admin-1');
      expect(service.canRun('agent-a', 'proj-1').allowed).toBe(false);
      expect(service.canRun('agent-a', 'proj-2').allowed).toBe(true);
    });
  });

  describe('setGlobalKillSwitch', () => {
    it('can disable and re-enable', async () => {
      await service.setGlobalKillSwitch('disable', 'admin-1');
      expect(service.getStatus().globalEnabled).toBe(false);

      await service.setGlobalKillSwitch('enable', 'admin-1');
      expect(service.getStatus().globalEnabled).toBe(true);
    });

    it('logs to audit ledger', async () => {
      await service.setGlobalKillSwitch('disable', 'admin-1');
      expect(auditLedgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'agent.kill_switch.global.disable',
        }),
      );
    });
  });

  describe('setAgentDisabled', () => {
    it('can disable and re-enable agents', async () => {
      await service.setAgentDisabled('agent-a', true, 'admin-1');
      expect(service.getStatus().disabledAgents).toContain('agent-a');

      await service.setAgentDisabled('agent-a', false, 'admin-1');
      expect(service.getStatus().disabledAgents).not.toContain('agent-a');
    });
  });

  describe('setProjectDisabled', () => {
    it('can disable and re-enable projects', async () => {
      await service.setProjectDisabled('proj-1', true, 'admin-1');
      expect(service.getStatus().disabledProjects).toContain('proj-1');

      await service.setProjectDisabled('proj-1', false, 'admin-1');
      expect(service.getStatus().disabledProjects).not.toContain('proj-1');
    });
  });

  describe('getStatus', () => {
    it('returns complete status', async () => {
      await service.setAgentDisabled('agent-x', true, 'admin-1');
      await service.setProjectDisabled('proj-x', true, 'admin-1');

      const status = service.getStatus();
      expect(status.globalEnabled).toBe(true);
      expect(status.disabledAgents).toEqual(['agent-x']);
      expect(status.disabledProjects).toEqual(['proj-x']);
    });
  });
});
