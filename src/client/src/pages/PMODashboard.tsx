import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { useFilterStore } from '../stores/filterStore';
import { useUIStore } from '../stores/uiStore';
import { PortfolioCard } from '../components/dashboard/PortfolioCard';
import { PMSummaryCard } from '../components/dashboard/PMSummaryCard';
import { Briefcase, ArrowLeft } from 'lucide-react';

/**
 * PMO Dashboard — used by pmo_manager and admin roles.
 *
 * Two views:
 * 1. Portfolio Cards (no portfolio selected) — shows all portfolios
 * 2. PM Summary Cards (portfolio selected via filter) — shows PMs in that portfolio
 *
 * Clicking a portfolio card sets the portfolio filter.
 * Clicking a PM card sets the PM filter and navigates to /projects.
 */
export const PMODashboard: React.FC = () => {
  const {
    selectedPortfolioId,
    selectedPmUserId,
    setPortfolioFilter,
    setPmFilter,
  } = useFilterStore();

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  // Portfolio summaries — when no portfolio selected
  const { data: portfolioData, isLoading: portfoliosLoading } = useQuery({
    queryKey: ['portfolio-summaries'],
    queryFn: () => apiService.getPortfolioSummaries(),
    enabled: !selectedPortfolioId,
  });

  // PM summaries — when portfolio selected
  const { data: pmData, isLoading: pmsLoading } = useQuery({
    queryKey: ['pm-summaries', selectedPortfolioId],
    queryFn: () => apiService.getPmSummaries(selectedPortfolioId),
    enabled: !!selectedPortfolioId,
  });

  const portfolios = portfolioData?.summaries || [];
  const pms = pmData?.summaries || [];

  // If a PM is selected, user will be on /projects page instead
  // This dashboard shows portfolios or PMs

  if (portfoliosLoading || pmsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  // PM Summary Cards view (portfolio selected)
  if (selectedPortfolioId) {
    const portfolioName = portfolios.find(
      (p: any) => p.portfolioId === selectedPortfolioId
    )?.portfolioName;

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setPortfolioFilter(null)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {portfolioName || 'Portfolio'} — PMs
            </h1>
            <p className="text-sm text-gray-500">{pms.length} project managers</p>
          </div>
        </div>

        {pms.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No PMs found in this portfolio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pms.map((pm: any) => (
              <PMSummaryCard
                key={pm.userId}
                {...pm}
                onClick={() => setPmFilter(pm.userId)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Portfolio Cards view (default)
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-sm text-gray-500">{portfolios.length} portfolios</p>
        </div>
      </div>

      {portfolios.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No portfolios found. An admin can create portfolios in the Admin page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {portfolios.map((portfolio: any) => (
            <PortfolioCard
              key={portfolio.portfolioId}
              {...portfolio}
              onClick={() => setPortfolioFilter(portfolio.portfolioId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
