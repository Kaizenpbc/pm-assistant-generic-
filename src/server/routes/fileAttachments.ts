import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fileAttachmentService } from '../services/FileAttachmentService';
import { authMiddleware } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';

export async function fileAttachmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /:entityType/:entityId — multipart upload
  fastify.post('/:entityType/:entityId', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: 'No file uploaded' });

      const buffer = await file.toBuffer();
      const attachment = await fileAttachmentService.upload(
        entityType, entityId, user.userId,
        file.filename, file.mimetype, buffer,
      );
      return { attachment };
    } catch (error) {
      console.error('Upload error:', error);
      return reply.status(500).send({ error: 'Failed to upload file' });
    }
  });

  // GET /:entityType/:entityId — list attachments
  fastify.get('/:entityType/:entityId', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const attachments = await fileAttachmentService.getByEntity(entityType, entityId);
      return { attachments };
    } catch (error) {
      console.error('List attachments error:', error);
      return reply.status(500).send({ error: 'Failed to list attachments' });
    }
  });

  // GET /:id/download — stream file
  fastify.get('/:id/download', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const attachment = await fileAttachmentService.getById(id);
      if (!attachment) return reply.status(404).send({ error: 'File not found' });

      const fs = await import('fs');
      if (!fs.existsSync(attachment.filePath)) {
        return reply.status(404).send({ error: 'File not found on disk' });
      }

      const stream = fs.createReadStream(attachment.filePath);
      reply.header('Content-Type', attachment.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
      return reply.send(stream);
    } catch (error) {
      console.error('Download error:', error);
      return reply.status(500).send({ error: 'Failed to download file' });
    }
  });

  // POST /:id/version — upload new version
  fastify.post('/:id/version', { preHandler: [requireScope('write')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as { id: string };
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: 'No file uploaded' });

      const buffer = await file.toBuffer();
      const attachment = await fileAttachmentService.uploadNewVersion(
        id, user.userId, file.filename, file.mimetype, buffer,
      );
      return { attachment };
    } catch (error) {
      console.error('Upload version error:', error);
      return reply.status(500).send({ error: 'Failed to upload new version' });
    }
  });

  // GET /:id/versions — version history
  fastify.get('/:id/versions', { preHandler: [requireScope('read')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const versions = await fileAttachmentService.getVersionHistory(id);
      return { versions };
    } catch (error) {
      console.error('Version history error:', error);
      return reply.status(500).send({ error: 'Failed to fetch version history' });
    }
  });

  // DELETE /:id
  fastify.delete('/:id', { preHandler: [requireScope('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await fileAttachmentService.delete(id);
      return { message: 'Attachment deleted' };
    } catch (error) {
      console.error('Delete attachment error:', error);
      return reply.status(500).send({ error: 'Failed to delete attachment' });
    }
  });
}
