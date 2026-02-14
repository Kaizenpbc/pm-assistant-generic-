/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock apiService BEFORE importing the page
// ---------------------------------------------------------------------------
const mockGetCrossProjectIntelligence = vi.fn();
const mockGetPortfolioAnomalies = vi.fn();
const mockGetAccuracyReport = vi.fn();

vi.mock('../../services/api', () => ({
  apiService: {
    getCrossProjectIntelligence: (...args: any[]) => mockGetCrossProjectIntelligence(...args),
    getPortfolioAnomalies: (...args: any[]) => mockGetPortfolioAnomalies(...args),
    getAccuracyReport: (...args: any[]) => mockGetAccuracyReport(...args),
  },
}));

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => ({
  Brain: (props: any) => <span data-testid="icon-brain" {...props} />,
  Activity: (props: any) => <span data-testid="icon-activity" {...props} />,
  AlertTriangle: (props: any) => <span data-testid="icon-alert" {...props} />,
  BarChart3: (props: any) => <span data-testid="icon-barchart" {...props} />,
  TrendingUp: (props: any) => <span data-testid="icon-trending-up" {...props} />,
  TrendingDown: (props: any) => <span data-testid="icon-trending-down" {...props} />,
  Minus: (props: any) => <span data-testid="icon-minus" {...props} />,
  Shield: (props: any) => <span data-testid="icon-shield" {...props} />,
  DollarSign: (props: any) => <span data-testid="icon-dollar" {...props} />,
  Zap: (props: any) => <span data-testid="icon-zap" {...props} />,
}));

import { ScenarioModelingPage } from '../ScenarioModelingPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderPage() {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ScenarioModelingPage />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const crossProjectData = {
  data: {
    resourceConflicts: [{ description: 'Dev shared across 3 projects', severity: 'high' }],
    portfolioRiskHeatMap: [
      { projectId: 'p1', projectName: 'Alpha', healthScore: 82, riskLevel: 'low', budgetUtilization: 65, progress: 55 },
      { projectId: 'p2', projectName: 'Beta', healthScore: 45, riskLevel: 'high', budgetUtilization: 110, progress: 30 },
      { projectId: 'p3', projectName: 'Gamma', healthScore: 60, riskLevel: 'medium', budgetUtilization: 80, progress: 70 },
    ],
    budgetReallocation: {
      surplusCandidates: [{ projectId: 'p1', projectName: 'Alpha', surplus: 50000 }],
      deficitCandidates: [{ projectId: 'p2', projectName: 'Beta', deficit: 30000 }],
      recommendations: ['Move $30k from Alpha to Beta'],
    },
    summary: 'Portfolio is generally healthy with one project at risk.',
  },
};

const anomalyData = {
  data: {
    anomalies: [
      { type: 'completion_drop', projectId: 'p2', projectName: 'Beta', severity: 'high', title: 'Progress dropped', description: 'Beta progress dropped by 15%', recommendation: 'Review resource allocation' },
      { type: 'budget_spike', projectId: 'p3', projectName: 'Gamma', severity: 'medium', title: 'Budget spike', description: 'Unexpected 20% budget increase', recommendation: 'Audit recent expenses' },
    ],
    summary: 'Two anomalies detected across portfolio.',
    overallHealthTrend: 'declining',
    scannedProjects: 5,
  },
};

const anomalyDataEmpty = {
  data: {
    anomalies: [],
    summary: 'No anomalies.',
    overallHealthTrend: 'stable',
    scannedProjects: 3,
  },
};

const accuracyData = {
  data: {
    overall: { totalRecords: 150, averageVariance: 12.5, accuracy: 87 },
    byMetric: { budget: { count: 50, accuracy: 90 }, schedule: { count: 100, accuracy: 85 } },
    feedbackSummary: { total: 40, accepted: 28, modified: 8, rejected: 4, acceptanceRate: 70 },
    improvements: ['Increase training data for budget predictions', 'Add seasonal factors'],
  },
};

// ---------------------------------------------------------------------------
// Tests: Page structure
// ---------------------------------------------------------------------------

