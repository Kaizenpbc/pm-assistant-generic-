import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { meetingIntelligenceService } from '../../services/MeetingIntelligenceService';
import {
  AnalyzeRequestSchema,
  ApplyRequestSchema,
} from '../../schemas/meetingSchemas';
import { authMiddleware } from '../../middleware/auth';
import { requireScope } from '../../middleware/requireScope';
import { requireFeature } from '../../middleware/requireTier';

export async function meetingIntelligenceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // ---------------------------------------------------------------------------
  // POST /analyze — Analyze a meeting transcript
  // ---------------------------------------------------------------------------

  fastify.post('/analyze', {
    preHandler: [requireScope('write'), requireFeature('meeting_intelligence')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = AnalyzeRequestSchema.parse(request.body);
      const userId = request.user!.userId;

      const analysis = await meetingIntelligenceService.analyzeTranscript(
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

  fastify.post('/:analysisId/apply', {
    preHandler: [requireScope('write'), requireFeature('meeting_intelligence')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { analysisId } = request.params as { analysisId: string };
      const parsed = ApplyRequestSchema.parse(request.body);
      const userId = request.user!.userId;

      const result = await meetingIntelligenceService.applyChanges(
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

  fastify.get('/project/:projectId/history', {
    preHandler: [requireScope('read'), requireFeature('meeting_intelligence')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const analyses = meetingIntelligenceService.getProjectHistory(projectId);
      return reply.send({ data: analyses });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch meeting analysis history');
      return reply.status(500).send({ error: 'Failed to fetch meeting analysis history' });
    }
  });
}
