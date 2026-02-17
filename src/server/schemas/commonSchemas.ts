import { z } from 'zod';

/** Reusable Zod schemas for route parameter validation. */

export const idParam = z.object({ id: z.string().min(1).max(100) });
export const projectIdParam = z.object({ projectId: z.string().min(1).max(100) });
export const scheduleIdParam = z.object({ scheduleId: z.string().min(1).max(100) });
export const taskIdParam = z.object({ taskId: z.string().min(1).max(100) });
export const baselineIdParam = z.object({ baselineId: z.string().min(1).max(100) });
export const analysisIdParam = z.object({ analysisId: z.string().min(1).max(100) });
export const proposalIdParam = z.object({ proposalId: z.string().min(1).max(100) });
export const conversationIdParam = z.object({ id: z.string().min(1).max(100) });

/** Combination schemas for nested routes. */
export const scheduleAndTaskIdParam = z.object({
  scheduleId: z.string().min(1).max(100),
  taskId: z.string().min(1).max(100),
});

export const scheduleAndBaselineIdParam = z.object({
  scheduleId: z.string().min(1).max(100),
  baselineId: z.string().min(1).max(100),
});

export const scheduleTaskCommentIdParam = z.object({
  scheduleId: z.string().min(1).max(100),
  taskId: z.string().min(1).max(100),
  commentId: z.string().min(1).max(100),
});

export const projectAndScheduleIdParam = z.object({
  projectId: z.string().min(1).max(100),
  scheduleId: z.string().min(1).max(100),
});

export const memberIdParam = z.object({ memberId: z.string().min(1).max(100) });

export const projectAndMemberIdParam = z.object({
  projectId: z.string().min(1).max(100),
  memberId: z.string().min(1).max(100),
});
