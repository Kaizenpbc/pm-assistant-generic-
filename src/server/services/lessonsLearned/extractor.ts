import { claudeService } from '../claudeService';
import { projectService } from '../ProjectService';
import { scheduleService } from '../ScheduleService';
import { config } from '../../config';
import {
  LessonsExtractionAISchema,
  type LessonLearned,
} from '../../schemas/lessonsLearnedSchemas';
import { lessonsExtractionPrompt } from './prompts';

export async function extractLessons(
  projectId: string,
  persistLesson: (lesson: LessonLearned) => Promise<void>,
): Promise<LessonLearned[]> {
  const project = await projectService.findById(projectId);
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
        startDate: t.startDate ?? null,
        endDate: t.endDate ?? null,
        dueDate: t.dueDate ?? null,
        dependency: t.dependency ?? null,
        dependencies: t.dependencies.map(d => ({ id: d.dependencyId, type: d.dependencyType, lag: d.lagDays })),
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
      startDate: project.startDate ?? null,
      endDate: project.endDate ?? null,
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
        createdAt: new Date().toISOString(),
      }));

      for (const lesson of newLessons) {
        await persistLesson(lesson);
      }

      return newLessons;
    } catch {
      // Fall through to deterministic extraction
    }
  }

  return extractLessonsDeterministic(project, scheduleData, persistLesson);
}

async function extractLessonsDeterministic(
  project: { id: string; name: string; projectType: string; budgetAllocated?: number; budgetSpent: number; startDate?: string; endDate?: string; status: string },
  scheduleData: Array<{ scheduleName: string; tasks: any[] }>,
  persistLesson: (lesson: LessonLearned) => Promise<void>,
): Promise<LessonLearned[]> {
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

  for (const lesson of newLessons) {
    await persistLesson(lesson);
  }

  return newLessons;
}
