import { randomUUID } from 'crypto';
import { claudeService, promptTemplates } from './claudeService';
import { AIContextBuilder } from './aiContextBuilder';
import { emailService } from './EmailService';
import { logAIUsage } from './aiUsageLogger';
import { databaseService } from '../database/connection';
import logger from '../utils/logger';

export interface StatusReportOptions {
  recipients?: string[];
  sendEmail?: boolean;
}

export interface StatusReportResult {
  id: string;
  projectId: string;
  content: string;
  generatedAt: string;
  aiPowered: boolean;
  emailSent: boolean;
}

export class ProjectStatusReportService {
  private contextBuilder: AIContextBuilder;

  constructor() {
    this.contextBuilder = new AIContextBuilder(null as any);
  }

  async generate(
    projectId: string,
    userId: string,
    options: StatusReportOptions = {},
  ): Promise<StatusReportResult> {
    // Build project context
    let projectData = '';
    let projectName = 'Unknown Project';
    try {
      const ctx = await this.contextBuilder.buildProjectContext(projectId);
      projectData = this.contextBuilder.toPromptString(ctx);
      projectName = ctx.project.name;
    } catch {
      projectData = `Project ID: ${projectId} (context unavailable)`;
    }

    const reportId = randomUUID();
    const generatedAt = new Date().toISOString();
    let content: string;
    let aiPowered = false;

    if (claudeService.isAvailable()) {
      try {
        const systemPrompt = promptTemplates.statusReport.render({ projectData });

        const result = await claudeService.complete({
          systemPrompt,
          userMessage: 'Generate a comprehensive project status report based on the provided data. Format in markdown.',
          temperature: 0.3,
          maxTokens: 4096,
        });

        content = result.content;
        aiPowered = true;

        logAIUsage({
          userId,
          feature: 'status-report',
          model: 'claude',
          usage: result.usage,
          latencyMs: result.latencyMs,
          success: true,
          requestContext: { projectId },
        });
      } catch (error) {
        logger.error(`AI status report generation failed, using fallback: ${error instanceof Error ? error.message : String(error)}`);

        logAIUsage({
          userId,
          feature: 'status-report',
          model: 'claude',
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        content = this.generateFallbackReport(projectData);
      }
    } else {
      content = this.generateFallbackReport(projectData);
    }

    // Store report
    await this.storeReport(reportId, projectId, content, aiPowered, generatedAt, userId);

    // Email if requested
    let emailSent = false;
    if (options.sendEmail && options.recipients?.length) {
      try {
        await emailService.sendStatusReportEmail(options.recipients, projectName, content);
        emailSent = true;
      } catch (err) {
        logger.error(`Failed to email status report: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { id: reportId, projectId, content, generatedAt, aiPowered, emailSent };
  }

  private async storeReport(
    id: string, projectId: string, content: string,
    aiPowered: boolean, generatedAt: string, userId: string,
  ): Promise<void> {
    try {
      const messages = [
        {
          role: 'system',
          content: JSON.stringify({
            reportType: 'status-report',
            content,
            aiPowered,
            metadata: { projectId },
          }),
          timestamp: generatedAt,
        },
      ];

      await databaseService.query(
        `INSERT INTO ai_conversations (id, user_id, project_id, context_type, title, messages, token_count)
         VALUES (?, ?, ?, 'report', ?, ?, 0)`,
        [id, userId, projectId, 'Project Status Report', JSON.stringify(messages)],
      );
    } catch (err) {
      logger.warn(`Failed to store status report (non-critical): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private generateFallbackReport(projectData: string): string {
    const now = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    return `# Project Status Report\n\n**Generated:** ${now}\n**Mode:** Template (AI unavailable)\n\n## Executive Summary\nThis is an auto-generated status report based on available project data.\n\n## Progress Update\n${projectData}\n\n## Key Milestones\nReview current milestones in the project dashboard.\n\n## Risks & Issues\nReview RAID log for current risks and issues.\n\n## Budget Status\nReview budget dashboard for current financial status.\n\n## Next Steps\n- Review and update task statuses\n- Address any overdue items\n- Enable AI features for comprehensive analysis\n\n## Blockers & Escalations\nNo automated blocker detection available without AI.`;
  }
}

export const projectStatusReportService = new ProjectStatusReportService();
