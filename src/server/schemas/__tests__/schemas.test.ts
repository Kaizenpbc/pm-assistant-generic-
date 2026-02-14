/**
 * Zod Schema Validation Tests
 *
 * Tests all 12 schema files to verify they correctly accept valid data
 * and reject malformed input (edge cases, boundary values, missing fields).
 */
import { describe, it, expect } from 'vitest';

import {
  MonteCarloConfigSchema,
  MonteCarloResultSchema,
  HistogramBinSchema,
  SensitivityItemSchema,
  DurationStatsSchema,
} from '../monteCarloSchemas';

import {
  NLQueryRequestSchema,
  NLQueryAIResponseSchema,
  NLQueryResultSchema,
  ChartSpecSchema,
} from '../nlQuerySchemas';

import {
  PriorityFactorSchema,
  PrioritizedTaskSchema,
  PrioritizationResultSchema,
  PrioritizationAIResponseSchema,
} from '../taskPrioritizationSchemas';

import {
  templateTaskSchema,
  projectTemplateSchema,
  createFromTemplateSchema,
  saveAsTemplateSchema,
} from '../templateSchemas';

import {
  DelayedTaskSchema,
  ProposedChangeSchema,
  RescheduleProposalSchema,
} from '../autoRescheduleSchemas';

import {
  BottleneckPredictionSchema,
  BurnoutRiskSchema,
  RebalanceSuggestionSchema,
  SkillMatchSchema,
  ResourceForecastResultSchema,
} from '../resourceOptimizerSchemas';

import {
  EVMForecastAIResponseSchema,
  EVMCurrentMetricsSchema,
  EVMEarlyWarningSchema,
  EVMCorrectiveActionSchema,
} from '../evmForecastSchemas';

import {
  LessonLearnedSchema,
  PatternSchema,
  MitigationSuggestionSchema,
  KnowledgeBaseOverviewSchema,
} from '../lessonsLearnedSchemas';

import {
  MeetingActionItemSchema,
  MeetingTaskUpdateSchema,
  MeetingAIResponseSchema,
  AnalyzeRequestSchema,
} from '../meetingSchemas';

import {
  AIFeedbackRecordSchema,
  AIAccuracyRecordSchema,
  AIAccuracyReportSchema,
  AIScenarioRequestSchema,
  AIScenarioResultSchema,
  AIAnomalySchema,
  AIAnomalyReportSchema,
} from '../phase5Schemas';

import {
  AIRiskItemSchema,
  AIRiskAssessmentSchema,
  AIWeatherImpactSchema,
  AIBudgetForecastSchema,
} from '../predictiveSchemas';

// ===================================================================
// MonteCarloSchemas
// ===================================================================

describe('MonteCarloSchemas', () => {
  describe('MonteCarloConfigSchema', () => {
    it('accepts valid config', () => {
      const result = MonteCarloConfigSchema.parse({ iterations: 5000, confidenceLevels: [50, 80, 90], uncertaintyModel: 'pert' });
      expect(result.iterations).toBe(5000);
    });

    it('applies defaults when fields omitted', () => {
      const result = MonteCarloConfigSchema.parse({});
      expect(result.iterations).toBe(10000);
      expect(result.confidenceLevels).toEqual([50, 80, 90]);
      expect(result.uncertaintyModel).toBe('pert');
    });

    it('rejects iterations below 100', () => {
      expect(() => MonteCarloConfigSchema.parse({ iterations: 50 })).toThrow();
    });

    it('rejects iterations above 100000', () => {
      expect(() => MonteCarloConfigSchema.parse({ iterations: 200000 })).toThrow();
    });

    it('rejects non-integer iterations', () => {
      expect(() => MonteCarloConfigSchema.parse({ iterations: 5000.5 })).toThrow();
    });

    it('rejects confidence levels outside 1-99', () => {
      expect(() => MonteCarloConfigSchema.parse({ confidenceLevels: [0] })).toThrow();
      expect(() => MonteCarloConfigSchema.parse({ confidenceLevels: [100] })).toThrow();
    });

    it('rejects invalid uncertainty model', () => {
      expect(() => MonteCarloConfigSchema.parse({ uncertaintyModel: 'gaussian' })).toThrow();
    });

    it('accepts triangular model', () => {
      const result = MonteCarloConfigSchema.parse({ uncertaintyModel: 'triangular' });
      expect(result.uncertaintyModel).toBe('triangular');
    });
  });

  describe('HistogramBinSchema', () => {
    it('accepts valid bin', () => {
      expect(HistogramBinSchema.parse({ min: 80, max: 90, count: 15, cumulativePercent: 30 })).toBeTruthy();
    });

    it('rejects missing fields', () => {
      expect(() => HistogramBinSchema.parse({ min: 80 })).toThrow();
    });
  });

  describe('DurationStatsSchema', () => {
    it('accepts valid stats', () => {
      const stats = { min: 80, max: 130, mean: 102, stdDev: 12, p50: 100, p80: 115, p90: 125 };
      expect(DurationStatsSchema.parse(stats)).toEqual(stats);
    });

    it('rejects missing p-values', () => {
      expect(() => DurationStatsSchema.parse({ min: 80, max: 130, mean: 102 })).toThrow();
    });
  });
});

