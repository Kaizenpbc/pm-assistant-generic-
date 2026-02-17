import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserService } from '../services/UserService';

const loginSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(1).max(128),
});

/** Schema to validate the refresh-token JWT payload. */
const refreshPayloadSchema = z.object({
  userId: z.string().min(1),
  type: z.literal('refresh'),
});

const registerSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  fullName: z.string().min(2).max(255),
});

/** Dummy bcrypt hash used to equalize timing when user is not found. */
const DUMMY_HASH = '$2b$12$LJ3m4ys3Lp0Mf0kPrGaXaOQSaZfwGBMqB1G6g/K5GrlGOoH1GCSG';

export async function authRoutes(fastify: FastifyInstance) {
  const userService = new UserService();

  fastify.post('/login', {
    schema: { description: 'User login', tags: ['auth'] },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, password } = loginSchema.parse(request.body);

      const user = await userService.findByUsername(username);

      // Always run bcrypt.compare to prevent timing-based username enumeration
      const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
      const isValidPassword = await bcrypt.compare(password, hashToCompare);

      if (!user || !isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials', message: 'Username or password is incorrect' });
      }

      // Block deactivated accounts
      if (!user.isActive) {
        return reply.status(401).send({ error: 'Invalid credentials', message: 'Username or password is incorrect' });
      }

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
        maxAge: 15 * 60, // 15 minutes in seconds
      });

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      });

      return {
        message: 'Login successful',
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role },
      };
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Login error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Login failed' });
    }
  });

  fastify.post('/register', {
    schema: { description: 'User registration', tags: ['auth'] },
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, email, password, fullName } = registerSchema.parse(request.body);

      // Normalize to prevent case-sensitive duplicates
      const normalizedUsername = username.toLowerCase();
      const normalizedEmail = email.toLowerCase();

      const existingUser = await userService.findByUsername(normalizedUsername);
      const existingEmail = await userService.findByEmail(normalizedEmail);
      if (existingUser || existingEmail) {
        return reply.status(409).send({ error: 'Registration failed', message: 'An account with this username or email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await userService.create({ username: normalizedUsername, email: normalizedEmail, passwordHash, fullName, role: 'member' });

      return reply.status(201).send({
        message: 'User created successfully',
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role },
      });
    } catch (error) {
      if (error instanceof ZodError) return reply.status(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
      request.log.error({ err: error }, 'Registration error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Registration failed' });
    }
  });

  fastify.post('/logout', {
    schema: { description: 'User logout', tags: ['auth'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { message: 'Logout successful' };
  });

  fastify.post('/refresh', {
    schema: { description: 'Refresh access token', tags: ['auth'] },
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const refreshToken = request.cookies.refresh_token;
      if (!refreshToken) {
        return reply.status(401).send({ error: 'No refresh token', message: 'Refresh token is required' });
      }

      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
      const payload = refreshPayloadSchema.parse(decoded);

      const user = await userService.findById(payload.userId);
      if (!user) {
        return reply.status(401).send({ error: 'User not found', message: 'User associated with token not found' });
      }

      // Block deactivated accounts from refreshing
      if (!user.isActive) {
        reply.clearCookie('access_token', { path: '/' });
        reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
        return reply.status(401).send({ error: 'Account disabled', message: 'Account has been deactivated' });
      }

      const newAccessToken = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      // Rotate refresh token on each use
      const newRefreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d', algorithm: 'HS256' }
      );

      reply.setCookie('access_token', newAccessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60, // 15 minutes in seconds
      });

      reply.setCookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      });

      return { message: 'Token refreshed successfully' };
    } catch (error) {
      request.log.error({ err: error }, 'Token refresh error');
      return reply.status(401).send({ error: 'Invalid refresh token', message: 'Refresh token is invalid or expired' });
    }
  });
}
