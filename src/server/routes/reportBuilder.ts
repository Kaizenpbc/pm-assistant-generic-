import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { reportBuilderService } from '../services/ReportBuilderService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function reportBuilderRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /templates — create template
  fastify.post('/templates', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const body = request.body as any;
      const template = await reportBuilderService.createTemplate(user.userId, body);
      return { template };
    } catch (error) {
      console.error('Create report template error:', error);
      return reply.status(500).send({ error: 'Failed to create report template' });
    }
  });

  // GET /templates — list templates
  fastify.get('/templates', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const templates = await reportBuilderService.getTemplates(user.userId);
      return { templates };
    } catch (error) {
      console.error('Get report templates error:', error);
      return reply.status(500).send({ error: 'Failed to fetch report templates' });
    }
  });

  // GET /templates/:id — get template by id
  fastify.get('/templates/:id', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const template = await reportBuilderService.getTemplateById(id);
      return { template };
    } catch (error) {
      console.error('Get report template error:', error);
      return reply.status(500).send({ error: 'Failed to fetch report template' });
    }
  });

  // PUT /templates/:id — update template
  fastify.put('/templates/:id', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const template = await reportBuilderService.updateTemplate(id, body);
      return { template };
    } catch (error) {
      console.error('Update report template error:', error);
      return reply.status(500).send({ error: 'Failed to update report template' });
    }
  });

  // DELETE /templates/:id — delete template
  fastify.delete('/templates/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await reportBuilderService.deleteTemplate(id);
      return { message: 'Report template deleted' };
    } catch (error) {
      console.error('Delete report template error:', error);
      return reply.status(500).send({ error: 'Failed to delete report template' });
    }
  });

  // POST /templates/:id/generate — generate report
  fastify.post('/templates/:id/generate', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const report = await reportBuilderService.generateReport(id, body);
      return { report };
    } catch (error) {
      console.error('Generate report error:', error);
      return reply.status(500).send({ error: 'Failed to generate report' });
    }
  });

  // POST /templates/:id/export — export report
  fastify.post('/templates/:id/export', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { format } = request.body as { format: 'csv' | 'pdf' };
      const result = await reportBuilderService.exportReport(id, format);
      return { result };
    } catch (error) {
      console.error('Export report error:', error);
      return reply.status(500).send({ error: 'Failed to export report' });
    }
  });
}
