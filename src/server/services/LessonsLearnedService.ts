import { randomUUID } from 'crypto';
import { claudeService, PromptTemplate } from './claudeService';
import { ProjectService } from './ProjectService';
import { ScheduleService } from './ScheduleService';
import { config } from '../config';
import {
  LessonsExtractionAISchema,
  PatternDetectionAISchema,
  MitigationAISchema,
  type LessonLearned,
  type Pattern,
  type MitigationSuggestion,
  type KnowledgeBaseOverview,
} from '../schemas/lessonsLearnedSchemas';

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

const lessonsExtractionPrompt = new PromptTemplate(
  `You are a lessons-learned analyst for project management. Analyze the project data below and extract actionable lessons learned.

Project data:
{{projectData}}

Schedule & task data:
{{scheduleData}}

For each lesson:
- Assign a category: schedule, budget, resource, risk, technical, communication, stakeholder, or quality
- Determine impact: positive (things that went well), negative (things that went wrong), or neutral
- Provide a clear, specific recommendation
- Rate your confidence (0-100) in the lesson's validity

Focus on concrete, evidence-based observations from the data. Avoid generic advice.`,
  '1.0.0',
);

const patternDetectionPrompt = new PromptTemplate(
  `You are a cross-project pattern recognition analyst. Analyze the following lessons learned from multiple projects and identify recurring patterns.

Lessons data:
{{lessonsData}}

For each pattern:
- Give it a clear title and description
- Count how many projects exhibit the pattern (frequency)
- List the project types involved
- Provide a strategic recommendation
- Rate your confidence (0-100) in the pattern

Focus on patterns that appear across multiple projects or project types.`,
  '1.0.0',
);

const mitigationPrompt = new PromptTemplate(
  `You are a risk mitigation advisor for project management. Based on the historical lessons learned and the risk described, suggest mitigations.

Risk description:
{{riskDescription}}

Project type:
{{projectType}}

Relevant historical lessons:
{{historicalLessons}}

For each suggestion:
- Provide a specific, actionable mitigation strategy
- Rate relevance (0-100) to the described risk
- If there is a historical outcome from a similar situation, include it

Be specific and base suggestions on the historical data provided.`,
  '1.0.0',
);

// ---------------------------------------------------------------------------
// LessonsLearnedService
// ---------------------------------------------------------------------------

export class LessonsLearnedService {
  private static lessons: LessonLearned[] = [];
  private static patterns: Pattern[] = [];

  // -----------------------------------------------------------------------
  // Seed initial lessons deterministically from existing project data
  // -----------------------------------------------------------------------