// ===================================================================
// NLQuerySchemas
// ===================================================================

describe('NLQuerySchemas', () => {
  describe('NLQueryRequestSchema', () => {
    it('accepts valid query', () => {
      const result = NLQueryRequestSchema.parse({ query: 'Show me budget status' });
      expect(result.query).toBe('Show me budget status');
    });

    it('accepts query with context', () => {
      const result = NLQueryRequestSchema.parse({ query: 'Show risks', context: { projectId: 'p1' } });
      expect(result.context?.projectId).toBe('p1');
    });

    it('rejects query shorter than 3 chars', () => {
      expect(() => NLQueryRequestSchema.parse({ query: 'ab' })).toThrow();
    });

    it('rejects empty query', () => {
      expect(() => NLQueryRequestSchema.parse({ query: '' })).toThrow();
    });
  });

  describe('ChartSpecSchema', () => {
    it('accepts valid chart spec', () => {
      const chart = { type: 'bar', title: 'Budget', data: [{ label: 'Q1', value: 100 }] };
      expect(ChartSpecSchema.parse(chart).type).toBe('bar');
    });

    it('accepts all chart types', () => {
      for (const type of ['bar', 'line', 'pie', 'horizontal_bar']) {
        expect(ChartSpecSchema.parse({ type, title: 'T', data: [] }).type).toBe(type);
      }
    });

    it('rejects invalid chart type', () => {
      expect(() => ChartSpecSchema.parse({ type: 'scatter', title: 'T', data: [] })).toThrow();
    });

    it('accepts optional color and group in data items', () => {
      const chart = { type: 'bar', title: 'T', data: [{ label: 'A', value: 1, color: '#ff0000', group: 'G1' }] };
      expect(ChartSpecSchema.parse(chart).data[0].color).toBe('#ff0000');
    });
  });

  describe('NLQueryAIResponseSchema', () => {
    it('rejects fewer than 2 follow-ups', () => {
      expect(() => NLQueryAIResponseSchema.parse({
        answer: 'result',
        charts: [],
        suggestedFollowUps: ['one'],
      })).toThrow();
    });

    it('rejects more than 4 follow-ups', () => {
      expect(() => NLQueryAIResponseSchema.parse({
        answer: 'result',
        charts: [],
        suggestedFollowUps: ['1', '2', '3', '4', '5'],
      })).toThrow();
    });

    it('accepts valid response', () => {
      const resp = {
        answer: 'Here are your results',
        charts: [],
        suggestedFollowUps: ['What next?', 'Show details'],
      };
      expect(NLQueryAIResponseSchema.parse(resp).answer).toBe('Here are your results');
    });
  });

  describe('NLQueryResultSchema', () => {
    it('rejects confidence outside 0-100', () => {
      expect(() => NLQueryResultSchema.parse({
        answer: 'a', charts: [], dataSources: [], confidence: 150, suggestedFollowUps: [],
      })).toThrow();
    });

    it('accepts confidence at boundary 0', () => {
      const result = NLQueryResultSchema.parse({
        answer: 'a', charts: [], dataSources: [], confidence: 0, suggestedFollowUps: [],
      });
      expect(result.confidence).toBe(0);
    });

    it('accepts confidence at boundary 100', () => {
      const result = NLQueryResultSchema.parse({
        answer: 'a', charts: [], dataSources: [], confidence: 100, suggestedFollowUps: [],
      });
      expect(result.confidence).toBe(100);
    });
  });
});

// ===================================================================
// TaskPrioritizationSchemas
// ===================================================================

