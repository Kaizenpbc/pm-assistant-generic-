import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserService } from '../services/UserService';

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
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
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role },
      };
    } catch (error) {
      request.log.error({ err: error }, 'Login error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Login failed' });
    }
  });

  fastify.post('/register', {
    schema: { description: 'User registration', tags: ['auth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { username, email, password, fullName } = registerSchema.parse(request.body);

      const existingUser = await userService.findByUsername(username);
      if (existingUser) {
        return reply.status(409).send({ error: 'User already exists', message: 'Username is already taken' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await userService.create({ username, email, passwordHash, fullName, role: 'member' });

      return reply.status(201).send({
        message: 'User created successfully',
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role },
      });
    } catch (error) {
      request.log.error({ err: error }, 'Registration error');
      return reply.status(500).send({ error: 'Internal server error', message: 'Registration failed' });
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
      request.log.error({ err: error }, 'Token refresh error');
      return reply.status(401).send({ error: 'Invalid refresh token', message: 'Refresh token is invalid or expired' });
    }
  });
}