  async seedFromProjects(userId?: string): Promise<number> {
    // Avoid duplicate seeding
    if (LessonsLearnedService.lessons.length > 0) {
      return 0;
    }

    const projectService = new ProjectService();
    const scheduleService = new ScheduleService();
    const projects = userId
      ? await projectService.findByUserId(userId)
      : await projectService.findAll();
    const seededLessons: LessonLearned[] = [];
    let counter = 0;

    for (const project of projects) {
      const schedules = await scheduleService.findByProjectId(project.id);
      const allTasks = [];
      for (const schedule of schedules) {
        const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
        allTasks.push(...tasks);
      }

      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter((t) => t.status === 'completed').length;
      const overdueTasks = allTasks.filter(
        (t) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date(),
      ).length;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const budgetAllocated = project.budgetAllocated || 0;
      const budgetSpent = project.budgetSpent || 0;
      const budgetUtilization = budgetAllocated > 0 ? (budgetSpent / budgetAllocated) * 100 : 0;

      // Schedule variance analysis
      if (project.startDate && project.endDate) {
        const now = new Date();
        const totalDuration = new Date(project.endDate).getTime() - new Date(project.startDate).getTime();
        const elapsed = Math.max(0, now.getTime() - new Date(project.startDate).getTime());
        const expectedPercent = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
        const scheduleVariance = completionRate - expectedPercent;

        if (scheduleVariance < -15) {
          seededLessons.push({
            id: `ll-seed-${++counter}`,
            projectId: project.id,
            projectName: project.name,
            projectType: project.projectType,
            category: 'schedule',
            title: 'Significant schedule delay detected',
            description: `Project is ${Math.abs(Math.round(scheduleVariance))}% behind the expected completion rate. Completion is at ${Math.round(completionRate)}% while ${Math.round(expectedPercent)}% was expected by this point.`,
            impact: 'negative',
            recommendation: 'Review critical path tasks and consider adding resources or re-negotiating timelines. Implement more frequent schedule check-ins.',
            confidence: 75,
            createdAt: new Date().toISOString(),
          });
        } else if (scheduleVariance > 10) {
          seededLessons.push({
            id: `ll-seed-${++counter}`,
            projectId: project.id,
            projectName: project.name,
            projectType: project.projectType,
            category: 'schedule',
            title: 'Project ahead of schedule',
            description: `Project is ${Math.round(scheduleVariance)}% ahead of the expected completion rate. Good scheduling practices are in effect.`,
            impact: 'positive',
            recommendation: 'Document the scheduling approach and resource allocation strategy for reuse on future projects.',
            confidence: 80,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Budget analysis
      if (budgetAllocated > 0) {
        if (budgetUtilization > 100) {
          seededLessons.push({
            id: `ll-seed-${++counter}`,
            projectId: project.id,
            projectName: project.name,
            projectType: project.projectType,
            category: 'budget',
            title: 'Budget overrun detected',
            description: `Budget utilization at ${Math.round(budgetUtilization)}%. Spent $${budgetSpent.toLocaleString()} of $${budgetAllocated.toLocaleString()} allocated.`,
            impact: 'negative',
            recommendation: 'Conduct a budget review to identify cost drivers. Implement tighter change control and consider contingency reserves for future projects.',
            confidence: 85,
            createdAt: new Date().toISOString(),
          });
        } else if (budgetUtilization < 50 && completionRate > 60) {
          seededLessons.push({
            id: `ll-seed-${++counter}`,
            projectId: project.id,
            projectName: project.name,
            projectType: project.projectType,
            category: 'budget',
            title: 'Strong cost performance',
            description: `Project is ${Math.round(completionRate)}% complete while only using ${Math.round(budgetUtilization)}% of the budget. Effective cost management observed.`,
            impact: 'positive',
            recommendation: 'Document cost management practices and procurement strategies for organizational knowledge base.',
            confidence: 80,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Overdue tasks analysis
      if (overdueTasks > 0 && totalTasks > 0) {
        const overdueRatio = overdueTasks / totalTasks;
        if (overdueRatio > 0.2) {
          seededLessons.push({
            id: `ll-seed-${++counter}`,
            projectId: project.id,
            projectName: project.name,
            projectType: project.projectType,
            category: 'resource',
            title: 'High rate of overdue tasks',
            description: `${overdueTasks} out of ${totalTasks} tasks (${Math.round(overdueRatio * 100)}%) are overdue. This suggests resource bottlenecks or estimation issues.`,
            impact: 'negative',
            recommendation: 'Review task estimation accuracy and resource allocation. Consider breaking large tasks into smaller increments with more frequent checkpoints.',
            confidence: 70,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Task completion quality analysis
      if (completedTasks > 0 && totalTasks > 5) {
        seededLessons.push({
          id: `ll-seed-${++counter}`,
          projectId: project.id,
          projectName: project.name,
          projectType: project.projectType,
          category: 'quality',
          title: `Task completion progress on ${project.projectType} project`,
          description: `${completedTasks} of ${totalTasks} tasks completed (${Math.round(completionRate)}%). Project type: ${project.projectType}.`,
          impact: completionRate > 50 ? 'positive' : 'neutral',
          recommendation: completionRate > 50
            ? 'Maintain current work practices and team coordination.'
            : 'Consider reviewing task prioritization and team workload balance.',
          confidence: 65,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Stamp userId on all seeded lessons for ownership filtering
    if (userId) {
      for (const lesson of seededLessons) {
        lesson.userId = userId;
      }
    }

    LessonsLearnedService.lessons.push(...seededLessons);
    return seededLessons.length;
  }

  // -----------------------------------------------------------------------
  // Extract lessons from a specific project (AI-enhanced)
  // -----------------------------------------------------------------------

  async extractLessons(projectId: string, userId?: string): Promise<LessonLearned[]> {
    const projectService = new ProjectService();
    const scheduleService = new ScheduleService();

    const project = userId
      ? await projectService.findById(projectId, userId)
      : await projectService.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const schedules = await scheduleService.findByProjectId(projectId);
    const scheduleData: Array<{ scheduleName: string; tasks: any[] }> = [];
    for (const schedule of schedules) {
      const tasks = await scheduleService.findTasksByScheduleId(schedule.id);
      scheduleData.push({
        scheduleName: schedule.name,
        tasks: tasks.map((t) => ({
          name: t.name,
          status: t.status,
          priority: t.priority,
          progress: t.progressPercentage ?? 0,
          startDate: t.startDate?.toISOString().split('T')[0] ?? null,
          endDate: t.endDate?.toISOString().split('T')[0] ?? null,
          dueDate: t.dueDate?.toISOString().split('T')[0] ?? null,
          dependency: t.dependency ?? null,
        })),
      });
    }

    const projectDataStr = JSON.stringify(
      {
        name: project.name,
        type: project.projectType,
        status: project.status,
        priority: project.priority,
        budgetAllocated: project.budgetAllocated,
        budgetSpent: project.budgetSpent,
        startDate: project.startDate?.toISOString().split('T')[0] ?? null,
        endDate: project.endDate?.toISOString().split('T')[0] ?? null,
      },
      null,
      2,
    );

    const scheduleDataStr = JSON.stringify(scheduleData, null, 2);

    if (config.AI_ENABLED && claudeService.isAvailable()) {
      try {
        const systemPrompt = lessonsExtractionPrompt.render({
          projectData: projectDataStr,
          scheduleData: scheduleDataStr,
        });

        const result = await claudeService.completeWithJsonSchema({
          systemPrompt,
          userMessage: 'Extract lessons learned from this project data and return the JSON.',
          schema: LessonsExtractionAISchema,
          maxTokens: 4096,
        });

        const newLessons: LessonLearned[] = result.data.lessons.map((l, i) => ({
          id: `ll-${projectId}-${Date.now()}-${i}`,
          projectId,
          projectName: project.name,
          projectType: project.projectType,
          category: l.category,
          title: l.title,
          description: l.description,
          impact: l.impact,
          recommendation: l.recommendation,
          confidence: l.confidence,
          userId,
          createdAt: new Date().toISOString(),
        }));

        // Store and return
        LessonsLearnedService.lessons.push(...newLessons);
        return newLessons;
      } catch {
        // Fall through to deterministic extraction
      }
    }

    // Deterministic fallback: generate basic lessons from data analysis
    return this.extractLessonsDeterministic(project, scheduleData, userId);
  }

  private extractLessonsDeterministic(
    project: { id: string; name: string; projectType: string; budgetAllocated?: number; budgetSpent: number; startDate?: Date; endDate?: Date; status: string },
    scheduleData: Array<{ scheduleName: string; tasks: any[] }>,
    userId?: string,
  ): LessonLearned[] {
    const newLessons: LessonLearned[] = [];
    const allTasks = scheduleData.flatMap((s) => s.tasks);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t: any) => t.status === 'completed').length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const budgetAllocated = project.budgetAllocated || 0;
    const budgetUtilization = budgetAllocated > 0 ? (project.budgetSpent / budgetAllocated) * 100 : 0;

    let counter = 0;

    if (budgetUtilization > 90) {
      newLessons.push({
        id: `ll-${project.id}-det-${++counter}`,
        projectId: project.id,
        projectName: project.name,
        projectType: project.projectType,
        category: 'budget',
        title: 'Budget nearing or exceeding limit',
        description: `Budget utilization is at ${Math.round(budgetUtilization)}%. This project requires close budget monitoring.`,
        impact: budgetUtilization > 100 ? 'negative' : 'neutral',
        recommendation: 'Implement weekly budget reviews and stricter change control processes.',
        confidence: 70,
        createdAt: new Date().toISOString(),
      });
    }

    if (totalTasks > 0) {
      const overdueTasks = allTasks.filter(
        (t: any) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date(),
      );
      if (overdueTasks.length > 0) {
        newLessons.push({
          id: `ll-${project.id}-det-${++counter}`,
          projectId: project.id,
          projectName: project.name,
          projectType: project.projectType,
          category: 'schedule',
          title: 'Overdue tasks detected',
          description: `${overdueTasks.length} task(s) are past their due dates. This may cascade to downstream activities.`,
          impact: 'negative',
          recommendation: 'Prioritize overdue tasks and review dependency chains for cascading delays.',
          confidence: 75,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (completionRate > 70 && budgetUtilization < 80) {
      newLessons.push({
        id: `ll-${project.id}-det-${++counter}`,
        projectId: project.id,
        projectName: project.name,
        projectType: project.projectType,
        category: 'quality',
        title: 'Good progress-to-budget ratio',
        description: `Project is ${Math.round(completionRate)}% complete while only ${Math.round(budgetUtilization)}% of the budget has been utilized.`,
        impact: 'positive',
        recommendation: 'Document current management approach as a best practice for similar projects.',
        confidence: 65,
        createdAt: new Date().toISOString(),
      });
    }

    // Always produce at least one lesson
    if (newLessons.length === 0) {
      newLessons.push({
        id: `ll-${project.id}-det-${++counter}`,
        projectId: project.id,
        projectName: project.name,
        projectType: project.projectType,
        category: 'communication',
        title: 'General project status review',
        description: `Project "${project.name}" (${project.projectType}) is in ${project.status} status with ${totalTasks} tasks (${Math.round(completionRate)}% complete).`,
        impact: 'neutral',
        recommendation: 'Continue regular status reporting and stakeholder communication.',
        confidence: 50,
        createdAt: new Date().toISOString(),
      });
    }

    // Stamp userId on deterministic lessons for ownership filtering
    if (userId) {
      for (const lesson of newLessons) {
        lesson.userId = userId;
      }
    }

    LessonsLearnedService.lessons.push(...newLessons);
    return newLessons;
  }

  // -----------------------------------------------------------------------
  // Knowledge Base Overview
  // -----------------------------------------------------------------------

  async getKnowledgeBase(userId?: string): Promise<KnowledgeBaseOverview> {
    const lessons = userId
      ? LessonsLearnedService.lessons.filter((l) => l.userId === userId)
      : LessonsLearnedService.lessons;
    // Patterns are regenerated per-user, so use the cached set (already user-scoped from detectPatterns)
    const patterns = LessonsLearnedService.patterns;

    const byCategory: Record<string, number> = {};
    const byProjectType: Record<string, number> = {};
    const byImpact: Record<string, number> = {};

    for (const lesson of lessons) {
      byCategory[lesson.category] = (byCategory[lesson.category] || 0) + 1;
      byProjectType[lesson.projectType] = (byProjectType[lesson.projectType] || 0) + 1;
      byImpact[lesson.impact] = (byImpact[lesson.impact] || 0) + 1;
    }

    // Most recent 10 lessons
    const sorted = [...lessons].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const recentLessons = sorted.slice(0, 10);

    return {
      totalLessons: lessons.length,
      byCategory,
      byProjectType,
      byImpact,
      recentLessons,
      patterns,
    };
  }

  // -----------------------------------------------------------------------
  // Find relevant lessons (filtered)
  // -----------------------------------------------------------------------

  async findRelevantLessons(projectType?: string, category?: string, userId?: string): Promise<LessonLearned[]> {
    let results = userId
      ? LessonsLearnedService.lessons.filter((l) => l.userId === userId)
      : [...LessonsLearnedService.lessons];

    if (projectType) {
      results = results.filter((l) => l.projectType === projectType);
    }
    if (category) {
      results = results.filter((l) => l.category === category);
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  // -----------------------------------------------------------------------
  // Detect patterns across projects (AI-enhanced)
  // -----------------------------------------------------------------------

  async detectPatterns(userId?: string): Promise<Pattern[]> {
    const lessons = userId
      ? LessonsLearnedService.lessons.filter((l) => l.userId === userId)
      : LessonsLearnedService.lessons;

    if (lessons.length === 0) {
      return [];
    }

    if (config.AI_ENABLED && claudeService.isAvailable()) {
      try {
        const lessonsDataStr = JSON.stringify(
          lessons.map((l) => ({
            projectName: l.projectName,
            projectType: l.projectType,
            category: l.category,
            title: l.title,
            description: l.description,
            impact: l.impact,
            recommendation: l.recommendation,
          })),
          null,
          2,
        );

        const systemPrompt = patternDetectionPrompt.render({
          lessonsData: lessonsDataStr,
        });

        const result = await claudeService.completeWithJsonSchema({
          systemPrompt,
          userMessage: 'Analyze these lessons learned and identify cross-project patterns. Return the JSON.',
          schema: PatternDetectionAISchema,
          maxTokens: 4096,
        });

        const newPatterns: Pattern[] = result.data.patterns.map((p, i) => ({
          id: `pat-${Date.now()}-${i}`,
          title: p.title,
          description: p.description,
          frequency: p.frequency,
          projectTypes: p.projectTypes,
          category: p.category,
          recommendation: p.recommendation,
          confidence: p.confidence,
        }));

        LessonsLearnedService.patterns = newPatterns;
        return newPatterns;
      } catch {
        // Fall through to deterministic detection
      }
    }

    // Deterministic fallback: group lessons by category and find repeating themes
    return this.detectPatternsDeterministic(userId);
  }

  private detectPatternsDeterministic(userId?: string): Pattern[] {
    const lessons = userId
      ? LessonsLearnedService.lessons.filter((l) => l.userId === userId)
      : LessonsLearnedService.lessons;
    const categoryGroups: Record<string, LessonLearned[]> = {};

    for (const lesson of lessons) {
      if (!categoryGroups[lesson.category]) {
        categoryGroups[lesson.category] = [];
      }
      categoryGroups[lesson.category].push(lesson);
    }

    const detectedPatterns: Pattern[] = [];
    let counter = 0;

    for (const [category, categoryLessons] of Object.entries(categoryGroups)) {
      if (categoryLessons.length < 2) continue;

      // Count negative vs positive
      const negativeCount = categoryLessons.filter((l) => l.impact === 'negative').length;
      const positiveCount = categoryLessons.filter((l) => l.impact === 'positive').length;
      const projectTypes = Array.from(new Set(categoryLessons.map((l) => l.projectType)));
      const projectCount = Array.from(new Set(categoryLessons.map((l) => l.projectId))).length;

      if (negativeCount >= 2) {
        detectedPatterns.push({
          id: `pat-det-${++counter}`,
          title: `Recurring ${category} issues across projects`,
          description: `${negativeCount} negative ${category}-related lessons found across ${projectCount} project(s). This is a systemic area requiring attention.`,
          frequency: projectCount,
          projectTypes,
          category,
          recommendation: `Establish organization-wide ${category} management standards and conduct retrospectives focused on ${category} challenges.`,
          confidence: Math.min(90, 50 + negativeCount * 10),
        });
      }

      if (positiveCount >= 2) {
        detectedPatterns.push({
          id: `pat-det-${++counter}`,
          title: `Consistent ${category} strengths`,
          description: `${positiveCount} positive ${category}-related lessons found across ${projectCount} project(s). These successes can be replicated.`,
          frequency: projectCount,
          projectTypes,
          category,
          recommendation: `Document and standardize the ${category} practices that led to positive outcomes across these projects.`,
          confidence: Math.min(85, 45 + positiveCount * 10),
        });
      }
    }

    LessonsLearnedService.patterns = detectedPatterns;
    return detectedPatterns;
  }

  // -----------------------------------------------------------------------
  // Suggest mitigations for a described risk (AI-enhanced)
  // -----------------------------------------------------------------------

  async suggestMitigations(
    riskDescription: string,
    projectType: string,
    userId?: string,
  ): Promise<MitigationSuggestion[]> {
    // Find relevant historical lessons scoped to user
    const userLessons = userId
      ? LessonsLearnedService.lessons.filter((l) => l.userId === userId)
      : LessonsLearnedService.lessons;
    const relevantLessons = userLessons.filter((l) => {
      const typeMatch = l.projectType === projectType;
      const descLower = riskDescription.toLowerCase();
      const categoryMatch =
        descLower.includes(l.category) ||
        l.title.toLowerCase().includes(descLower.split(' ')[0]) ||
        l.description.toLowerCase().includes(descLower.split(' ')[0]);
      return typeMatch || categoryMatch;
    });

    if (config.AI_ENABLED && claudeService.isAvailable() && relevantLessons.length > 0) {
      try {
        const historicalStr = JSON.stringify(
          relevantLessons.map((l) => ({
            id: l.id,
            projectName: l.projectName,
            category: l.category,
            title: l.title,
            description: l.description,
            impact: l.impact,
            recommendation: l.recommendation,
          })),
          null,
          2,
        );

        const systemPrompt = mitigationPrompt.render({
          riskDescription,
          projectType,
          historicalLessons: historicalStr,
        });

        const result = await claudeService.completeWithJsonSchema({
          systemPrompt,
          userMessage: 'Based on the historical lessons and risk, suggest mitigations. Return the JSON.',
          schema: MitigationAISchema,
          maxTokens: 2048,
        });

        return result.data.suggestions.map((s, i) => ({
          lessonId: relevantLessons[i]?.id,
          source: relevantLessons[i]?.projectName ?? 'AI Analysis',
          relevance: s.relevance,
          suggestion: s.suggestion,
          historicalOutcome: s.historicalOutcome,
        }));
      } catch {
        // Fall through to deterministic suggestions
      }
    }

    // Deterministic fallback
    return this.suggestMitigationsDeterministic(riskDescription, projectType, relevantLessons);
  }

  private suggestMitigationsDeterministic(
    riskDescription: string,
    _projectType: string,
    relevantLessons: LessonLearned[],
  ): MitigationSuggestion[] {
    if (relevantLessons.length === 0) {
      // No historical data — provide generic suggestions based on risk keywords
      const suggestions: MitigationSuggestion[] = [];
      const descLower = riskDescription.toLowerCase();

      if (descLower.includes('budget') || descLower.includes('cost') || descLower.includes('spend')) {
        suggestions.push({
          source: 'General best practices',
          relevance: 60,
          suggestion: 'Implement weekly budget tracking with earned value metrics. Set up automatic alerts when spending exceeds 80% of allocated amounts.',
        });
      }
      if (descLower.includes('schedule') || descLower.includes('delay') || descLower.includes('timeline')) {
        suggestions.push({
          source: 'General best practices',
          relevance: 60,
          suggestion: 'Review the critical path and add buffer time to high-risk tasks. Increase check-in frequency for tasks on the critical path.',
        });
      }
      if (descLower.includes('resource') || descLower.includes('staff') || descLower.includes('team')) {
        suggestions.push({
          source: 'General best practices',
          relevance: 55,
          suggestion: 'Cross-train team members to reduce single points of failure. Maintain a resource contingency plan for key roles.',
        });
      }

      if (suggestions.length === 0) {
        suggestions.push({
          source: 'General best practices',
          relevance: 40,
          suggestion: 'Conduct a detailed risk assessment with the project team. Document identified risks in a risk register with assigned owners and response plans.',
        });
      }

      return suggestions;
    }

    // Build suggestions from relevant historical lessons
    return relevantLessons.slice(0, 5).map((lesson) => ({
      lessonId: lesson.id,
      source: lesson.projectName,
      relevance: lesson.confidence,
      suggestion: lesson.recommendation,
      historicalOutcome: lesson.impact === 'negative'
        ? `This issue was observed on the "${lesson.projectName}" project: ${lesson.description}`
        : lesson.impact === 'positive'
          ? `The "${lesson.projectName}" project handled this well: ${lesson.description}`
          : undefined,
    }));
  }

  // -----------------------------------------------------------------------
  // Add a lesson manually
  // -----------------------------------------------------------------------

  async addLesson(data: {
    projectId: string;
    projectName: string;
    projectType: string;
    category: LessonLearned['category'];
    title: string;
    description: string;
    impact: LessonLearned['impact'];
    recommendation: string;
    confidence?: number;
    userId?: string;
  }): Promise<LessonLearned> {
    const lesson: LessonLearned = {
      id: randomUUID(),
      projectId: data.projectId,
      projectName: data.projectName,
      projectType: data.projectType,
      category: data.category,
      title: data.title,
      description: data.description,
      impact: data.impact,
      recommendation: data.recommendation,
      confidence: data.confidence ?? 80,
      userId: data.userId,
      createdAt: new Date().toISOString(),
    };

    LessonsLearnedService.lessons.push(lesson);
    // Cap lessons to prevent unbounded memory growth
    const MAX_LESSONS = 10000;
    if (LessonsLearnedService.lessons.length > MAX_LESSONS) {
      LessonsLearnedService.lessons.splice(0, LessonsLearnedService.lessons.length - MAX_LESSONS);
    }
    return lesson;
  }
}