describe('TaskPrioritizationSchemas', () => {
  describe('PrioritizedTaskSchema', () => {
    const validTask = {
      taskId: 't1', taskName: 'Task 1',
      currentPriority: 'medium', suggestedPriority: 'high',
      priorityScore: 75, rank: 1,
      factors: [{ factor: 'deadline', impact: 'high', description: 'Near deadline' }],
      explanation: 'Critical path task',
    };

    it('accepts valid task', () => {
      expect(PrioritizedTaskSchema.parse(validTask).priorityScore).toBe(75);
    });

    it('rejects priorityScore above 100', () => {
      expect(() => PrioritizedTaskSchema.parse({ ...validTask, priorityScore: 101 })).toThrow();
    });

    it('rejects priorityScore below 0', () => {
      expect(() => PrioritizedTaskSchema.parse({ ...validTask, priorityScore: -1 })).toThrow();
    });

    it('rejects rank below 1', () => {
      expect(() => PrioritizedTaskSchema.parse({ ...validTask, rank: 0 })).toThrow();
    });

    it('accepts all priority levels', () => {
      for (const p of ['low', 'medium', 'high', 'urgent']) {
        expect(PrioritizedTaskSchema.parse({ ...validTask, currentPriority: p }).currentPriority).toBe(p);
      }
    });

    it('rejects invalid priority level', () => {
      expect(() => PrioritizedTaskSchema.parse({ ...validTask, currentPriority: 'critical' })).toThrow();
    });

    it('rejects invalid factor impact', () => {
      expect(() => PrioritizedTaskSchema.parse({
        ...validTask,
        factors: [{ factor: 'x', impact: 'extreme', description: 'y' }],
      })).toThrow();
    });
  });
});

// ===================================================================
// TemplateSchemas
// ===================================================================

describe('TemplateSchemas', () => {
  describe('templateTaskSchema', () => {
    it('applies defaults for optional fields', () => {
      const result = templateTaskSchema.parse({ refId: 'T1', name: 'Task', estimatedDays: 5 });
      expect(result.description).toBe('');
      expect(result.priority).toBe('medium');
      expect(result.parentRefId).toBeNull();
      expect(result.dependencyRefId).toBeNull();
      expect(result.dependencyType).toBe('FS');
      expect(result.offsetDays).toBe(0);
      expect(result.skills).toEqual([]);
      expect(result.isSummary).toBe(false);
    });

    it('rejects estimatedDays below 1', () => {
      expect(() => templateTaskSchema.parse({ refId: 'T1', name: 'T', estimatedDays: 0 })).toThrow();
    });

    it('accepts all dependency types', () => {
      for (const dt of ['FS', 'SS', 'FF', 'SF']) {
        expect(templateTaskSchema.parse({ refId: 'T1', name: 'T', estimatedDays: 1, dependencyType: dt }).dependencyType).toBe(dt);
      }
    });

    it('rejects invalid dependency type', () => {
      expect(() => templateTaskSchema.parse({ refId: 'T1', name: 'T', estimatedDays: 1, dependencyType: 'XY' })).toThrow();
    });
  });

  describe('projectTemplateSchema', () => {
    it('accepts all project types', () => {
      for (const pt of ['it', 'construction', 'infrastructure', 'roads', 'other']) {
        const tmpl = {
          id: '1', name: 'T', description: 'D', projectType: pt, category: 'cat',
          estimatedDurationDays: 30, tasks: [],
        };
        expect(projectTemplateSchema.parse(tmpl).projectType).toBe(pt);
      }
    });

    it('rejects invalid project type', () => {
      expect(() => projectTemplateSchema.parse({
        id: '1', name: 'T', description: 'D', projectType: 'aerospace',
        category: 'cat', estimatedDurationDays: 30, tasks: [],
      })).toThrow();
    });
  });

  describe('createFromTemplateSchema', () => {
    it('rejects empty project name', () => {
      expect(() => createFromTemplateSchema.parse({ templateId: 't1', projectName: '', startDate: '2025-01-01' })).toThrow();
    });

    it('rejects negative budget', () => {
      expect(() => createFromTemplateSchema.parse({
        templateId: 't1', projectName: 'P', startDate: '2025-01-01', budget: -1000,
      })).toThrow();
    });

    it('rejects zero budget', () => {
      expect(() => createFromTemplateSchema.parse({
        templateId: 't1', projectName: 'P', startDate: '2025-01-01', budget: 0,
      })).toThrow();
    });

    it('accepts valid template request', () => {
      const result = createFromTemplateSchema.parse({
        templateId: 't1', projectName: 'New Project', startDate: '2025-03-01',
      });
      expect(result.priority).toBe('medium'); // default
    });
  });

  describe('saveAsTemplateSchema', () => {
    it('rejects empty template name', () => {
      expect(() => saveAsTemplateSchema.parse({ projectId: 'p1', templateName: '' })).toThrow();
    });

    it('applies default description', () => {
      const result = saveAsTemplateSchema.parse({ projectId: 'p1', templateName: 'My Template' });
      expect(result.description).toBe('');
    });
  });
});

