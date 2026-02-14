import React from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useFilterStore } from '../../stores/filterStore';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';

interface PMSummary {
  userId: string;
  fullName: string;
  projectCount: number;
}

interface PortfolioSummary {
  portfolioId: string;
  portfolioName: string;
  projectCount: number;
}

const FilterBar: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const {
    selectedPortfolioId,
    selectedPmUserId,
    setPortfolioFilter,
    setPmFilter,
    clearFilters,
  } = useFilterStore();

  // Only show for portfolio_manager, pmo_manager, admin
  if (!user || user.role === 'pm') return null;

  const showPortfolioFilter = user.role === 'pmo_manager' || user.role === 'admin';
  const showPmFilter = user.role === 'portfolio_manager' || user.role === 'pmo_manager' || user.role === 'admin';

  const { data: portfolioData } = useQuery({
    queryKey: ['portfolio-summaries'],
    queryFn: () => apiService.getPortfolioSummaries(),
    enabled: showPortfolioFilter,
  });

  const { data: pmData } = useQuery({
    queryKey: ['pm-summaries', selectedPortfolioId],
    queryFn: () => apiService.getPmSummaries(selectedPortfolioId),
    enabled: showPmFilter,
  });

  const portfolios: PortfolioSummary[] = portfolioData?.summaries || [];
  const pms: PMSummary[] = pmData?.summaries || [];

  const hasFilters = selectedPortfolioId || selectedPmUserId;

  // Build breadcrumb
  const breadcrumbs: string[] = [];
  if (showPortfolioFilter) {
    breadcrumbs.push(selectedPortfolioId
      ? portfolios.find(p => p.portfolioId === selectedPortfolioId)?.portfolioName || 'Portfolio'
      : 'All Portfolios');
  }
  if (selectedPmUserId) {
    breadcrumbs.push(pms.find(p => p.userId === selectedPmUserId)?.fullName || 'PM');
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 text-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-gray-500 text-xs mr-2">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3 h-3" />}
            <span className={i === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Portfolio Dropdown */}
      {showPortfolioFilter && (
        <select
          value={selectedPortfolioId || ''}
          onChange={(e) => setPortfolioFilter(e.target.value || null)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Portfolios</option>
          {portfolios.map((p) => (
            <option key={p.portfolioId} value={p.portfolioId}>
              {p.portfolioName} ({p.projectCount})
            </option>
          ))}
        </select>
      )}

      {/* PM Dropdown */}
      {showPmFilter && (
        <select
          value={selectedPmUserId || ''}
          onChange={(e) => setPmFilter(e.target.value || null)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All PMs</option>
          {pms.map((pm) => (
            <option key={pm.userId} value={pm.userId}>
              {pm.fullName} ({pm.projectCount})
            </option>
          ))}
        </select>
      )}

      {/* Clear button */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );
};

export default FilterBar;
