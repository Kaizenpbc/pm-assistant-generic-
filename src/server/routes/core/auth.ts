import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { userService } from '../../services/UserService';
import { emailService } from '../../services/EmailService';
import { stripeService } from '../../services/StripeService';
import { organizationService } from '../../services/OrganizationService';
import { provisionTenantDatabase } from '../../database/tenantProvisioner';
import { rateLimiter } from '../../middleware/rateLimiter';
import logger from '../../utils/logger';

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2).max(100),
  organizationName: z.string().min(2).max(255).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', {
    schema: { description: 'User login', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Rate limit: 10 attempts per minute per IP
      const ip = request.ip || 'unknown';
      const rl = rateLimiter.check(`auth:login:${ip}`, 10, 60_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many login attempts. Please try again later.' });
      }

      const { username, password } = loginSchema.parse(request.body);

      const user = await userService.findByUsername(username);
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials', message: 'Username or password is incorrect' });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials', message: 'Username or password is incorrect' });
      }

      if (!user.emailVerified) {
        return reply.status(403).send({
          error: 'Email not verified',
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        });
      }

      // Fire-and-forget: update last login timestamp
      userService.update(user.id, { lastLoginAt: new Date() }).catch((error) => {
        logger.warn('Failed to update last login timestamp', { userId: user.id, error });
      });

      const accessToken = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d', algorithm: 'HS256' }
      );

      reply.setCookie('access_token', accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return {
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          subscriptionTier: user.role === 'admin' ? 'pro' : user.subscriptionTier,
          subscriptionStatus: user.role === 'admin' ? 'active' : user.subscriptionStatus,
          trialEndsAt: user.trialEndsAt ? (user.trialEndsAt instanceof Date ? user.trialEndsAt.toISOString() : String(user.trialEndsAt)) : null,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Login error', { errorMessage: err.message, errorStack: err.stack });
      return reply.status(500).send({ error: 'Internal server error', message: 'Login failed' });
    }
  });

  fastify.post('/register', {
    schema: { description: 'User registration', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Rate limit: 5 registrations per minute per IP
      const ip = request.ip || 'unknown';
      const rl = rateLimiter.check(`auth:register:${ip}`, 5, 60_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many registration attempts. Please try again later.' });
      }

      const { username, email, password, fullName, organizationName } = registerSchema.parse(request.body);

      const existingUsername = await userService.findByUsername(username);
      if (existingUsername) {
        return reply.status(409).send({ error: 'User already exists', message: 'Username is already taken' });
      }

      const existingEmail = await userService.findByEmail(email);
      if (existingEmail) {
        return reply.status(409).send({ error: 'Email already exists', message: 'An account with this email already exists' });
      }

      const verificationToken = crypto.randomUUID();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const passwordHash = await bcrypt.hash(password, 12);

      // Create Stripe customer (if configured)
      const stripeCustomerId = await stripeService.createCustomer(email, fullName, 'pending');

      const user = await userService.create({
        username,
        email,
        passwordHash,
        fullName,
        role: 'team_member',
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        stripeCustomerId: stripeCustomerId || undefined,
      });

      // Set 14-day trial period
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      await userService.update(user.id, {
        trialStartedAt: now,
        trialEndsAt: trialEnd,
      });

      // Multi-tenant: create organization and provision tenant database
      if (config.MULTI_TENANT_ENABLED) {
        const orgName = organizationName || `${fullName}'s Organization`;
        try {
          const org = await organizationService.createOrganization(orgName, user.id, stripeCustomerId || undefined);
          await userService.update(user.id, { organizationId: org.id } as any);
          // Provision tenant DB in background — don't block registration
          provisionTenantDatabase(org.id).catch((err) => {
            logger.error('Tenant provisioning failed', { orgId: org.id, error: err });
          });
        } catch (orgError) {
          logger.error('Organization creation failed during registration', { userId: user.id, error: orgError });
          // Don't fail registration — user is created, org can be provisioned later
        }
      }

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationToken);

      return reply.status(201).send({
        message: 'Registration successful. Please check your email to verify your account.',
      });
    } catch (error) {
      logger.error('Registration error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Registration failed' });
    }
  });

  fastify.get('/verify-email', {
    schema: { description: 'Verify email address', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Rate limit: 10 verifications per minute per IP
      const ip = request.ip || 'unknown';
      const rl = rateLimiter.check(`auth:verify:${ip}`, 10, 60_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many verification attempts. Please try again later.' });
      }

      const { token } = request.query as { token?: string };
      if (!token) {
        return reply.status(400).send({ error: 'Missing token', message: 'Verification token is required' });
      }

      const user = await userService.findByVerificationToken(token);
      if (!user) {
        return reply.status(400).send({ error: 'Invalid token', message: 'Verification token is invalid or expired' });
      }

      await userService.update(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.fullName);

      return { message: 'Email verified successfully. You can now log in.' };
    } catch (error) {
      logger.error('Email verification error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Email verification failed' });
    }
  });

  // Resend verification email — strict rate limit to prevent email spam
  fastify.post('/resend-verification', {
    schema: { description: 'Resend verification email', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ip = request.ip || 'unknown';
      // Strict rate limit: 3 resends per 15 minutes per IP
      const rl = rateLimiter.check(`auth:resend:${ip}`, 3, 15 * 60_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many resend attempts. Please try again later.' });
      }

      const { email } = forgotPasswordSchema.parse(request.body); // reuse: { email: z.string().email() }

      // Always return 200 to prevent email enumeration
      const user = await userService.findByEmail(email);
      if (user && !user.emailVerified) {
        // Per-email rate limit: 1 resend per 5 minutes per email address
        const emailRl = rateLimiter.check(`auth:resend:email:${email}`, 1, 5 * 60_000);
        if (emailRl.allowed) {
          const verificationToken = crypto.randomUUID();
          const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

          await userService.update(user.id, {
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
          });

          await emailService.sendVerificationEmail(email, verificationToken);
        }
      }

      return { message: 'If an unverified account with that email exists, a new verification link has been sent.' };
    } catch (error) {
      logger.error('Resend verification error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to resend verification email' });
    }
  });

  fastify.post('/forgot-password', {
    schema: { description: 'Request password reset', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Rate limit: 5 requests per minute per IP
      const ip = request.ip || 'unknown';
      const rl = rateLimiter.check(`auth:forgot:${ip}`, 5, 60_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many password reset requests. Please try again later.' });
      }

      const { email } = forgotPasswordSchema.parse(request.body);

      // Always return 200 to prevent email enumeration
      const user = await userService.findByEmail(email);
      if (user) {
        const resetToken = crypto.randomUUID();
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await userService.update(user.id, {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        });

        await emailService.sendPasswordResetEmail(email, resetToken);
      }

      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    } catch (error) {
      logger.error('Forgot password error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Password reset request failed' });
    }
  });

  fastify.post('/reset-password', {
    schema: { description: 'Reset password with token', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Rate limit: 5 requests per minute per IP
      const ip = request.ip || 'unknown';
      const rl = rateLimiter.check(`auth:reset:${ip}`, 5, 60_000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Too many password reset attempts. Please try again later.' });
      }

      const { token, password } = resetPasswordSchema.parse(request.body);

      const user = await userService.findByResetToken(token);
      if (!user) {
        return reply.status(400).send({ error: 'Invalid token', message: 'Reset token is invalid or expired' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await userService.update(user.id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      return { message: 'Password reset successful. You can now log in with your new password.' };
    } catch (error) {
      logger.error('Reset password error', { error });
      return reply.status(500).send({ error: 'Internal server error', message: 'Password reset failed' });
    }
  });

  fastify.post('/logout', {
    schema: { description: 'User logout', tags: ['auth'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('access_token');
    reply.clearCookie('refresh_token');
    return { message: 'Logout successful' };
  });

  fastify.post('/refresh', {
    schema: { description: 'Refresh access token', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const refreshToken = request.cookies.refresh_token;
      if (!refreshToken) {
        return reply.status(401).send({ error: 'No refresh token', message: 'Refresh token is required' });
      }

      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as any;
      if (decoded.type !== 'refresh') {
        return reply.status(401).send({ error: 'Invalid token type', message: 'Token is not a refresh token' });
      }

      const user = await userService.findById(decoded.userId);
      if (!user) {
        return reply.status(401).send({ error: 'User not found', message: 'User associated with token not found' });
      }

      const accessToken = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      reply.setCookie('access_token', accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });

      return { message: 'Token refreshed successfully' };
    } catch (error) {
      logger.error('Token refresh error', { error });
      return reply.status(401).send({ error: 'Invalid refresh token', message: 'Refresh token is invalid or expired' });
    }
  });
}