// ===================================================================
// AutoRescheduleSchemas
// ===================================================================

describe('AutoRescheduleSchemas', () => {
  describe('DelayedTaskSchema', () => {
    it('rejects progress below 0', () => {
      expect(() => DelayedTaskSchema.parse({
        taskId: 't1', taskName: 'T', expectedEndDate: '2025-01-01',
        currentProgress: -5, estimatedEndDate: '2025-01-15', delayDays: 14,
        isOnCriticalPath: false, severity: 'low',
      })).toThrow();
    });

    it('rejects progress above 100', () => {
      expect(() => DelayedTaskSchema.parse({
        taskId: 't1', taskName: 'T', expectedEndDate: '2025-01-01',
        currentProgress: 101, estimatedEndDate: '2025-01-15', delayDays: 14,
        isOnCriticalPath: false, severity: 'low',
      })).toThrow();
    });

    it('accepts all severity levels', () => {
      for (const sev of ['low', 'medium', 'high', 'critical']) {
        const task = {
          taskId: 't1', taskName: 'T', expectedEndDate: '2025-01-01',
          currentProgress: 50, estimatedEndDate: '2025-01-15', delayDays: 14,
          isOnCriticalPath: false, severity: sev,
        };
        expect(DelayedTaskSchema.parse(task).severity).toBe(sev);
      }
    });
  });

  describe('RescheduleProposalSchema', () => {
    it('accepts all proposal statuses', () => {
      for (const status of ['pending', 'accepted', 'rejected', 'modified']) {
        const proposal = {
          id: '1', scheduleId: 's1', status, delayedTasks: [], proposedChanges: [],
          rationale: 'reason', estimatedImpact: {
            originalEndDate: '2025-01-01', proposedEndDate: '2025-01-15',
            daysChange: 14, criticalPathImpact: 'none',
          },
          createdAt: '2025-01-01',
        };
        expect(RescheduleProposalSchema.parse(proposal).status).toBe(status);
      }
    });

    it('accepts optional feedback field', () => {
      const proposal = {
        id: '1', scheduleId: 's1', status: 'rejected', delayedTasks: [], proposedChanges: [],
        rationale: 'reason', estimatedImpact: {
          originalEndDate: '2025-01-01', proposedEndDate: '2025-01-15',
          daysChange: 14, criticalPathImpact: 'none',
        },
        createdAt: '2025-01-01', feedback: 'Too aggressive',
      };
      expect(RescheduleProposalSchema.parse(proposal).feedback).toBe('Too aggressive');
    });
  });
});

// ===================================================================
// ResourceOptimizerSchemas
// ===================================================================

