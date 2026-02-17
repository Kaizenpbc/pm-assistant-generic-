import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NLQueryService } from '../services/NLQueryService';
import { NLQueryRequestSchema } from '../schemas/nlQuerySchemas';
import { authMiddleware } from '../middleware/auth';

export async function nlQueryRoutes(fastify: FastifyInstance) {
  const nlQueryService = new NLQueryService();

  // POST / — process a natural-language query
  fastify.post('/', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Process a natural-language query about project data and return an answer with optional chart visualizations',
      tags: ['nl-query'],
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 3 },
          context: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any;

        // Validate with Zod for stricter checks
        const parsed = NLQueryRequestSchema.safeParse(body);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          return reply.code(400).send({ error: `Validation failed: ${issues}` });
        }

        const user = (request as any).user;
        const userId = user.userId;

        const result = await nlQueryService.processQuery(
          parsed.data.query,
          parsed.data.context,
          userId,
        );

        return result;
      } catch (error) {
        fastify.log.error(
          { err: error instanceof Error ? error : new Error(String(error)) },
          'NL query processing failed',
        );

        // Distinguish AI-unavailable errors from unexpected errors
        const errorMsg = error instanceof Error ? error.message : '';
        const isServiceError =
          errorMsg.includes('AI features are disabled') ||
          errorMsg.includes('AI service is unavailable');

        return reply.code(isServiceError ? 503 : 500).send({
          error: isServiceError ? 'AI service unavailable' : 'Failed to process query',
          message: isServiceError ? 'AI service is currently unavailable' : 'An unexpected error occurred',
        });
      }
    },
  });
}
