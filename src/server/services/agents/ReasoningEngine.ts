// Re-export all types so existing callers can continue to import from this file
export type {
  RecoveryOption, RecoveryAction, RecoveryPlan, DelayContext, ReasoningInput,
  ScopeAnalysisInput, ScopeAnalysisResult,
  BudgetAnalysisInput, BudgetAnalysisResult,
  ResourceAnalysisInput, ResourceAnalysisResult,
  PortfolioAnalysisInput, PortfolioAnalysisResult,
  RiskEscalationInput, RiskEscalationResult,
  StakeholderReportInput, StakeholderReportResult,
  HygieneAnalysisInput, HygieneAnalysisResult,
  DependencyAnalysisInput, DependencyAnalysisResult,
  LessonsExtractionInput, LessonsExtractionResult,
  PredictiveAlertInput, PredictiveAlertResult,
} from './reasoning/types';

import {
  generateRecoveryPlanImpl,
  generateScopeAnalysisImpl,
  generateBudgetAnalysisImpl,
  generateResourceAnalysisImpl,
  generateDependencyAnalysisImpl,
  generateHygieneAnalysisImpl,
  generateLessonsExtractionImpl,
  generatePredictiveAlertImpl,
  generateStakeholderReportImpl,
  generatePortfolioAnalysisImpl,
  generateRiskEscalationImpl,
} from './reasoning/generators';

import type {
  ReasoningInput, RecoveryPlan,
  ScopeAnalysisInput, ScopeAnalysisResult,
  BudgetAnalysisInput, BudgetAnalysisResult,
  ResourceAnalysisInput, ResourceAnalysisResult,
  PortfolioAnalysisInput, PortfolioAnalysisResult,
  RiskEscalationInput, RiskEscalationResult,
  StakeholderReportInput, StakeholderReportResult,
  HygieneAnalysisInput, HygieneAnalysisResult,
  DependencyAnalysisInput, DependencyAnalysisResult,
  LessonsExtractionInput, LessonsExtractionResult,
  PredictiveAlertInput, PredictiveAlertResult,
} from './reasoning/types';

export class ReasoningEngine {
  async generateRecoveryPlan(input: ReasoningInput): Promise<RecoveryPlan | null> {
    return generateRecoveryPlanImpl(input);
  }

  async generateScopeAnalysis(input: ScopeAnalysisInput): Promise<ScopeAnalysisResult | null> {
    return generateScopeAnalysisImpl(input);
  }

  async generateBudgetAnalysis(input: BudgetAnalysisInput): Promise<BudgetAnalysisResult | null> {
    return generateBudgetAnalysisImpl(input);
  }

  async generateResourceAnalysis(input: ResourceAnalysisInput): Promise<ResourceAnalysisResult | null> {
    return generateResourceAnalysisImpl(input);
  }

  async generatePortfolioAnalysis(input: PortfolioAnalysisInput): Promise<PortfolioAnalysisResult | null> {
    return generatePortfolioAnalysisImpl(input);
  }

  async generateRiskEscalation(input: RiskEscalationInput): Promise<RiskEscalationResult | null> {
    return generateRiskEscalationImpl(input);
  }

  async generateStakeholderReport(input: StakeholderReportInput): Promise<StakeholderReportResult | null> {
    return generateStakeholderReportImpl(input);
  }

  async generateHygieneAnalysis(input: HygieneAnalysisInput): Promise<HygieneAnalysisResult | null> {
    return generateHygieneAnalysisImpl(input);
  }

  async generateDependencyAnalysis(input: DependencyAnalysisInput): Promise<DependencyAnalysisResult | null> {
    return generateDependencyAnalysisImpl(input);
  }

  async generateLessonsExtraction(input: LessonsExtractionInput): Promise<LessonsExtractionResult | null> {
    return generateLessonsExtractionImpl(input);
  }

  async generatePredictiveAlert(input: PredictiveAlertInput): Promise<PredictiveAlertResult | null> {
    return generatePredictiveAlertImpl(input);
  }
}

export const reasoningEngine = new ReasoningEngine();