describe('ResourceOptimizerSchemas', () => {
  describe('BottleneckPredictionSchema', () => {
    it('accepts all severity levels', () => {
      for (const sev of ['warning', 'critical', 'severe']) {
        const pred = {
          resourceId: 'r1', resourceName: 'Jane', week: '2025-W05',
          utilization: 120, contributingTasks: [], severity: sev,
        };
        expect(BottleneckPredictionSchema.parse(pred).severity).toBe(sev);
      }
    });

    it('rejects invalid severity', () => {
      expect(() => BottleneckPredictionSchema.parse({
        resourceId: 'r1', resourceName: 'Jane', week: 'W05',
        utilization: 120, contributingTasks: [], severity: 'low',
      })).toThrow();
    });
  });

  describe('RebalanceSuggestionSchema', () => {
    it('accepts all suggestion types', () => {
      for (const type of ['reassign', 'delay', 'split', 'hire']) {
        const sug = { type, description: 'd', estimatedImpact: 'i', confidence: 80 };
        expect(RebalanceSuggestionSchema.parse(sug).type).toBe(type);
      }
    });

    it('rejects confidence above 100', () => {
      expect(() => RebalanceSuggestionSchema.parse({
        type: 'hire', description: 'd', estimatedImpact: 'i', confidence: 150,
      })).toThrow();
    });

    it('rejects confidence below 0', () => {
      expect(() => RebalanceSuggestionSchema.parse({
        type: 'hire', description: 'd', estimatedImpact: 'i', confidence: -1,
      })).toThrow();
    });
  });

  describe('SkillMatchSchema', () => {
    it('rejects matchScore above 100', () => {
      expect(() => SkillMatchSchema.parse({
        resourceId: 'r1', resourceName: 'Jane', matchScore: 101,
        matchedSkills: ['js'], availableCapacity: 20,
      })).toThrow();
    });

    it('accepts matchScore at boundary', () => {
      const result = SkillMatchSchema.parse({
        resourceId: 'r1', resourceName: 'Jane', matchScore: 0,
        matchedSkills: [], availableCapacity: 40,
      });
      expect(result.matchScore).toBe(0);
    });
  });

  describe('BurnoutRiskSchema', () => {
    it('accepts all risk levels', () => {
      for (const risk of ['low', 'medium', 'high', 'critical']) {
        const br = {
          resourceId: 'r1', resourceName: 'Jane',
          consecutiveOverloadWeeks: 3, averageUtilization: 110, riskLevel: risk,
        };
        expect(BurnoutRiskSchema.parse(br).riskLevel).toBe(risk);
      }
    });
  });
});

// ===================================================================
// EVMForecastSchemas
// ===================================================================

describe('EVMForecastSchemas', () => {
  describe('EVMCorrectiveActionSchema', () => {
    it('accepts all effort levels', () => {
      for (const effort of ['low', 'medium', 'high']) {
        expect(EVMCorrectiveActionSchema.parse({
          action: 'Review', effort, priority: 'medium', estimatedImpact: '5% CPI improvement',
        }).effort).toBe(effort);
      }
    });

    it('accepts all priority levels', () => {
      for (const priority of ['low', 'medium', 'high', 'critical']) {
        expect(EVMCorrectiveActionSchema.parse({
          action: 'Review', effort: 'low', priority, estimatedImpact: 'impact',
        }).priority).toBe(priority);
      }
    });
  });

  describe('EVMForecastAIResponseSchema', () => {
    it('rejects overrunProbability above 100', () => {
      expect(() => EVMForecastAIResponseSchema.parse({
        predictedCPI: [], predictedSPI: [], aiAdjustedEAC: 100000,
        eacConfidenceRange: { low: 90000, high: 110000 },
        trendDirection: 'stable', overrunProbability: 150,
        correctiveActions: [], narrativeSummary: 'test',
      })).toThrow();
    });

    it('accepts all trend directions', () => {
      for (const trend of ['improving', 'stable', 'deteriorating']) {
        const response = {
          predictedCPI: [], predictedSPI: [], aiAdjustedEAC: 100000,
          eacConfidenceRange: { low: 90000, high: 110000 },
          trendDirection: trend, overrunProbability: 50,
          correctiveActions: [], narrativeSummary: 'test',
        };
        expect(EVMForecastAIResponseSchema.parse(response).trendDirection).toBe(trend);
      }
    });
  });

  describe('EVMEarlyWarningSchema', () => {
    it('accepts all severity levels', () => {
      for (const sev of ['info', 'warning', 'critical']) {
        expect(EVMEarlyWarningSchema.parse({ type: 'cost', message: 'msg', severity: sev }).severity).toBe(sev);
      }
    });
  });

  describe('EVMCurrentMetricsSchema', () => {
    it('accepts valid metrics', () => {
      const metrics = { BAC: 100000, EV: 50000, AC: 55000, PV: 48000, CPI: 0.91, SPI: 1.04, EAC: 109890, ETC: 54890, VAC: -9890, TCPI: 1.1 };
      expect(EVMCurrentMetricsSchema.parse(metrics).CPI).toBe(0.91);
    });

    it('rejects missing fields', () => {
      expect(() => EVMCurrentMetricsSchema.parse({ BAC: 100000, EV: 50000 })).toThrow();
    });
  });
});

// ===================================================================
// LessonsLearnedSchemas
// ===================================================================

