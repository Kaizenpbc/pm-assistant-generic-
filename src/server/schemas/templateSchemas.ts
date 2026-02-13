import { z } from 'zod';

export const templateTaskSchema = z.object({
  refId: z.string(),
  name: z.string(),
  description: z.string().default(''),
  estimatedDays: z.number().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  parentRefId: z.string().nullable().default(null),
  dependencyRefId: z.string().nullable().default(null),
  dependencyType: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
  offsetDays: z.number().default(0),
  skills: z.array(z.string()).default([]),
  isSummary: z.boolean().default(false),
  mandatory: z.boolean().optional(),
});

export type TemplateTask = z.infer<typeof templateTaskSchema>;

export const projectTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  projectType: z.enum(['it', 'construction', 'infrastructure', 'roads', 'other']),
  category: z.string(),
  isBuiltIn: z.boolean().default(true),
  createdBy: z.string().nullable().default(null),
  estimatedDurationDays: z.number(),
  tasks: z.array(templateTaskSchema),
  tags: z.array(z.string()).default([]),
  usageCount: z.number().default(0),
});

export type ProjectTemplate = z.infer<typeof projectTemplateSchema>;

export const createFromTemplateSchema = z.object({
  templateId: z.string(),
  projectName: z.string().min(1),
  startDate: z.string(),
  budget: z.number().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  location: z.string().optional(),
  selectedTaskRefIds: z.array(z.string()).min(1).optional(),
});

export type CreateFromTemplate = z.infer<typeof createFromTemplateSchema>;

export const saveAsTemplateSchema = z.object({
  projectId: z.string(),
  templateName: z.string().min(1),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

export type SaveAsTemplate = z.infer<typeof saveAsTemplateSchema>;
