import { databaseService } from '../../database/connection';
import { actionProposalRepository } from '../../database/ActionProposalRepository';
import { actionProposalService, ProposalStatus } from './ActionProposalService';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StalenessCheck {
  isStale: boolean;
  reason?: string;
}

export interface EntityConflictCheck {
  hasConflict: boolean;
  conflictingProposalId?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ConflictResolver {
  /**
   * Check if a proposal's data snapshot is still valid by comparing
   * against the current state of the targeted entities.
   */
  async checkStaleness(proposalId: string): Promise<StalenessCheck> {
    const proposal = await actionProposalService.getById(proposalId);
    if (!proposal) {
      return { isStale: true, reason: 'Proposal not found' };
    }

    if (proposal.status !== 'pending') {
      return { isStale: false };
    }

    if (!proposal.dataSnapshotVersion) {
      return { isStale: false };
    }

    // Check if any targeted tasks have been updated since the proposal was created
    const actions = proposal.actions ?? await actionProposalService.getActions(proposalId);
    const taskIds = actions
      .filter(a => a.targetEntityType === 'task')
      .map(a => a.targetEntityId);

    if (taskIds.length === 0) {
      return { isStale: false };
    }

    const placeholders = taskIds.map(() => '?').join(',');
    const rows = await databaseService.query<{ id: string; updated_at: string }>(
      `SELECT id, updated_at FROM tasks WHERE id IN (${placeholders}) AND updated_at > ?`,
      [...taskIds, proposal.createdAt],
    );

    if (rows.length > 0) {
      const updatedIds = rows.map(r => r.id).join(', ');
      return {
        isStale: true,
        reason: `Target entities modified since proposal creation: ${updatedIds}`,
      };
    }

    return { isStale: false };
  }

  /**
   * Expire all pending proposals that target a specific entity,
   * typically called when a human edits that entity directly.
   */
  async invalidateConflictingProposals(entityType: string, entityId: string): Promise<number> {
    const proposalIds = await actionProposalRepository.findConflictingProposalIds(entityType, entityId);

    let invalidated = 0;
    for (const id of proposalIds) {
      await actionProposalService.updateStatus(id, 'expired');
      invalidated++;
    }

    if (invalidated > 0) {
      logger.info(`[ConflictResolver] Invalidated ${invalidated} proposal(s) targeting ${entityType}:${entityId}`);
    }

    return invalidated;
  }

  /**
   * Check if another agent already has a pending proposal targeting the same entity.
   * Prevents two agents from proposing conflicting changes in a single scan.
   */
  async checkEntityConflict(agentId: string, targetEntityId: string): Promise<EntityConflictCheck> {
    const row = await actionProposalRepository.findEntityConflict(targetEntityId, agentId);

    if (row) {
      return { hasConflict: true, conflictingProposalId: row.id };
    }

    return { hasConflict: false };
  }

  /**
   * Batch check all pending proposals for staleness and expire stale ones.
   */
  async sweepStaleProposals(): Promise<number> {
    const { proposals } = await actionProposalService.list({ status: 'pending' as ProposalStatus, limit: 100 });
    let expired = 0;

    for (const proposal of proposals) {
      const check = await this.checkStaleness(proposal.id);
      if (check.isStale) {
        await actionProposalService.updateStatus(proposal.id, 'expired');
        logger.info(`[ConflictResolver] Expired stale proposal ${proposal.id}: ${check.reason}`);
        expired++;
      }
    }

    return expired;
  }
}

export const conflictResolver = new ConflictResolver();
