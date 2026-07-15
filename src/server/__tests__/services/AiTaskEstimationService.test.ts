import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before import
vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn() },
}));
vi.mock('../../services/claudeService', () => ({
  claudeService: {
    isAvailable: vi.fn(),
    completeWithJsonSchema: vi.fn(),
  },
}));
vi.mock('../../config', () => ({
  config: { AI_ENABLED: true },
}));

import { AiTaskEstimationService } from '../../services/AiTaskEstimationService';
import { databaseService } from '../../database/connection';
import { claudeService } from '../../services/claudeService';
import { config } from '../../config';

describe('AiTaskEstimationService', () => {
  let service: AiTaskEstimationService;
  const mockQuery = databaseService.query as ReturnType<typeof vi.fn>;
  const mockIsAvailable = claudeService.isAvailable as ReturnType<typeof vi.fn>;
  const mockComplete = claudeService.completeWithJsonSchema as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiTaskEstimationService();
    mockQuery.mockResolvedValue([]);
  });

  it('returns fallback estimate of 3 days when no historical data and AI disabled', async () => {
    (config as any).AI_ENABLED = false;
    const result = await service.estimate({ taskName: 'Test task', projectId: 'p1' });
    expect(result.estimatedDays).toBe(3);
    expect(result.confidence).toBe(20);
    expect(result.aiPowered).toBe(false);
    expect(result.historicalDataPoints).toBe(0);
    (config as any).AI_ENABLED = true;
  });

  it('returns average-based fallback when AI unavailable but historical data exists', async () => {
    mockIsAvailable.mockReturnValue(false);
    mockQuery.mockResolvedValue([
      { name: 'Task A', estimated_days: 5, actual_days: 4, priority: 'high', status: 'completed' },
      { name: 'Task B', estimated_days: 3, actual_days: 6, priority: 'medium', status: 'completed' },
    ]);

    const result = await service.estimate({ taskName: 'New task', projectId: 'p1' });
    expect(result.estimatedDays).toBe(5); // avg of 4+6=10/2=5
    expect(result.aiPowered).toBe(false);
    expect(result.historicalDataPoints).toBe(2);
  });

  it('calls Claude and returns AI estimate when available', async () => {
    mockIsAvailable.mockReturnValue(true);
    mockQuery.mockResolvedValue([
      { name: 'Task A', estimated_days: 5, actual_days: 4, priority: 'high', status: 'completed' },
    ]);
    mockComplete.mockResolvedValue({
      data: { estimatedDays: 7, confidence: 85, reasoning: 'Complex integration work' },
    });

    const result = await service.estimate({ taskName: 'API integration', projectId: 'p1' });
    expect(result.estimatedDays).toBe(7);
    expect(result.confidence).toBe(85);
    expect(result.reasoning).toBe('Complex integration work');
    expect(result.aiPowered).toBe(true);
    expect(result.historicalDataPoints).toBe(1);
    expect(mockComplete).toHaveBeenCalledOnce();
  });

  it('falls back gracefully when AI call throws', async () => {
    mockIsAvailable.mockReturnValue(true);
    mockQuery.mockResolvedValue([
      { name: 'Task A', estimated_days: 2, actual_days: 3, priority: 'low', status: 'completed' },
    ]);
    mockComplete.mockRejectedValue(new Error('API timeout'));

    const result = await service.estimate({ taskName: 'Fallback task', projectId: 'p1' });
    expect(result.aiPowered).toBe(false);
    expect(result.estimatedDays).toBe(3);
    expect(result.historicalDataPoints).toBe(1);
  });

  it('rounds fallback estimate to nearest 0.5 with minimum of 0.5', async () => {
    mockIsAvailable.mockReturnValue(false);
    mockQuery.mockResolvedValue([
      { name: 'Quick fix', estimated_days: 1, actual_days: 0.3, priority: 'low', status: 'completed' },
    ]);

    const result = await service.estimate({ taskName: 'Tiny task', projectId: 'p1' });
    expect(result.estimatedDays).toBe(0.5); // 0.3 rounds to 0.5, min is 0.5
    expect(result.aiPowered).toBe(false);
  });
});
