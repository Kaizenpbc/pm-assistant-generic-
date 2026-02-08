import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ClaudeTaskBreakdownService } from '../services/aiTaskBreakdownClaude';
import {
  suggestDependenciesClaude,
  optimizeScheduleClaude,
  generateProjectInsightsClaude,
} from '../services/aiSchedulingClaude';

export async function aiSchedulingRoutes(fastify: FastifyInstance) {
  const claudeBreakdown = new ClaudeTaskBreakdownService(fastify);

  // Analyze project and generate AI task breakdown
  fastify.post('/analyze-project', {
    schema: {
      description: 'Analyze project and generate AI task breakdown',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectDescription, projectType, projectId } = request.body as any;
        const user = (request as any).user || {};

        const { analysis, aiPowered } = await claudeBreakdown.analyzeProject(
          projectDescription,
          projectType,
          projectId,
          user.userId,
        );

        const insights = generateInsights(analysis);
        return { analysis, insights, aiPowered };
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in AI project analysis');
        return reply.code(500).send({ error: 'Failed to analyze project' });
      }
    },
  });

  // Suggest task dependencies
  fastify.post('/suggest-dependencies', {
    schema: {
      description: 'Suggest task dependencies',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tasks, projectContext } = request.body as any;
        const user = (request as any).user || {};

        const { dependencies, aiPowered } = await suggestDependenciesClaude(
          tasks,
          projectContext,
          fastify,
          user.userId,
        );

        return { dependencies, aiPowered };
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in AI dependency suggestion');
        return reply.code(500).send({ error: 'Failed to suggest dependencies' });
      }
    },
  });

  // Optimize schedule
  fastify.post('/optimize-schedule', {
    schema: {
      description: 'Optimize existing schedule using AI',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { scheduleId, optimizationGoals, constraints } = request.body as any;
        const user = (request as any).user || {};

        const { optimizedSchedule, aiPowered } = await optimizeScheduleClaude(
          scheduleId,
          optimizationGoals || [],
          constraints,
          fastify,
          user.userId,
        );

        return { optimizedSchedule, aiPowered };
      } catch (error) {
        fastify.log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in AI schedule optimization');
        return reply.code(500).send({ error: 'Failed to optimize schedule' });
      }
    },
  });

  // Get AI insights for project
  fastify.get('/insights/:projectId', {
    schema: {
      description: 'Get AI insights for project',
      tags: ['ai-scheduling'],
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as any;
        const user = (request as any).user || {};

        const { insights, aiPowered } = await generateProjectInsightsClaude(
          projectId,
          fastify,
          user.userId,
        );

        return { insights, aiPowered };
      } catch (error) {
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
