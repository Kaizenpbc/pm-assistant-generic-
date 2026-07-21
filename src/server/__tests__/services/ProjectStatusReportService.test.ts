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

describe('ProjectStatusReportService', () => {
  let service: ProjectStatusReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectStatusReportService();
  });

  it('generates a report with AI when available', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockResolvedValue({
      content: '## Executive Summary\nProject is on track.',
      usage: { inputTokens: 100, outputTokens: 200 },
      latencyMs: 500,
      model: 'claude-sonnet-4-6',
    });

    const result = await service.generate('proj-1', 'user-1');

    expect(result.aiPowered).toBe(true);
    expect(result.content).toContain('Executive Summary');
    expect(result.projectId).toBe('proj-1');
    expect(result.emailSent).toBe(false);
  });

  it('generates fallback report when AI unavailable', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(false);

    const result = await service.generate('proj-1', 'user-1');

    expect(result.aiPowered).toBe(false);
    expect(result.content).toContain('Template (AI unavailable)');
  });

  it('generates fallback when Claude fails', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockRejectedValue(new Error('API error'));

    const result = await service.generate('proj-1', 'user-1');

    expect(result.aiPowered).toBe(false);
    expect(result.content).toContain('Template (AI unavailable)');
  });

  it('sends email when sendEmail is true with recipients', async () => {
    vi.mocked(claudeService.isAvailable).mockReturnValue(true);
    vi.mocked(claudeService.complete).mockResolvedValue({
      content: '## Executive Summary\nAll good.',
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
      content: '## Executive Summary\nOK.',
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
      content: '## Summary\nOK.',
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
    expect(result.content).toContain('Summary');
  });
});
