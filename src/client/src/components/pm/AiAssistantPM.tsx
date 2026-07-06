import { useQuery } from '@tanstack/react-query';
import { Bot, AlertTriangle, ArrowRight, CheckCircle2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

interface AiAssistantPMProps {
  projectId: string;
  projectName: string;
}

const SUGGESTED_ACTIONS = [
  {
    id: 'risks',
    label: 'Review open risks',
    icon: AlertTriangle,
    tab: 'risks',
  },
  {
    id: 'milestones',
    label: 'Check milestones',
    icon: CheckCircle2,
    tab: 'milestones',
  },
  {
    id: 'full',
    label: 'View full project',
    icon: Eye,
    to: null, // dynamic
  },
];

export function AiAssistantPM({ projectId, projectName }: AiAssistantPMProps) {
  const navigate = useNavigate();

  const { data: healthData, isLoading } = useQuery({
    queryKey: ['pm-project-health', projectId],
    queryFn: () => apiService.getProjectHealth(projectId),
    staleTime: 120_000,
    enabled: !!projectId,
  });

  const health = healthData?.data || healthData;
  const riskLevel: string = health?.riskLevel ?? health?.risk_level ?? '';
  const summary: string =
    health?.summary ??
    health?.narrative ??
    health?.description ??
    (isLoading ? '' : `${projectName} — health data is being analysed. Check back shortly for AI-driven insights.`);

  function handleAction(action: (typeof SUGGESTED_ACTIONS)[number]) {
    if (action.id === 'full') {
      navigate(`/project/${projectId}`);
    } else {
      // Navigate to PM detail with hash hint (tab handled by detail page state)
      navigate(`/project/${projectId}/pm#${action.tab}`);
    }
  }

  return (
    <div className="rounded-xl border border-teal-100 dark:border-teal-900/40 bg-gradient-to-br from-teal-50/60 via-white to-white dark:from-teal-950/20 dark:via-gray-800 dark:to-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Mjuzi AI</h3>
          {riskLevel && (
            <p className={`text-[10px] font-medium ${
              riskLevel.toLowerCase() === 'high' || riskLevel.toLowerCase() === 'critical'
                ? 'text-red-500'
                : riskLevel.toLowerCase() === 'medium'
                ? 'text-amber-500'
                : 'text-green-500'
            }`}>
              {riskLevel} risk
            </p>
          )}
        </div>
      </div>

      {/* AI summary */}
      {isLoading ? (
        <div className="space-y-2 mb-4">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/5" />
        </div>
      ) : (
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4 line-clamp-4">{summary}</p>
      )}

      {/* Suggested actions */}
      <div className="space-y-1.5 mb-3">
        {SUGGESTED_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAction(action)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-left"
            >
              <Icon className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
              <span className="text-xs text-gray-700 dark:text-gray-200 flex-1">{action.label}</span>
              <ArrowRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />
            </button>
          );
        })}
      </div>

      {/* Disabled chat input */}
      <div className="mt-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60">
          <Bot className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400 dark:text-gray-500">Ask about this project…</span>
        </div>
      </div>
    </div>
  );
}
