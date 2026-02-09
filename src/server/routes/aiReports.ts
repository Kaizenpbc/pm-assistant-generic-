import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIReportService, ReportType } from '../services/aiReportService';

const VALID_REPORT_TYPES: ReportType[] = [
  'weekly-status',
  'risk-assessment',
  'budget-forecast',
  'resource-utilization',
];

export async function aiReportRoutes(fastify: FastifyInstance) {
  const reportService = new AIReportService(fastify);

  // POST /generate — generate a report
  fastify.post('/generate', {
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
        const body = request.body as any;
        const user = (request as any).user || {};

        if (!VALID_REPORT_TYPES.includes(body.reportType)) {
          return reply.code(400).send({
            error: `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}`,
          });
        }

        const report = await reportService.generateReport(
          body.reportType,
          { projectId: body.projectId },
          user.userId || 'anonymous',
        );

        return report;
      } catch (error) {
        fastify.log.error(
          { err: error instanceof Error ? error : new Error(String(error)) },
          'Report generation failed',
        );
        return reply.code(500).send({
          error: 'Failed to generate report',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  // GET /history — list past generated reports
  fastify.get('/history', {
    schema: {
      description: 'List past generated reports',
      tags: ['ai-reports'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user || {};
        const reports = await reportService.getReportHistory(user.userId || 'anonymous');
        return { reports };
      } catch (error) {
        fastify.log.error(
          { err: error instanceof Error ? error : new Error(String(error)) },
          'Failed to list report history',
        );
        return reply.code(500).send({
          error: 'Failed to list report history',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}
