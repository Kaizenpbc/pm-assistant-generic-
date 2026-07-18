import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { inviteTokenRepository, InviteToken } from '../database/InviteTokenRepository';
import { organizationRepository } from '../database/OrganizationRepository';
import { emailService } from './EmailService';
import { userService } from './UserService';
import logger from '../utils/logger';

const VIEWER_LIMITS: Record<string, number> = {
  trial: 0,
  consultant: 5,
  sme: 999999,
  enterprise: 999999,
};

export class InviteService {
  getViewerLimit(tier: string): number {
    return VIEWER_LIMITS[tier] ?? 0;
  }

  async createInvite(
    inviterUserId: string,
    email: string,
    projectId?: string | null,
    role: string = 'viewer',
  ): Promise<InviteToken> {
    const inviter = await userService.findById(inviterUserId);
    if (!inviter) throw new Error('Inviter not found');

    const org = await organizationRepository.findByUserId(inviterUserId);
    if (!org) throw new Error('Organization not found');

    // For non-viewer roles on per-seat orgs, check seat availability
    if (role !== 'viewer' && org.billingModel === 'per_seat') {
      const { seatService } = await import('./SeatService');
      await seatService.validateSeatAvailability(org.id);
    }

    // Check viewer limit (skip for per-seat orgs — unlimited viewers)
    if (role === 'viewer' && org.billingModel !== 'per_seat') {
      const currentViewers = await inviteTokenRepository.countActiveViewersByOrg(org.id);
      const limit = org.viewerLimit ?? this.getViewerLimit(org.subscriptionTier);
      if (currentViewers >= limit) {
        throw new Error(`Viewer limit reached (${limit}). Upgrade your plan for more viewer seats.`);
      }
    }

    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await inviteTokenRepository.create(
      id, token, inviterUserId, org.id, projectId || null, email, role, expiresAt,
    );

    // Send invite email
    emailService.sendViewerInviteEmail(
      email, org.name, inviter.fullName, projectId || null, token,
    ).catch(err => {
      logger.error('Failed to send viewer invite email', { email, error: err });
    });

    return (await inviteTokenRepository.findById(id))!;
  }

  async acceptInvite(token: string, userId: string): Promise<InviteToken> {
    const invite = await inviteTokenRepository.findByToken(token);
    if (!invite) throw new Error('Invalid or expired invite token');

    await inviteTokenRepository.markAccepted(invite.id, userId);

    // Update user: set organization and role
    const updateData: Record<string, any> = {
      organizationId: invite.organizationId,
      role: invite.role,
    };

    // For non-viewer roles, sync subscription tier/status from org
    if (invite.role !== 'viewer') {
      const org = await organizationRepository.findById(invite.organizationId);
      if (org) {
        updateData.subscriptionTier = org.subscriptionTier;
        updateData.subscriptionStatus = org.subscriptionStatus;
      }
    }

    await userService.update(userId, updateData as any);

    // If invite has a project, add user as project member
    if (invite.projectId) {
      try {
        const { databaseService } = await import('../database/connection');
        await databaseService.query(
          `INSERT IGNORE INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'viewer')`,
          [uuidv4(), invite.projectId, userId],
        );
      } catch (err) {
        logger.error('Failed to add invited user to project', { projectId: invite.projectId, userId, error: err });
      }
    }

    return { ...invite, status: 'accepted' };
  }

  async listInvites(organizationId: string): Promise<InviteToken[]> {
    return inviteTokenRepository.findByOrg(organizationId);
  }

  async revokeInvite(id: string, userId: string, userRole: string): Promise<void> {
    const invite = await inviteTokenRepository.findById(id);
    if (!invite) throw new Error('Invite not found');

    // Verify the revoker belongs to the same org
    const org = await organizationRepository.findByUserId(userId);
    if (!org || org.id !== invite.organizationId) {
      throw new Error('Not authorized to revoke this invite');
    }

    // Only org owner, admin, or project_manager can revoke invites
    if (org.ownerUserId !== userId && userRole !== 'admin' && userRole !== 'project_manager') {
      throw new Error('Not authorized to revoke this invite');
    }

    await inviteTokenRepository.revoke(id);
  }

  async validateToken(token: string): Promise<{ valid: boolean; email?: string; orgName?: string; projectId?: string | null }> {
    const invite = await inviteTokenRepository.findByToken(token);
    if (!invite) return { valid: false };

    const org = await organizationRepository.findById(invite.organizationId);
    return {
      valid: true,
      email: invite.email,
      orgName: org?.name,
      projectId: invite.projectId,
    };
  }
}

export const inviteService = new InviteService();
