import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserService } from '../services/UserService';
import { emailService } from '../services/EmailService';
import { stripeService } from '../services/StripeService';

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2).max(100),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export async function authRoutes(fastify: FastifyInstance) {
  const userService = new UserService();

  fastify.post('/login', {
    schema: { description: 'User login', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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

      const accessToken = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
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
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Login failed' });
    }
  });

  fastify.post('/register', {
    schema: { description: 'User registration', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, email, password, fullName } = registerSchema.parse(request.body);

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
        role: 'member',
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        stripeCustomerId: stripeCustomerId || undefined,
      });

      // Update Stripe customer with real user ID
      if (stripeCustomerId && stripeService.isConfigured) {
        // The customer was already created; the metadata will be set via the userId
        // In practice the userId in metadata is set at creation time; here we used 'pending'
        // We can update it if needed, but for now the customerId on the user record is enough
      }

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationToken);

      return reply.status(201).send({
        message: 'Registration successful. Please check your email to verify your account.',
      });
    } catch (error) {
      console.error('Registration error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Registration failed' });
    }
  });

  fastify.get('/verify-email', {
    schema: { description: 'Verify email address', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
      console.error('Email verification error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Email verification failed' });
    }
  });

  fastify.post('/forgot-password', {
    schema: { description: 'Request password reset', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
      console.error('Forgot password error:', error);
      return reply.status(500).send({ error: 'Internal server error', message: 'Password reset request failed' });
    }
  });

  fastify.post('/reset-password', {
    schema: { description: 'Reset password with token', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
      console.error('Reset password error:', error);
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

      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as any;
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
        { expiresIn: '15m' }
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
      console.error('Token refresh error:', error);
      return reply.status(401).send({ error: 'Invalid refresh token', message: 'Refresh token is invalid or expired' });
    }
  });
}
