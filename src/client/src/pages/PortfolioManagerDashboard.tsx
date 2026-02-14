import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { useFilterStore } from '../stores/filterStore';
import { useUIStore } from '../stores/uiStore';
import { PMSummaryCard } from '../components/dashboard/PMSummaryCard';
import { Users } from 'lucide-react';

/**
 * Portfolio Manager Dashboard — shows PM Summary Cards.
 * Clicking a PM card sets the PM filter so /projects shows that PM's projects.
 */
export const PortfolioManagerDashboard: React.FC = () => {
  const { selectedPortfolioId, setPmFilter } = useFilterStore();

  useEffect(() => {
    useUIStore.getState().setAIPanelContext({ type: 'dashboard' });
  }, []);

  const { data: pmData, isLoading } = useQuery({
    queryKey: ['pm-summaries', selectedPortfolioId],
    queryFn: () => apiService.getPmSummaries(selectedPortfolioId),
  });

  const pms = pmData?.summaries || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Users className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My PMs</h1>
          <p className="text-base text-gray-500">{pms.length} project managers in your portfolios</p>
        </div>
      </div>

      {pms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No PMs found in your portfolios.</p>
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
};