describe('LessonsLearnedSchemas', () => {
  describe('LessonLearnedSchema', () => {
    it('accepts all categories', () => {
      const categories = ['schedule', 'budget', 'resource', 'risk', 'technical', 'communication', 'stakeholder', 'quality'];
      for (const cat of categories) {
        const lesson = {
          id: '1', projectId: 'p1', projectName: 'P', projectType: 'it',
          category: cat, title: 'T', description: 'D', impact: 'positive',
          recommendation: 'R', confidence: 80, createdAt: '2025-01-01',
        };
        expect(LessonLearnedSchema.parse(lesson).category).toBe(cat);
      }
    });

    it('rejects invalid category', () => {
      expect(() => LessonLearnedSchema.parse({
        id: '1', projectId: 'p1', projectName: 'P', projectType: 'it',
        category: 'compliance', title: 'T', description: 'D', impact: 'positive',
        recommendation: 'R', confidence: 80, createdAt: '2025-01-01',
      })).toThrow();
    });

    it('accepts all impact types', () => {
      for (const impact of ['positive', 'negative', 'neutral']) {
        const lesson = {
          id: '1', projectId: 'p1', projectName: 'P', projectType: 'it',
          category: 'budget', title: 'T', description: 'D', impact,
          recommendation: 'R', confidence: 50, createdAt: '2025-01-01',
        };
        expect(LessonLearnedSchema.parse(lesson).impact).toBe(impact);
      }
    });

    it('rejects confidence above 100', () => {
      expect(() => LessonLearnedSchema.parse({
        id: '1', projectId: 'p1', projectName: 'P', projectType: 'it',
        category: 'budget', title: 'T', description: 'D', impact: 'positive',
        recommendation: 'R', confidence: 101, createdAt: '2025-01-01',
      })).toThrow();
    });
  });

  describe('PatternSchema', () => {
    it('rejects confidence below 0', () => {
      expect(() => PatternSchema.parse({
        id: '1', title: 'T', description: 'D', frequency: 5,
        projectTypes: ['it'], category: 'budget', recommendation: 'R', confidence: -1,
      })).toThrow();
    });
  });

  describe('MitigationSuggestionSchema', () => {
    it('rejects relevance above 100', () => {
      expect(() => MitigationSuggestionSchema.parse({
        source: 'Project X', relevance: 120, suggestion: 'Do this',
      })).toThrow();
    });

    it('accepts optional fields', () => {
      const result = MitigationSuggestionSchema.parse({
        source: 'P', relevance: 75, suggestion: 'S',
      });
      expect(result.lessonId).toBeUndefined();
      expect(result.historicalOutcome).toBeUndefined();
    });
  });
});

// ===================================================================
// MeetingSchemas
// ===================================================================

describe('MeetingSchemas', () => {
  describe('MeetingActionItemSchema', () => {
    it('accepts all priority levels', () => {
      for (const p of ['low', 'medium', 'high', 'urgent']) {
        expect(MeetingActionItemSchema.parse({
          description: 'Do X', assignee: 'John', priority: p,
        }).priority).toBe(p);
      }
    });

    it('accepts optional dueDate', () => {
      const result = MeetingActionItemSchema.parse({ description: 'Do X', assignee: 'John', priority: 'high' });
      expect(result.dueDate).toBeUndefined();
    });
  });

  describe('MeetingTaskUpdateSchema', () => {
    it('accepts all update types', () => {
      for (const type of ['create', 'update_status', 'reschedule']) {
        expect(MeetingTaskUpdateSchema.parse({ type, taskName: 'Task' }).type).toBe(type);
      }
    });

    it('accepts all task statuses', () => {
      for (const status of ['pending', 'in_progress', 'completed', 'cancelled']) {
        expect(MeetingTaskUpdateSchema.parse({
          type: 'update_status', taskName: 'T', newStatus: status,
        }).newStatus).toBe(status);
      }
    });

    it('rejects invalid update type', () => {
      expect(() => MeetingTaskUpdateSchema.parse({ type: 'delete', taskName: 'T' })).toThrow();
    });
  });

  describe('AnalyzeRequestSchema', () => {
    it('rejects transcript shorter than 10 chars', () => {
      expect(() => AnalyzeRequestSchema.parse({
        transcript: 'short', projectId: 'p1', scheduleId: 's1',
      })).toThrow();
    });

    it('accepts valid request', () => {
      const result = AnalyzeRequestSchema.parse({
        transcript: 'This is a meeting transcript that is long enough.',
        projectId: 'p1', scheduleId: 's1',
      });
      expect(result.projectId).toBe('p1');
    });
  });
});

