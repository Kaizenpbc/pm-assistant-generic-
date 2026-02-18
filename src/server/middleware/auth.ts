import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';

/** Schema to validate the JWT payload structure. */
const jwtPayloadSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  role: z.string().min(1),
});

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.cookies.access_token;

    if (!token) {
      return reply.status(401).send({
        error: 'No access token',
        message: 'Access token is required',
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    const payload = jwtPayloadSchema.parse(decoded);

    request.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };

  } catch (error) {
    return reply.status(401).send({
      error: 'Invalid token',
      message: 'Access token is invalid or expired',
    });
  }
}
