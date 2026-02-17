import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { ClaudeTaskBreakdownService } from '../services/aiTaskBreakdownClaude';
import {
  suggestDependenciesClaude,
  optimizeScheduleClaude,
  generateProjectInsightsClaude,
} from '../services/aiSchedulingClaude';
import { authMiddleware } from '../middleware/auth';
import { projectIdParam } from '../schemas/commonSchemas';
import { verifyProjectAccess, verifyScheduleAccess } from '../middleware/authorize';

const analyzeProjectBodySchema = z.object({
  projectDescription: z.string().min(1),
  projectType: z.string().optional(),
  projectId: z.string().min(1).max(100).optional(),
});

const suggestDependenciesBodySchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
  })),
  projectContext: z.string().optional(),
});

const optimizeScheduleBodySchema = z.object({
  scheduleId: z.string().min(1).max(100),
  optimizationGoals: z.array(z.string()).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

export async function aiSchedulingRoutes(fastify: FastifyInstance) {
  const claudeBreakdown = new ClaudeTaskBreakdownService(fastify);

  // Analyze project and generate AI task breakdown
  fastify.post('/analyze-project', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Analyze project and generate AI task breakdown',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectDescription, projectType, projectId } = analyzeProjectBodySchema.parse(request.body);
        const user = request.user;

        if (projectId) {
          const project = await verifyProjectAccess(projectId, user.userId);
          if (!project) return reply.code(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });
        }

        const { analysis, aiPowered } = await claudeBreakdown.analyzeProject(
          projectDescription,
          projectType,
          projectId,
          user.userId,
        );

        const insights = generateInsights(analysis);
        return { analysis, insights, aiPowered };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in AI project analysis');
        return reply.code(500).send({ error: 'Failed to analyze project' });
      }
    },
  });

  // Suggest task dependencies
  fastify.post('/suggest-dependencies', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Suggest task dependencies',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tasks, projectContext } = suggestDependenciesBodySchema.parse(request.body);
        const user = request.user;

        const { dependencies, aiPowered } = await suggestDependenciesClaude(
          tasks,
          projectContext,
          fastify,
          user.userId,
        );

        return { dependencies, aiPowered };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in AI dependency suggestion');
        return reply.code(500).send({ error: 'Failed to suggest dependencies' });
      }
    },
  });

  // Optimize schedule
  fastify.post('/optimize-schedule', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Optimize existing schedule using AI',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { scheduleId, optimizationGoals, constraints } = optimizeScheduleBodySchema.parse(request.body);
        const user = request.user;

        const schedule = await verifyScheduleAccess(scheduleId, user.userId);
        if (!schedule) return reply.code(403).send({ error: 'Forbidden', message: 'You do not have access to this schedule' });

        const { optimizedSchedule, aiPowered } = await optimizeScheduleClaude(
          scheduleId,
          optimizationGoals || [],
          constraints,
          fastify,
          user.userId,
        );

        return { optimizedSchedule, aiPowered };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in AI schedule optimization');
        return reply.code(500).send({ error: 'Failed to optimize schedule' });
      }
    },
  });

  // Get AI insights for project
  fastify.get('/insights/:projectId', {
    preHandler: [authMiddleware],
    schema: {
      description: 'Get AI insights for project',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = projectIdParam.parse(request.params);
        const user = request.user;

        const project = await verifyProjectAccess(projectId, user.userId);
        if (!project) return reply.code(403).send({ error: 'Forbidden', message: 'You do not have access to this project' });

        const { insights, aiPowered } = await generateProjectInsightsClaude(
          projectId,
          fastify,
          user.userId,
        );

        return { insights, aiPowered };
      } catch (error) {
        if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation error', message: error.issues.map(e => e.message).join(', ') });
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error generating AI insights');
        return reply.code(500).send({ error: 'Failed to generate insights' });
      }
    },
  });
}

function generateInsights(analysis: any): any {
  const insights: { recommendations: string[]; warnings: string[]; optimizations: string[] } = {
    recommendations: [],
    warnings: [],
    optimizations: [],
  };

  if (analysis.complexity === 'high') {
    insights.recommendations.push('Consider breaking this project into smaller phases');
    insights.recommendations.push('Allocate experienced team members to high-complexity tasks');
  }
  if (analysis.riskLevel > 60) {
    insights.warnings.push('High risk level detected - add buffer time and contingency plans');
    insights.recommendations.push('Implement regular risk assessment checkpoints');
  }
  if (analysis.estimatedDuration > 60) {
    insights.optimizations.push('Long duration - consider parallel task execution');
    insights.recommendations.push('Break project into smaller milestones');
  }

  const highRiskTasks = analysis.taskSuggestions?.filter((t: any) => t.riskLevel > 50) || [];
  if (highRiskTasks.length > 0) {
    insights.warnings.push(`${highRiskTasks.length} high-risk tasks identified - monitor closely`);
  }

  return insights;
}
