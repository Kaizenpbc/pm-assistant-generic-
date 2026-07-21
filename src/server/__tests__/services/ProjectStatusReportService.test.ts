import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../services/claudeService', () => {
  const mockComplete = vi.fn();
  const mockIsAvailable = vi.fn();
  return {
    claudeService: {
      complete: mockComplete,
      isAvailable: mockIsAvailable,
    },
    promptTemplates: {
      statusReport: {
        render: vi.fn((vars: Record<string, string>) => `System prompt with ${vars.projectData}`),
      },
    },
  };
});

vi.mock('../../services/aiContextBuilder', () => ({
  AIContextBuilder: vi.fn().mockImplementation(() => ({
    buildProjectContext: vi.fn().mockResolvedValue({
      project: { name: 'Test Project', projectType: 'software' },
      tasks: [],
      risks: [],
    }),
    toPromptString: vi.fn().mockReturnValue('Project: Test Project\nType: software'),
  })),
}));

vi.mock('../../services/EmailService', () => ({
  emailService: {
    sendStatusReportEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/aiUsageLogger', () => ({
  logAIUsage: vi.fn(),
}));

vi.mock('../../database/connection', () => ({
  databaseService: {
    query: vi.fn().mockResolvedValue([]),
    queryControlPlane: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { ProjectStatusReportService } from '../../services/ProjectStatusReportService';
import { claudeService } from '../../services/claudeService';
import { emailService } from '../../services/EmailService';

const MOCK_AI_RESPONSE = JSON.stringify({
  executiveSummary: 'Project is on track with minor schedule concerns.',
  areas: [
    { name: 'Schedule', status: 'amber', comments: '2 tasks overdue' },
    { name: 'Budget', status: 'green', comments: 'On track' },
    { name: 'Resources', status: 'green', comments: 'Fully staffed' },
    { name: 'Risks', status: 'amber', comments: '1 high risk' },
    { name: 'Scope', status: 'green', comments: 'No changes' },
    { name: 'Quality', status: 'green', comments: 'All tasks have estimates' },
  ],
  managementActions: [
    'Review overdue tasks in sprint 3',
    'Approve budget for Q3',
  ],
});

describe('ProjectStatusReportService', () => {
  let service: ProjectStatusReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectStatusReportService();
  });

  it('generates a structured report with AI when available', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockResolvedValue({
      content: MOCK_AI_RESPONSE,
      usage: { inputTokens: 100, outputTokens: 200 },
      latencyMs: 500,
      model: 'claude-sonnet-4-6',
    });

    const result = await service.generate('proj-1', 'user-1');

    expect(result.aiPowered).toBe(true);
    expect(result.html).toContain('Executive Summary');
    expect(result.html).toContain('Actions for Management');
    expect(result.data.areas).toHaveLength(6);
    expect(result.data.areas[0].name).toBe('Schedule');
    expect(result.data.areas[0].status).toBe('amber');
    expect(result.data.managementActions).toHaveLength(2);
    expect(result.emailSent).toBe(false);
  });

  it('generates fallback report when AI unavailable', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(false);

    const result = await service.generate('proj-1', 'user-1');

    expect(result.aiPowered).toBe(false);
    expect(result.data.areas).toHaveLength(6);
    expect(result.data.areas.every(a => a.status === 'amber')).toBe(true);
    expect(result.html).toContain('Template Report');
  });

  it('generates fallback when Claude fails', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockRejectedValue(new Error('API error'));

    const result = await service.generate('proj-1', 'user-1');

    expect(result.aiPowered).toBe(false);
    expect(result.data.areas).toHaveLength(6);
  });

  it('sends email with HTML when sendEmail is true', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockResolvedValue({
      content: MOCK_AI_RESPONSE,
      usage: { inputTokens: 50, outputTokens: 100 },
      latencyMs: 300,
      model: 'claude-sonnet-4-6',
    });

    const result = await service.generate('proj-1', 'user-1', {
      sendEmail: true,
      recipients: ['test@example.com'],
    });

    expect(result.emailSent).toBe(true);
    expect(emailService.sendStatusReportEmail).toHaveBeenCalledWith(
      ['test@example.com'],
      'Test Project',
      expect.stringContaining('Executive Summary'),
    );
  });

  it('does not send email when sendEmail is false', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockResolvedValue({
      content: MOCK_AI_RESPONSE,
      usage: { inputTokens: 50, outputTokens: 100 },
      latencyMs: 300,
      model: 'claude-sonnet-4-6',
    });

    const result = await service.generate('proj-1', 'user-1', {
      sendEmail: false,
      recipients: ['test@example.com'],
    });

    expect(result.emailSent).toBe(false);
    expect(emailService.sendStatusReportEmail).not.toHaveBeenCalled();
  });

  it('handles email failure gracefully', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockResolvedValue({
      content: MOCK_AI_RESPONSE,
      usage: { inputTokens: 50, outputTokens: 100 },
      latencyMs: 300,
      model: 'claude-sonnet-4-6',
    });
    vi.mocked(emailService.sendStatusReportEmail).mockRejectedValue(new Error('SMTP error'));

    const result = await service.generate('proj-1', 'user-1', {
      sendEmail: true,
      recipients: ['test@example.com'],
    });

    expect(result.emailSent).toBe(false);
    expect(result.html).toContain('Executive Summary');
  });

  it('computes trend from previous report', async () => {
    const { databaseService } = await import('../../database/connection');
    vi.mocked(databaseService.queryControlPlane).mockResolvedValueOnce([
      {
        messages: JSON.stringify([{
          content: JSON.stringify({
            areas: [
              { name: 'Schedule', status: 'green' },
              { name: 'Budget', status: 'green' },
              { name: 'Resources', status: 'green' },
              { name: 'Risks', status: 'green' },
              { name: 'Scope', status: 'green' },
              { name: 'Quality', status: 'green' },
            ],
          }),
        }]),
      },
    ] as any);

    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockResolvedValue({
      content: MOCK_AI_RESPONSE,
      usage: { inputTokens: 50, outputTokens: 100 },
      latencyMs: 300,
      model: 'claude-sonnet-4-6',
    });

    const result = await service.generate('proj-1', 'user-1');

    const schedule = result.data.areas.find(a => a.name === 'Schedule');
    expect(schedule?.previousStatus).toBe('green');
    expect(schedule?.trend).toBe('declining'); // green -> amber
    const budget = result.data.areas.find(a => a.name === 'Budget');
    expect(budget?.previousStatus).toBe('green');
    expect(budget?.trend).toBe('stable'); // green -> green
  });
});
