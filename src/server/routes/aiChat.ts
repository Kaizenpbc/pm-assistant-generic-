import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { AIChatService } from '../services/aiChatService';
import { authMiddleware } from '../middleware/auth';
import { conversationIdParam } from '../schemas/commonSchemas';
import { verifyScheduleAccess } from '../middleware/authorize';

const chatMessageBodySchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  context: z.object({
    type: z.enum(['dashboard', 'project', 'schedule', 'reports', 'general']),
    projectId: z.string().optional(),
  }).optional(),
});

const createProjectBodySchema = z.object({
  description: z.string().min(10),
});

const extractTasksBodySchema = z.object({
  meetingNotes: z.string().min(10),
  projectId: z.string().optional(),
  scheduleId: z.string().optional(),
});

export async function aiChatRoutes(fastify: FastifyInstance) {
  const chatService = new AIChatService(fastify);

  // POST /message — non-streaming chat
  fastify.post('/message', {
    preHandler: [authMiddleware],
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
        const body = chatMessageBodySchema.parse(request.body);
        const user = request.user;

        const result = await chatService.sendMessage({
          message: body.message,
          conversationId: body.conversationId,
          context: body.context,
          userId: user.userId,
          userRole: user.role,
        });

        return result;
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Chat message failed');
        return reply.code(500).send({
          error: 'Failed to process message',
          message: 'An unexpected error occurred',
        });
      }
    },
  });

  // POST /stream — SSE streaming chat
  fastify.post('/stream', {
    preHandler: [authMiddleware],
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
        const body = chatMessageBodySchema.parse(request.body);
        const user = request.user;

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
          userId: user.userId,
          userRole: user.role,
        });

        for await (const chunk of stream) {
          const data = JSON.stringify(chunk);
          reply.raw.write(`data: ${data}\n\n`);
        }

        reply.raw.end();
      } catch (error) {
        if (error instanceof ZodError) {
          if (!reply.raw.headersSent) {
            return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
          }
        }
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Chat stream failed');

        if (!reply.raw.headersSent) {
          return reply.code(500).send({
            error: 'Failed to stream message',
            message: 'An unexpected error occurred',
          });
        }

        reply.raw.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream interrupted' })}\n\n`);
        reply.raw.end();
      }
    },
  });

  // GET /conversations
  fastify.get('/conversations', {
    preHandler: [authMiddleware],
    schema: { description: 'List user conversations', tags: ['ai-chat'] },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        const conversations = await chatService.getConversations(user.userId);
        return { conversations };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to list conversations');
        return reply.code(500).send({ error: 'Failed to list conversations' });
      }
    },
  });

  // GET /conversations/:id
  fastify.get('/conversations/:id', {
    preHandler: [authMiddleware],
    schema: { description: 'Load a conversation by ID', tags: ['ai-chat'] },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = conversationIdParam.parse(request.params);
        const user = request.user;
        const conversation = await chatService.getConversation(id, user.userId);
        if (!conversation) return reply.code(404).send({ error: 'Conversation not found' });
        return { conversation };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to load conversation');
        return reply.code(500).send({ error: 'Failed to load conversation' });
      }
    },
  });

  // DELETE /conversations/:id
  fastify.delete('/conversations/:id', {
    preHandler: [authMiddleware],
    schema: { description: 'Delete a conversation', tags: ['ai-chat'] },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = conversationIdParam.parse(request.params);
        const user = request.user;
        const deleted = await chatService.deleteConversation(id, user.userId);
        if (!deleted) return reply.code(404).send({ error: 'Conversation not found' });
        return { message: 'Conversation deleted' };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to delete conversation');
        return reply.code(500).send({ error: 'Failed to delete conversation' });
      }
    },
  });

  // POST /create-project — create project from natural language
  fastify.post('/create-project', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Create a project from natural language description',
      tags: ['ai-chat'],
      body: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string', minLength: 10 },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createProjectBodySchema.parse(request.body);
        const user = request.user;

        const { AIProjectCreatorService } = await import('../services/aiProjectCreator');
        const creator = new AIProjectCreatorService(fastify);
        const result = await creator.createProjectFromDescription(
          body.description,
          user.userId,
        );

        return {
          project: result.project,
          schedule: result.schedule,
          tasks: result.tasks,
          analysis: result.analysis,
          aiPowered: result.aiPowered,
        };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Project creation failed');
        return reply.code(500).send({
          error: 'Failed to create project from description',
          message: 'An unexpected error occurred',
        });
      }
    },
  });

  // POST /extract-tasks — extract tasks from meeting notes
  fastify.post('/extract-tasks', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Extract tasks from meeting notes',
      tags: ['ai-chat'],
      body: {
        type: 'object',
        required: ['meetingNotes'],
        properties: {
          meetingNotes: { type: 'string', minLength: 10 },
          projectId: { type: 'string' },
          scheduleId: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = extractTasksBodySchema.parse(request.body);
        const user = request.user;

        const { claudeService, promptTemplates } = await import('../services/claudeService');
        const { AIMeetingExtractionSchema } = await import('../schemas/aiSchemas');

        if (!claudeService.isAvailable()) {
          return reply.code(503).send({
            error: 'AI features are disabled. Enable AI_ENABLED and set ANTHROPIC_API_KEY.',
          });
        }

        const systemPrompt = promptTemplates.meetingNotesExtraction.render({
          meetingNotes: body.meetingNotes,
          additionalContext: body.projectId ? `Project ID: ${body.projectId}` : '',
        });

        const result = await claudeService.completeWithJsonSchema({
          systemPrompt,
          userMessage: 'Extract structured information from these meeting notes. Return valid JSON.',
          schema: AIMeetingExtractionSchema,
          temperature: 0.2,
        });

        // If scheduleId provided, verify ownership then create the extracted tasks
        let createdTasks: any[] = [];
        if (body.scheduleId && result.data.tasks && result.data.tasks.length > 0) {
          const schedule = await verifyScheduleAccess(body.scheduleId, user.userId);
          if (!schedule) return reply.code(403).send({ error: 'Forbidden', message: 'You do not have access to this resource' });
          const { ScheduleService } = await import('../services/ScheduleService');
          const scheduleService = new ScheduleService();

          for (const task of result.data.tasks) {
            const created = await scheduleService.createTask({
              scheduleId: body.scheduleId,
              name: task.name,
              description: task.description || '',
              priority: (task.priority as any) || 'medium',
              createdBy: user.userId,
            });
            createdTasks.push(created);
          }
        }

        const { logAIUsage } = await import('../services/aiUsageLogger');
        logAIUsage(fastify, {
          userId: user.userId,
          feature: 'meeting-extraction',
          model: 'claude',
          usage: result.usage,
          latencyMs: result.latencyMs,
          success: true,
          requestContext: { projectId: body.projectId },
        });

        return {
          extraction: result.data,
          createdTasks,
          aiPowered: true,
        };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Task extraction failed');
        return reply.code(500).send({
          error: 'Failed to extract tasks from notes',
          message: 'An unexpected error occurred',
        });
      }
    },
  });
}
