import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { AIReportService, ReportType } from '../services/aiReportService';
import { authMiddleware } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorize';

const VALID_REPORT_TYPES: ReportType[] = [
  'weekly-status',
  'risk-assessment',
  'budget-forecast',
  'resource-utilization',
];

const generateReportBodySchema = z.object({
  reportType: z.enum(['weekly-status', 'risk-assessment', 'budget-forecast', 'resource-utilization']),
  projectId: z.string().min(1).max(100).optional(),
});

export async function aiReportRoutes(fastify: FastifyInstance) {
  const reportService = new AIReportService(fastify);

  // POST /generate — generate a report
  fastify.post('/generate', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Generate an AI report',
      tags: ['ai-reports'],
      body: {
        type: 'object',
        required: ['reportType'],
        properties: {
          reportType: {
            type: 'string',
            enum: VALID_REPORT_TYPES,
          },
          projectId: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = generateReportBodySchema.parse(request.body);
        const user = request.user;

        if (body.projectId) {
          const project = await verifyProjectAccess(body.projectId, user.userId);
          if (!project) return reply.code(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
        }

        const report = await reportService.generateReport(
          body.reportType,
          { projectId: body.projectId },
          user.userId,
        );

        return report;
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error(
          { err: error instanceof Error ? error : new Error(String(error)) },
          'Report generation failed',
        );
        return reply.code(500).send({
          error: 'Failed to generate report',
          message: 'An unexpected error occurred',
        });
      }
    },
  });

  // GET /history — list past generated reports
  fastify.get('/history', {
    preHandler: [authMiddleware],
    schema: {
      description: 'List past generated reports',
      tags: ['ai-reports'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        const reports = await reportService.getReportHistory(user.userId);
        return { reports };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error(
          { err: error instanceof Error ? error : new Error(String(error)) },
          'Failed to list report history',
        );
        return reply.code(500).send({
          error: 'Failed to list report history',
          message: 'An unexpected error occurred',
        });
      }
    },
  });
}