// ===================================================================
// Phase5Schemas (Learning, Scenarios, Cross-Project, Anomalies)
// ===================================================================

describe('Phase5Schemas', () => {
  describe('AIFeedbackRecordSchema', () => {
    it('accepts all user actions', () => {
      for (const action of ['accepted', 'modified', 'rejected']) {
        expect(AIFeedbackRecordSchema.parse({ feature: 'risk', userAction: action }).userAction).toBe(action);
      }
    });

    it('rejects invalid user action', () => {
      expect(() => AIFeedbackRecordSchema.parse({ feature: 'risk', userAction: 'ignored' })).toThrow();
    });
  });

  describe('AIAccuracyRecordSchema', () => {
    it('accepts all metric types', () => {
      for (const mt of ['duration_estimate', 'cost_estimate', 'risk_prediction', 'dependency_accuracy']) {
        expect(AIAccuracyRecordSchema.parse({
          projectId: 'p1', metricType: mt, predictedValue: 10, actualValue: 12,
        }).metricType).toBe(mt);
      }
    });

    it('rejects invalid metric type', () => {
      expect(() => AIAccuracyRecordSchema.parse({
        projectId: 'p1', metricType: 'weather', predictedValue: 10, actualValue: 12,
      })).toThrow();
    });
  });

  describe('AIAccuracyReportSchema', () => {
    it('rejects accuracy above 100', () => {
      expect(() => AIAccuracyReportSchema.parse({
        overall: { totalRecords: 10, averageVariance: 5, accuracy: 150 },
        byMetric: [], byProjectType: [],
        feedbackSummary: { total: 0, accepted: 0, modified: 0, rejected: 0, acceptanceRate: 0 },
        improvements: [],
      })).toThrow();
    });
  });

  describe('AIAnomalySchema', () => {
    it('accepts all anomaly types', () => {
      const types = ['completion_drop', 'budget_spike', 'stale_project', 'task_rescheduling', 'budget_flatline'];
      for (const type of types) {
        const anomaly = {
          type, projectId: 'p1', projectName: 'P', severity: 'high',
          title: 'T', description: 'D', recommendation: 'R', detectedAt: '2025-01-01',
        };
        expect(AIAnomalySchema.parse(anomaly).type).toBe(type);
      }
    });

    it('rejects unknown anomaly type', () => {
      expect(() => AIAnomalySchema.parse({
        type: 'security_breach', projectId: 'p1', projectName: 'P', severity: 'high',
        title: 'T', description: 'D', recommendation: 'R', detectedAt: '2025-01-01',
      })).toThrow();
    });
  });

  describe('AIAnomalyReportSchema', () => {
    it('accepts all health trends', () => {
      for (const trend of ['improving', 'stable', 'deteriorating']) {
        const report = { anomalies: [], summary: 'S', overallHealthTrend: trend, scannedProjects: 5, aiPowered: true };
        expect(AIAnomalyReportSchema.parse(report).overallHealthTrend).toBe(trend);
      }
    });
  });

  describe('AIScenarioResultSchema', () => {
    it('rejects confidence above 1', () => {
      const base = {
        scheduleImpact: { originalDays: 90, projectedDays: 100, changePct: 11, explanation: 'e' },
        budgetImpact: { originalBudget: 100000, projectedBudget: 110000, changePct: 10, explanation: 'e' },
        resourceImpact: { currentWorkers: 5, projectedWorkers: 6, explanation: 'e' },
        riskImpact: { currentRiskScore: 30, projectedRiskScore: 45, newRisks: [], explanation: 'e' },
        affectedTasks: [], recommendations: [], confidence: 1.5,
      };
      expect(() => AIScenarioResultSchema.parse(base)).toThrow();
    });

    it('accepts confidence at boundary 0', () => {
      const base = {
        scheduleImpact: { originalDays: 90, projectedDays: 90, changePct: 0, explanation: 'e' },
        budgetImpact: { originalBudget: 100000, projectedBudget: 100000, changePct: 0, explanation: 'e' },
        resourceImpact: { currentWorkers: 5, projectedWorkers: 5, explanation: 'e' },
        riskImpact: { currentRiskScore: 30, projectedRiskScore: 30, newRisks: [], explanation: 'e' },
        affectedTasks: [], recommendations: [], confidence: 0,
      };
      expect(AIScenarioResultSchema.parse(base).confidence).toBe(0);
    });
  });
});

