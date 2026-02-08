import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIChatService } from '../services/aiChatService';

export async function aiChatRoutes(fastify: FastifyInstance) {
  const chatService = new AIChatService(fastify);

  // POST /message — non-streaming chat
  fastify.post('/message', {
    schema: {
      description: 'Send a message to the AI assistant (non-streaming)',
      tags: ['ai-chat'],
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
          conversationId: { type: 'string' },
          context: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['dashboard', 'project', 'schedule', 'reports', 'general'] },
              projectId: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any;
        const user = (request as any).user || {};

        const result = await chatService.sendMessage({
          message: body.message,
          conversationId: body.conversationId,
          context: body.context,
          userId: user.userId || 'anonymous',
          userRole: user.role || 'member',
        });

        return result;
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Chat message failed');
        return reply.code(500).send({
          error: 'Failed to process message',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  // POST /stream — SSE streaming chat
  fastify.post('/stream', {
    schema: {
      description: 'Send a message to the AI assistant (SSE streaming)',
      tags: ['ai-chat'],
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
          conversationId: { type: 'string' },
          context: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['dashboard', 'project', 'schedule', 'reports', 'general'] },
              projectId: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any;
        const user = (request as any).user || {};

        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const stream = chatService.streamMessage({
          message: body.message,
          conversationId: body.conversationId,
          context: body.context,
          userId: user.userId || 'anonymous',
          userRole: user.role || 'member',
        });

        for await (const chunk of stream) {
          const data = JSON.stringify(chunk);
          reply.raw.write(`data: ${data}\n\n`);
        }

        reply.raw.end();
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Chat stream failed');

        if (!reply.raw.headersSent) {
          return reply.code(500).send({
            error: 'Failed to stream message',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        reply.raw.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream interrupted' })}\n\n`);
        reply.raw.end();
      }
    },
  });

  // GET /conversations
  fastify.get('/conversations', {
    schema: { description: 'List user conversations', tags: ['ai-chat'] },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user || {};
        const conversations = await chatService.getConversations(user.userId || 'anonymous');
        return { conversations };
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to list conversations');
        return reply.code(500).send({ error: 'Failed to list conversations' });
      }
    },
  });

  // GET /conversations/:id
  fastify.get('/conversations/:id', {
    schema: { description: 'Load a conversation by ID', tags: ['ai-chat'] },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as any;
        const user = (request as any).user || {};
        const conversation = await chatService.getConversation(id, user.userId || 'anonymous');
        if (!conversation) return reply.code(404).send({ error: 'Conversation not found' });
        return { conversation };
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to load conversation');
        return reply.code(500).send({ error: 'Failed to load conversation' });
      }
    },
  });

  // DELETE /conversations/:id
  fastify.delete('/conversations/:id', {
    schema: { description: 'Delete a conversation', tags: ['ai-chat'] },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as any;
        const user = (request as any).user || {};
        const deleted = await chatService.deleteConversation(id, user.userId || 'anonymous');
        if (!deleted) return reply.code(404).send({ error: 'Conversation not found' });
        return { message: 'Conversation deleted' };
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to delete conversation');
        return reply.code(500).send({ error: 'Failed to delete conversation' });
      }
    },
  });
}
