import { z } from 'zod';

// A single factor contributing to a task's priority score
export const PriorityFactorSchema = z.object({
  factor: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
  description: z.string(),
});

export type PriorityFactor = z.infer<typeof PriorityFactorSchema>;

// A single task with its prioritization analysis
export const PrioritizedTaskSchema = z.object({
  taskId: z.string(),
  taskName: z.string(),
  currentPriority: z.enum(['low', 'medium', 'high', 'urgent']),
  suggestedPriority: z.enum(['low', 'medium', 'high', 'urgent']),
  priorityScore: z.number().min(0).max(100),
  rank: z.number().min(1),
  factors: z.array(PriorityFactorSchema),
  explanation: z.string(),
});

export type PrioritizedTask = z.infer<typeof PrioritizedTaskSchema>;

// Summary statistics for the prioritization analysis
export const PrioritizationSummarySchema = z.object({
  totalTasks: z.number(),
  tasksAnalyzed: z.number(),
  priorityChanges: z.number(),
  criticalPathTasks: z.number(),
  delayedTasks: z.number(),
  averageScore: z.number(),
});

export type PrioritizationSummary = z.infer<typeof PrioritizationSummarySchema>;

// Full result returned to the client
export const PrioritizationResultSchema = z.object({
  tasks: z.array(PrioritizedTaskSchema),
  summary: PrioritizationSummarySchema,
  aiPowered: z.boolean(),
});

export type PrioritizationResult = z.infer<typeof PrioritizationResultSchema>;

// What Claude returns when refining prioritization
export const PrioritizationAIResponseSchema = z.object({
  tasks: z.array(
    z.object({
      taskId: z.string(),
      rank: z.number(),
      priorityScore: z.number(),
      suggestedPriority: z.enum(['low', 'medium', 'high', 'urgent']),
      factors: z.array(
        z.object({
          factor: z.string(),
          impact: z.enum(['high', 'medium', 'low']),
          description: z.string(),
        }),
      ),
      explanation: z.string(),
    }),
  ),
});

export type PrioritizationAIResponse = z.infer<typeof PrioritizationAIResponseSchema>;
