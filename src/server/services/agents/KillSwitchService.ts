import { auditLedgerService } from '../AuditLedgerService';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KillSwitchState {
  globalEnabled: boolean;
  disabledAgents: Set<string>;
  disabledProjects: Set<string>;
}

export interface KillSwitchStatus {
  globalEnabled: boolean;
  disabledAgents: string[];
  disabledProjects: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class KillSwitchService {
  private globalEnabled = true;
  private disabledAgents = new Set<string>();
  private disabledProjects = new Set<string>();

  /**
   * Single check combining global, agent-level, and project-level kill switches.
   */
  canRun(agentId: string, projectId: string): { allowed: boolean; reason?: string } {
    if (!this.globalEnabled) {
      return { allowed: false, reason: 'Global kill switch is active — all agents disabled' };
    }

    if (this.disabledAgents.has(agentId)) {
      return { allowed: false, reason: `Agent ${agentId} is disabled via kill switch` };
    }

    if (this.disabledProjects.has(projectId)) {
      return { allowed: false, reason: `Project ${projectId} is disabled via kill switch` };
    }

    return { allowed: true };
  }

  async setGlobalKillSwitch(action: 'enable' | 'disable', userId: string): Promise<void> {
    const previous = this.globalEnabled;
    this.globalEnabled = action === 'enable';

    await auditLedgerService.append({
      actorId: userId,
      actorType: 'user',
      action: `agent.kill_switch.global.${action}`,
      entityType: 'system',
      entityId: 'global',
      payload: { previous, current: this.globalEnabled },
      source: 'api',
    });

    logger.info(`[KillSwitch] Global kill switch ${action}d by ${userId}`);
  }

  async setAgentDisabled(agentId: string, disabled: boolean, userId: string): Promise<void> {
    if (disabled) {
      this.disabledAgents.add(agentId);
    } else {
      this.disabledAgents.delete(agentId);
    }

    await auditLedgerService.append({
      actorId: userId,
      actorType: 'user',
      action: `agent.kill_switch.agent.${disabled ? 'disable' : 'enable'}`,
      entityType: 'agent',
      entityId: agentId,
      payload: { disabled },
      source: 'api',
    });

    logger.info(`[KillSwitch] Agent ${agentId} ${disabled ? 'disabled' : 'enabled'} by ${userId}`);
  }

  async setProjectDisabled(projectId: string, disabled: boolean, userId: string): Promise<void> {
    if (disabled) {
      this.disabledProjects.add(projectId);
    } else {
      this.disabledProjects.delete(projectId);
    }

    await auditLedgerService.append({
      actorId: userId,
      actorType: 'user',
      action: `agent.kill_switch.project.${disabled ? 'disable' : 'enable'}`,
      entityType: 'project',
      entityId: projectId,
      payload: { disabled },
      source: 'api',
    });

    logger.info(`[KillSwitch] Project ${projectId} ${disabled ? 'disabled' : 'enabled'} by ${userId}`);
  }

  getStatus(): KillSwitchStatus {
    return {
      globalEnabled: this.globalEnabled,
      disabledAgents: [...this.disabledAgents],
      disabledProjects: [...this.disabledProjects],
    };
  }
}

export const killSwitchService = new KillSwitchService();