describe('ScenarioModelingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page header', () => {
    it('renders the page title', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(screen.getByText('Intelligence & Scenarios')).toBeInTheDocument();
    });

    it('renders the page subtitle', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(screen.getByText(/Portfolio-level intelligence/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Portfolio Intelligence section
  // ---------------------------------------------------------------------------

  describe('PortfolioIntelligence', () => {
    it('shows loading spinner while fetching', () => {
      mockGetCrossProjectIntelligence.mockReturnValue(new Promise(() => {})); // never resolves
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      // Spinner is rendered — look for the animated div
      const spinners = document.querySelectorAll('.animate-spin');
      expect(spinners.length).toBeGreaterThanOrEqual(1);
    });

    it('shows error when fetch fails', async () => {
      mockGetCrossProjectIntelligence.mockRejectedValue(new Error('Network error'));
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Failed to load portfolio intelligence.')).toBeInTheDocument();
    });

    it('shows error when data is null', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue({ data: null });
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('No portfolio data available.')).toBeInTheDocument();
    });

    it('renders portfolio summary text', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Portfolio is generally healthy with one project at risk.')).toBeInTheDocument();
    });

    it('renders heat map with all projects', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      // Project names may appear in heat map AND budget reallocation sections
      expect((await screen.findAllByText('Alpha')).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Gamma').length).toBeGreaterThanOrEqual(1);
    });

    it('renders health scores with correct values', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('82')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('renders risk level badges', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('low')).toBeInTheDocument();
      // 'high' and 'medium' may appear in both heat map and anomaly sections
      expect(screen.getAllByText('high').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('medium').length).toBeGreaterThanOrEqual(1);
    });

    it('renders budget utilization percentages', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('65%')).toBeInTheDocument();
      expect(screen.getAllByText('110%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1);
    });

    it('renders surplus candidates', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Surplus Candidates')).toBeInTheDocument();
      expect(screen.getByText('+$50,000')).toBeInTheDocument();
    });

    it('renders deficit candidates', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Deficit Candidates')).toBeInTheDocument();
      expect(screen.getByText('-$30,000')).toBeInTheDocument();
    });

    it('renders budget recommendations', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Move $30k from Alpha to Beta')).toBeInTheDocument();
    });

    it('renders heat map section header', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Portfolio Risk Heat Map')).toBeInTheDocument();
    });

    it('handles empty heat map gracefully', async () => {
      const emptyData = {
        data: {
          resourceConflicts: [],
          portfolioRiskHeatMap: [],
          budgetReallocation: { surplusCandidates: [], deficitCandidates: [], recommendations: [] },
          summary: 'No data.',
        },
      };
      mockGetCrossProjectIntelligence.mockResolvedValue(emptyData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('No data.')).toBeInTheDocument();
      // No table rows for heat map
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Anomaly Detection section
  // ---------------------------------------------------------------------------

  describe('AnomalyDetection', () => {
    it('shows error when fetch fails', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockRejectedValue(new Error('fail'));
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Failed to load anomaly data.')).toBeInTheDocument();
    });

    it('shows error for null data', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue({ data: null });
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('No anomaly data available.')).toBeInTheDocument();
    });

    it('renders anomaly count badge', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('2 anomalies')).toBeInTheDocument();
    });

    it('renders singular "anomaly" for count=1', async () => {
      const singleAnomaly = {
        data: {
          anomalies: [anomalyData.data.anomalies[0]],
          summary: 'One issue.',
          overallHealthTrend: 'stable',
          scannedProjects: 2,
        },
      };
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(singleAnomaly);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('1 anomaly')).toBeInTheDocument();
    });

    it('renders scanned projects count', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Scanned 5 projects')).toBeInTheDocument();
    });

    it('renders anomaly titles', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Progress dropped')).toBeInTheDocument();
      expect(screen.getByText('Budget spike')).toBeInTheDocument();
    });

    it('renders anomaly descriptions', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Beta progress dropped by 15%')).toBeInTheDocument();
    });

    it('renders anomaly recommendations', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Review resource allocation')).toBeInTheDocument();
      expect(screen.getByText('Audit recent expenses')).toBeInTheDocument();
    });

    it('renders formatted anomaly type badges', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Completion Drop')).toBeInTheDocument();
      expect(screen.getByText('Budget Spike')).toBeInTheDocument();
    });

    it('renders health trend indicator', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('declining')).toBeInTheDocument();
    });

    it('shows healthy message for zero anomalies', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyDataEmpty);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('No anomalies detected. Portfolio looks healthy.')).toBeInTheDocument();
    });

    it('renders anomaly summary text', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Two anomalies detected across portfolio.')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // AI Accuracy section
  // ---------------------------------------------------------------------------

  describe('AIAccuracy', () => {
    it('shows error when fetch fails', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockRejectedValue(new Error('fail'));

      renderPage();
      expect(await screen.findByText('Failed to load accuracy data.')).toBeInTheDocument();
    });

    it('shows error for null data', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue({ data: null });

      renderPage();
      expect(await screen.findByText('No accuracy data available.')).toBeInTheDocument();
    });

    it('renders overall accuracy percentage', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('87%')).toBeInTheDocument();
    });

    it('renders total records count', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('150')).toBeInTheDocument();
    });

    it('renders average variance', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('12.5%')).toBeInTheDocument();
    });

    it('renders feedback summary counts', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      // Feedback labels and counts
      expect(await screen.findByText('Accepted')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('renders acceptance rate', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('70%')).toBeInTheDocument();
    });

    it('renders improvement suggestions', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Increase training data for budget predictions')).toBeInTheDocument();
      expect(screen.getByText('Add seasonal factors')).toBeInTheDocument();
    });

    it('renders Feedback Summary section header', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Feedback Summary')).toBeInTheDocument();
    });

    it('renders Improvement Suggestions header', async () => {
      mockGetCrossProjectIntelligence.mockResolvedValue(crossProjectData);
      mockGetPortfolioAnomalies.mockResolvedValue(anomalyData);
      mockGetAccuracyReport.mockResolvedValue(accuracyData);

      renderPage();
      expect(await screen.findByText('Improvement Suggestions')).toBeInTheDocument();
    });
  });
});
