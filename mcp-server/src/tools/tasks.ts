import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiClientFromExtra, jsonResult } from '../api-client.js';

export function registerTaskTools(server: McpServer) {
  server.tool('list-tasks', 'List tasks in a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
  }, async ({ scheduleId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/schedules/${scheduleId}/tasks`))
  );

  server.tool('create-task', 'Create a new task in a schedule', {
    scheduleId: z.string().describe('Schedule ID'),
    name: z.string().describe('Task name'),
    description: z.string().optional().describe('Task description'),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().describe('Task status'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority'),
    assignedTo: z.string().optional().describe('Assigned resource ID'),
    dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
    estimatedDays: z.number().optional().describe('Estimated duration in days'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
    progressPercentage: z.number().optional().describe('Progress 0-100'),
    dependency: z.string().optional().describe('Dependency task ID'),
    parentTaskId: z.string().optional().describe('Parent task ID for subtasks'),
  }, async ({ scheduleId, ...data }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/schedules/${scheduleId}/tasks`, data))
  );

  server.tool('update-task', 'Update an existing task', {
    scheduleId: z.string().describe('Schedule ID'),
    taskId: z.string().describe('Task ID'),
    name: z.string().optional().describe('Task name'),
    description: z.string().optional().describe('Task description'),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().describe('Task status'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority'),
    assignedTo: z.string().optional().describe('Assigned resource ID'),
    dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
    estimatedDays: z.number().optional().describe('Estimated duration in days'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
    progressPercentage: z.number().optional().describe('Progress 0-100'),
    dependency: z.string().optional().describe('Dependency task ID'),
  }, async ({ scheduleId, taskId, ...data }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).put(`/schedules/${scheduleId}/tasks/${taskId}`, data))
  );

  server.tool('delete-task', 'Delete a task', {
    scheduleId: z.string().describe('Schedule ID'),
    taskId: z.string().describe('Task ID'),
  }, async ({ scheduleId, taskId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).delete(`/schedules/${scheduleId}/tasks/${taskId}`))
  );

  server.tool('bulk-create-tasks', 'Bulk create up to 100 tasks', {
    tasks: z.array(z.object({
      scheduleId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      assignedTo: z.string().optional(),
      dueDate: z.string().optional(),
      estimatedDays: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      dependency: z.string().optional(),
    })).describe('Array of tasks to create (max 100)'),
  }, async ({ tasks }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post('/bulk/tasks', { tasks }))
  );

  server.tool('bulk-update-tasks', 'Bulk update multiple tasks', {
    tasks: z.array(z.object({
      id: z.string(),
      name: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      assignedTo: z.string().optional(),
      progressPercentage: z.number().optional(),
    })).describe('Array of task updates'),
  }, async ({ tasks }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).put('/bulk/tasks', { tasks }))
  );

  server.tool('bulk-status-update', 'Batch status change for multiple tasks', {
    taskIds: z.array(z.string()).describe('Task IDs to update'),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).describe('New status'),
  }, async (params, extra) =>
    jsonResult(await getApiClientFromExtra(extra).put('/bulk/tasks/status', params))
  );

  server.tool('list-task-comments', 'Get comments for a task', {
    scheduleId: z.string().describe('Schedule ID'),
    taskId: z.string().describe('Task ID'),
  }, async ({ scheduleId, taskId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/schedules/${scheduleId}/tasks/${taskId}/comments`))
  );

  server.tool('add-task-comment', 'Add a comment to a task', {
    scheduleId: z.string().describe('Schedule ID'),
    taskId: z.string().describe('Task ID'),
    text: z.string().describe('Comment text'),
  }, async ({ scheduleId, taskId, text }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).post(`/schedules/${scheduleId}/tasks/${taskId}/comments`, { text }))
  );

  server.tool('get-task-activity', 'Get activity feed for a task', {
    scheduleId: z.string().describe('Schedule ID'),
    taskId: z.string().describe('Task ID'),
  }, async ({ scheduleId, taskId }, extra) =>
    jsonResult(await getApiClientFromExtra(extra).get(`/schedules/${scheduleId}/tasks/${taskId}/activity`))
  );
}