// ===================================================================
// PredictiveSchemas
// ===================================================================

describe('PredictiveSchemas', () => {
  describe('AIRiskItemSchema', () => {
    it('accepts all risk types', () => {
      const types = ['schedule', 'budget', 'resource', 'weather', 'regulatory', 'technical', 'stakeholder'];
      for (const type of types) {
        const item = { type, title: 'T', description: 'D', probability: 3, impact: 4, severity: 'high', mitigations: [] };
        expect(AIRiskItemSchema.parse(item).type).toBe(type);
      }
    });

    it('rejects probability below 1', () => {
      expect(() => AIRiskItemSchema.parse({
        type: 'budget', title: 'T', description: 'D', probability: 0, impact: 3, severity: 'low', mitigations: [],
      })).toThrow();
    });

    it('rejects probability above 5', () => {
      expect(() => AIRiskItemSchema.parse({
        type: 'budget', title: 'T', description: 'D', probability: 6, impact: 3, severity: 'low', mitigations: [],
      })).toThrow();
    });

    it('rejects impact below 1', () => {
      expect(() => AIRiskItemSchema.parse({
        type: 'budget', title: 'T', description: 'D', probability: 3, impact: 0, severity: 'low', mitigations: [],
      })).toThrow();
    });

    it('rejects impact above 5', () => {
      expect(() => AIRiskItemSchema.parse({
        type: 'budget', title: 'T', description: 'D', probability: 3, impact: 6, severity: 'low', mitigations: [],
      })).toThrow();
    });

    it('accepts boundary values 1 and 5', () => {
      const item = { type: 'budget', title: 'T', description: 'D', probability: 1, impact: 5, severity: 'critical', mitigations: ['m1'] };
      const parsed = AIRiskItemSchema.parse(item);
      expect(parsed.probability).toBe(1);
      expect(parsed.impact).toBe(5);
    });
  });

  describe('AIRiskAssessmentSchema', () => {
    it('rejects overallScore above 100', () => {
      expect(() => AIRiskAssessmentSchema.parse({
        overallScore: 101, overallSeverity: 'low', healthScore: 80, risks: [], summary: 'S',
      })).toThrow();
    });

    it('rejects healthScore below 0', () => {
      expect(() => AIRiskAssessmentSchema.parse({
        overallScore: 50, overallSeverity: 'low', healthScore: -1, risks: [], summary: 'S',
      })).toThrow();
    });

    it('applies default trend', () => {
      const result = AIRiskAssessmentSchema.parse({
        overallScore: 50, overallSeverity: 'medium', healthScore: 70, risks: [], summary: 'OK',
      });
      expect(result.trend).toBe('stable');
    });
  });

  describe('AIWeatherImpactSchema', () => {
    it('accepts all impact levels', () => {
      for (const level of ['none', 'low', 'moderate', 'high', 'severe']) {
        const impact = {
          currentCondition: 'Rain', impactLevel: level, estimatedDelayDays: 0,
          affectedTasks: [], weeklyOutlook: [], recommendations: [],
        };
        expect(AIWeatherImpactSchema.parse(impact).impactLevel).toBe(level);
      }
    });

    it('rejects negative delay days', () => {
      expect(() => AIWeatherImpactSchema.parse({
        currentCondition: 'Sun', impactLevel: 'none', estimatedDelayDays: -1,
        affectedTasks: [], weeklyOutlook: [], recommendations: [],
      })).toThrow();
    });
  });

  describe('AIBudgetForecastSchema', () => {
    it('rejects overrunProbability above 100', () => {
      expect(() => AIBudgetForecastSchema.parse({
        cpi: 0.9, spi: 1.0, eac: 110000, etc: 60000, vac: -10000,
        burnRateDaily: 1000, burnRateMonthly: 30000, overrunProbability: 150,
        projectedCompletionBudget: 110000, recommendations: [], summary: 'S',
      })).toThrow();
    });

    it('accepts valid forecast', () => {
      const result = AIBudgetForecastSchema.parse({
        cpi: 0.95, spi: 1.02, eac: 105000, etc: 55000, vac: -5000,
        burnRateDaily: 900, burnRateMonthly: 27000, overrunProbability: 35,
        projectedCompletionBudget: 105000, recommendations: ['Cut scope'], summary: 'OK',
      });
      expect(result.overrunProbability).toBe(35);
    });
  });
});
