import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MeetingIntelligenceService } from '../services/MeetingIntelligenceService';
import {
  AnalyzeRequestSchema,
  ApplyRequestSchema,
} from '../schemas/meetingSchemas';

export async function meetingIntelligenceRoutes(fastify: FastifyInstance) {
  const service = new MeetingIntelligenceService();

  // ---------------------------------------------------------------------------
  // POST /analyze — Analyze a meeting transcript
  // ---------------------------------------------------------------------------

  fastify.post('/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AnalyzeRequestSchema.parse(request.body);
      const userId = (request as any).userId || undefined;

      const analysis = await service.analyzeTranscript(
        parsed.transcript,
        parsed.projectId,
        parsed.scheduleId,
        userId,
      );

      return reply.send({ data: analysis });
    } catch (err) {
      if (err instanceof Error && err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid request data', details: err });
      }
      fastify.log.error({ err }, 'Meeting transcript analysis failed');
      return reply.status(500).send({ error: 'Failed to analyze meeting transcript' });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:analysisId/apply — Apply selected task changes from an analysis
  // ---------------------------------------------------------------------------

  fastify.post('/:analysisId/apply', async (
    request: FastifyRequest<{ Params: { analysisId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { analysisId } = request.params;
      const parsed = ApplyRequestSchema.parse(request.body);
      const userId = (request as any).userId || undefined;

      const result = await service.applyChanges(
        analysisId,
        parsed.selectedItems,
        userId,
      );

      return reply.send({ data: result });
    } catch (err) {
      if (err instanceof Error && err.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid request data', details: err });
      }
      fastify.log.error({ err }, 'Failed to apply meeting changes');
      return reply.status(500).send({ error: 'Failed to apply meeting changes' });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /project/:projectId/history — List analyses for a project
  // ---------------------------------------------------------------------------

  fastify.get('/project/:projectId/history', async (
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { projectId } = request.params;
      const analyses = await service.getProjectHistory(projectId);
      return reply.send({ data: analyses });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch meeting analysis history');
      return reply.status(500).send({ error: 'Failed to fetch meeting analysis history' });
    }
  });
}
