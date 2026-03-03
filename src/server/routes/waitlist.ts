import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../database/connection';

const joinSchema = z.object({
  email: z.string().email(),
});

export async function waitlistRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = joinSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Valid email required' });
    }

    const { email } = result.data;

    try {
      await databaseService.query(
        'INSERT INTO waitlist (id, email) VALUES (?, ?)',
        [uuidv4(), email.toLowerCase().trim()]
      );
      return reply.status(201).send({ message: 'You\'re on the list!' });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return reply.status(200).send({ message: 'You\'re already on the list!' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Something went wrong. Please try again.' });
    }
  });

  fastify.get('/count', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await databaseService.query<any>('SELECT COUNT(*) as count FROM waitlist');
    return reply.send({ count: rows[0]?.count ?? 0 });
  });

  fastify.get('/admin', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminKey = process.env.WAITLIST_ADMIN_KEY || 'changeme';
    const { key } = request.query as { key?: string };
    if (key !== adminKey) return reply.status(401).send({ error: 'Unauthorized' });
    const rows = await databaseService.query<any>(
      'SELECT email, created_at FROM waitlist ORDER BY created_at DESC'
    );
    return reply.send({ count: rows.length, entries: rows });
  });

  fastify.get('/admin/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminKey = process.env.WAITLIST_ADMIN_KEY || 'changeme';
    const { key } = request.query as { key?: string };
    if (key !== adminKey) return reply.status(401).send({ error: 'Unauthorized' });
    const rows = await databaseService.query<any>(
      'SELECT email, created_at FROM waitlist ORDER BY created_at ASC'
    );
    const csv = ['email,joined_at', ...rows.map((r: any) => `${r.email},${r.created_at}`)].join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="waitlist.csv"');
    return reply.send(csv);
  });
}
