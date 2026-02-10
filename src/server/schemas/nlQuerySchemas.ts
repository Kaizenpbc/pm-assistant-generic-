import { z } from 'zod';

// ---------------------------------------------------------------------------
// Chart Specification
// ---------------------------------------------------------------------------

export const ChartSpecSchema = z.object({
  type: z.enum(['bar', 'line', 'pie', 'horizontal_bar']),
  title: z.string(),
  data: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      color: z.string().optional(),
      group: z.string().optional(),
    }),
  ),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
});

export type ChartSpec = z.infer<typeof ChartSpecSchema>;

// ---------------------------------------------------------------------------
// AI Response (structured output from the second Claude call)
// ---------------------------------------------------------------------------

export const NLQueryAIResponseSchema = z.object({
  answer: z.string().describe('Markdown-formatted answer to the user query'),
  charts: z.array(ChartSpecSchema).describe('Charts to visualize the answer; can be empty'),
  suggestedFollowUps: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('2-4 natural-language follow-up questions the user might ask next'),
});

export type NLQueryAIResponse = z.infer<typeof NLQueryAIResponseSchema>;

// ---------------------------------------------------------------------------
// Final result returned to the client
// ---------------------------------------------------------------------------

export const NLQueryResultSchema = z.object({
  answer: z.string(),
  charts: z.array(ChartSpecSchema),
  dataSources: z.array(z.string()).describe('Which tools were used to gather data'),
  confidence: z.number().min(0).max(100),
  suggestedFollowUps: z.array(z.string()),
});

export type NLQueryResult = z.infer<typeof NLQueryResultSchema>;

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

export const NLQueryRequestSchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters'),
  context: z
    .object({
      projectId: z.string().optional(),
    })
    .optional(),
});

export type NLQueryRequest = z.infer<typeof NLQueryRequestSchema>;
