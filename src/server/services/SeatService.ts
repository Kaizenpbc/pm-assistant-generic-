import { organizationRepository, Organization } from '../database/OrganizationRepository';
import { databaseService } from '../database/connection';
import { createError } from '@fastify/error';
import logger from '../utils/logger';

const NoSeatsError = createError('NO_SEATS_AVAILABLE', 'No available seats. Add a seat first.', 403);
const MinSeatsError = createError('MIN_SEATS', 'Cannot reduce below the 3-seat minimum.', 400);
const SeatsInUseError = createError('SEATS_IN_USE', 'Cannot remove seats that are in use. Remove users first.', 400);
const NotPerSeatError = createError('NOT_PER_SEAT', 'This organization does not use per-seat billing.', 400);
const OrgNotFoundError = createError('ORG_NOT_FOUND', 'Organization not found.', 404);

export interface SeatInfo {
  usedSeats: number;
  paidSeats: number;
  availableSeats: number;
  billingModel: 'flat' | 'per_seat';
  seatPriceCents: number;
}

const MIN_SEATS = 3;

class SeatService {
  async getOrgSeatInfo(orgId: string): Promise<SeatInfo> {
    const org = await organizationRepository.findById(orgId);
    if (!org) throw new OrgNotFoundError();

    const usedSeats = await organizationRepository.countNonViewerUsers(orgId);
    const paidSeats = org.seatCount;

    return {
      usedSeats,
      paidSeats,
      availableSeats: Math.max(0, paidSeats - usedSeats),
      billingModel: org.billingModel,
      seatPriceCents: org.seatPriceCents,
    };
  }

  /**
   * Validate seat availability using SELECT FOR UPDATE to prevent race conditions
   * between concurrent seat additions and PM invites.
   */
  async validateSeatAvailability(orgId: string): Promise<void> {
    await databaseService.transaction(async (conn) => {
      const [orgRow] = await conn.query(
        'SELECT seat_count, billing_model FROM organizations WHERE id = ? FOR UPDATE',
        [orgId],
      ) as any[];
      if (!orgRow || orgRow.billing_model !== 'per_seat') return;

      const [countRow] = await conn.query(
        "SELECT COUNT(*) as cnt FROM users WHERE organization_id = ? AND role != 'viewer' AND is_active = 1",
        [orgId],
      ) as any[];
      const usedSeats = countRow?.cnt ?? 0;

      if (usedSeats >= orgRow.seat_count) {
        throw new NoSeatsError();
      }
    });
  }

  async addSeats(orgId: string, count: number): Promise<{ newSeatCount: number }> {
    const org = await organizationRepository.findById(orgId);
    if (!org) throw new OrgNotFoundError();
    if (org.billingModel !== 'per_seat') throw new NotPerSeatError();

    const newCount = org.seatCount + count;

    // Update Stripe quantity (skip if Stripe not configured — dev/staging)
    if (org.stripeSubscriptionId && org.stripeSubscriptionItemId) {
      const { stripeService } = await import('./StripeService');
      if (stripeService.isConfigured) {
        await stripeService.updateSeatQuantity(
          org.stripeSubscriptionId,
          org.stripeSubscriptionItemId,
          newCount,
        );
      } else {
        logger.warn('Stripe not configured; skipping seat quantity update', { orgId, newCount });
      }
    }

    await organizationRepository.update(orgId, { seatCount: newCount });
    return { newSeatCount: newCount };
  }

  async removeSeats(orgId: string, count: number): Promise<{ newSeatCount: number }> {
    const org = await organizationRepository.findById(orgId);
    if (!org) throw new OrgNotFoundError();
    if (org.billingModel !== 'per_seat') throw new NotPerSeatError();

    const newCount = org.seatCount - count;
    if (newCount < MIN_SEATS) throw new MinSeatsError();

    const usedSeats = await organizationRepository.countNonViewerUsers(orgId);
    if (usedSeats > newCount) throw new SeatsInUseError();

    // Update Stripe quantity (skip if Stripe not configured — dev/staging)
    if (org.stripeSubscriptionId && org.stripeSubscriptionItemId) {
      const { stripeService } = await import('./StripeService');
      if (stripeService.isConfigured) {
        await stripeService.updateSeatQuantity(
          org.stripeSubscriptionId,
          org.stripeSubscriptionItemId,
          newCount,
        );
      } else {
        logger.warn('Stripe not configured; skipping seat quantity update', { orgId, newCount });
      }
    }

    await organizationRepository.update(orgId, { seatCount: newCount });
    return { newSeatCount: newCount };
  }

  async countUsedSeats(orgId: string): Promise<number> {
    return organizationRepository.countNonViewerUsers(orgId);
  }
}

export const seatService = new SeatService();
