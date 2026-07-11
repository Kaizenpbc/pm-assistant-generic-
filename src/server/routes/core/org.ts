import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { organizationService } from '../../services/OrganizationService';
import { userService } from '../../services/UserService';
import { emailService } from '../../services/EmailService';
import { rateLimiter } from '../../middleware/rateLimiter';
import logger from '../../utils/logger';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    'admin', 'executive', 'project_manager', 'team_member', 'scrum_master',
    'finance_officer', 'risk_manager', 'pmo', 'ba', 'qa', 'tester', 'devops', 'claude_sme',
  ]).default('team_member'),
});

export async function orgRoutes(fastify: FastifyInstance) {
  // All org routes require authentication
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.userId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }
  });

  fastify.post('/invite', {
    schema: { description: 'Invite a user to your organization', tags: ['org'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Rate limit: 10 invites per minute
      const rl = rateLimiter.check(`org:invite:${request.user!.userId}`, 10, 60_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many invite attempts. Please try again later.' });
      }

      const { email, role } = inviteSchema.parse(request.body);
      const inviterId = request.user!.userId;

      // Look up the inviter's organization
      const org = await organizationService.findByUserId(inviterId);
      if (!org) {
        return reply.status(403).send({ error: 'No organization', message: 'You are not part of an organization.' });
      }

      // Only org owner or admin can invite
      const inviter = await userService.findById(inviterId);
      if (!inviter) {
        return reply.status(401).send({ error: 'User not found' });
      }
      if (org.ownerUserId !== inviterId && inviter.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only the organization owner or an admin can invite users.' });
      }

      // Check max users limit
      const currentCount = await organizationService.countUsers(org.id);
      if (currentCount >= org.maxUsers) {
        return reply.status(400).send({
          error: 'User limit reached',
          message: `Your organization can have up to ${org.maxUsers} users. Upgrade your plan for more.`,
        });
      }

      // Check if user already exists
      const existingUser = await userService.findByEmail(email);
      if (existingUser) {
        // If already in this org, nothing to do
        const existingOrg = await organizationService.findByUserId(existingUser.id);
        if (existingOrg && existingOrg.id === org.id) {
          return reply.status(409).send({ error: 'Already a member', message: 'This user is already in your organization.' });
        }
        if (existingOrg) {
          return reply.status(409).send({ error: 'User in another organization', message: 'This user already belongs to another organization.' });
        }

        // Add existing user to this org
        await userService.update(existingUser.id, { organizationId: org.id, role } as any);
        organizationService.invalidateUserCache(existingUser.id);

        logger.info('User added to organization via invite', { userId: existingUser.id, orgId: org.id });

        return {
          message: `${email} has been added to your organization.`,
          status: 'added',
        };
      }

      // User doesn't exist yet — send invite email
      // For now, we send a registration link with the org context
      try {
        await emailService.sendOrgInviteEmail(email, org.name, inviter.fullName);
      } catch (emailErr) {
        logger.warn('Failed to send org invite email', { email, error: emailErr });
      }

      return {
        message: `An invitation has been sent to ${email}. They will need to create an account first.`,
        status: 'invited',
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', message: error.issues[0]?.message || 'Invalid input' });
      }
      logger.error('Org invite error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to invite user' });
    }
  });

  // List organization members
  fastify.get('/members', {
    schema: { description: 'List organization members', tags: ['org'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const org = await organizationService.findByUserId(request.user!.userId);
      if (!org) {
        return reply.status(403).send({ error: 'No organization', message: 'You are not part of an organization.' });
      }

      const members = await userService.listByOrganization(org.id);
      return {
        organization: { id: org.id, name: org.name, slug: org.slug },
        members: members.map(m => ({
          id: m.id,
          username: m.username,
          email: m.email,
          fullName: m.fullName,
          role: m.role,
          isActive: m.isActive,
          lastLoginAt: m.lastLoginAt,
        })),
        maxUsers: org.maxUsers,
      };
    } catch (error) {
      logger.error('List org members error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to list members' });
    }
  });
}
