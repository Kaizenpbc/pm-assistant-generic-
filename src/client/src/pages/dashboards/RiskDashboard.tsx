import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, AlertTriangle, FolderKanban, Bot } from 'lucide-react';
import { apiService } from '../../services/api';
import { AISummaryBanner } from '../../components/dashboard/AISummaryBanner';
import { CustomizeDropdown } from '../../components/dashboard/CustomizeDropdown';
import { WidgetGrid } from '../../components/dashboard/WidgetGrid';
import { RISK_WIDGETS, loadWidgetIds, saveWidgetIds, loadWidgetOrder, saveWidgetOrder } from '../../components/dashboard/WidgetRegistry';
import { AgentProposalsWidget } from '../../components/dashboard/widgets/AgentProposalsWidget';
import { PrioritiesStripWidget } from '../../components/dashboard/widgets/PrioritiesStripWidget';

const STORAGE_KEY = 'dashboard-widgets:risk';

export function RiskDashboard() {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => loadWidgetIds(STORAGE_KEY, RISK_WIDGETS));
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => loadWidgetOrder(STORAGE_KEY, RISK_WIDGETS));

  useEffect(() => { saveWidgetIds(STORAGE_KEY, enabledIds); }, [enabledIds]);
  useEffect(() => { saveWidgetOrder(STORAGE_KEY, widgetOrder); }, [widgetOrder]);

  const toggleWidget = useCallback((id: string) => {
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });

  const { data: proposalsData } = useQuery({
    queryKey: ['agent-proposals-risk-count'],
    queryFn: () => apiService.getAgentProposals({ status: 'pending', limit: 100 }),
    staleTime: 30000,
  });

  const projects = (projectsData?.data || projectsData?.projects || []) as any[];
  const allProposals = proposalsData?.data || proposalsData?.proposals || [];
  const riskAgentIds = ['monte-carlo-v1', 'risk-escalation-v1', 'predictive-alerting-v1', 'dependency-risk-v1'];
  const pendingRiskProposals = allProposals.filter((p: any) => riskAgentIds.includes(p.agent_id));

  // Risk stats from projects
  const activeProjects = projects.filter((p: any) => p.status === 'active');
  const projectsWithRisks = projects.filter((p: any) => (p.riskCount || 0) > 0);
  const totalRisks = projects.reduce((sum: number, p: any) => sum + (p.riskCount || 0), 0);
  const criticalRisks = projects.reduce((sum: number, p: any) => sum + (p.criticalRiskCount || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const renderWidget = (id: string) => {
    switch (id) {
      case 'ai-summary':
        return <AISummaryBanner />;
      case 'stats':
        return (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard label="Total Risks" value={String(totalRisks)} icon={ShieldAlert} color="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
            <StatsCard label="Critical Risks" value={String(criticalRisks)} icon={AlertTriangle} color="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" />
            <StatsCard label="Pending Proposals" value={String(pendingRiskProposals.length)} icon={Bot} color="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" />
            <StatsCard label="Active Projects" value={String(activeProjects.length)} icon={FolderKanban} color="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400" />
          </div>
        );
      case 'priorities':
        return <PrioritiesStripWidget />;
      case 'agent-proposals':
        return <AgentProposalsWidget agentIds={riskAgentIds} />;
      case 'risk-table':
        return (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Risk Summary</h2>
            {projectsWithRisks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No project risks recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Risks</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Critical</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {projectsWithRisks.map((p: any) => {
                      const critical = p.criticalRiskCount || 0;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{p.riskCount || 0}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{critical}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              critical > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {critical > 0 ? 'Critical' : 'Monitoring'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Risk Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor risks, agent escalations, and mitigation proposals.
          </p>
        </div>
        <CustomizeDropdown
          widgets={RISK_WIDGETS}
          enabledIds={enabledIds}
          onToggle={toggleWidget}
        />
      </div>

      <WidgetGrid
        widgets={RISK_WIDGETS}
        enabledIds={enabledIds}
        widgetOrder={widgetOrder}
        onReorder={setWidgetOrder}
        renderWidget={renderWidget}
      />
    </div>
  );
}

function StatsCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
