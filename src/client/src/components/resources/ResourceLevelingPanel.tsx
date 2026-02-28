import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import {
  BarChart3,
  Wand2,
  Check,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { ResourceHistogram } from './ResourceHistogram';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResourceLevelingPanelProps {
  projectId: string;
  scheduleId: string;
}

interface ResourceDemand {
  date: string;
  hours: number;
}

interface ResourceEntry {
  resourceName: string;
  demand: ResourceDemand[];
}

interface OverAllocation {
  resourceName: string;
  date: string;
  demand: number;
  capacity: number;
}

interface HistogramData {
  resources: ResourceEntry[];
  overAllocations: OverAllocation[];
}

interface LevelingAdjustment {
  taskId: string;
  taskName: string;
  originalStart: string;
  originalEnd: string;
  newStart: string;
  newEnd: string;
  reason: string;
}

interface LevelingResult {
  histogram: HistogramData;
  adjustments: LevelingAdjustment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResourceLevelingPanel({
  projectId: _projectId,
  scheduleId,
}: ResourceLevelingPanelProps) {
  const [activeView, setActiveView] = useState<'before' | 'after'>('before');
  const [levelingResult, setLevelingResult] = useState<LevelingResult | null>(
    null
  );
  const [applied, setApplied] = useState(false);

  // Fetch original histogram data
  const {
    data: histogramData,
    isLoading: histogramLoading,
    isError: histogramError,
  } = useQuery<HistogramData>({
    queryKey: ['resourceHistogram', scheduleId],
    queryFn: () => apiService.getResourceHistogram(scheduleId),
  });

  // Level resources mutation
  const levelMutation = useMutation({
    mutationFn: () => apiService.levelResources(scheduleId),
    onSuccess: (data: LevelingResult) => {
      setLevelingResult(data);
      setActiveView('after');
    },
  });

  // Apply leveling mutation
  const applyMutation = useMutation({
    mutationFn: (adjustments: LevelingAdjustment[]) =>
      apiService.applyResourceLeveling(scheduleId, adjustments),
    onSuccess: () => {
      setApplied(true);
    },
  });

  const hasOverAllocations =
    histogramData && histogramData.overAllocations.length > 0;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Resource Leveling
              </h2>
              <p className="text-xs text-gray-500">
                Analyze resource demand and resolve over-allocations
              </p>
            </div>
          </div>

          {/* Level Resources button */}
          {!applied && (
            <button
              onClick={() => levelMutation.mutate()}
              disabled={
                levelMutation.isPending ||
                histogramLoading ||
                !hasOverAllocations
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {levelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Leveling...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Level Resources
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {histogramLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" />
          <span className="text-sm text-gray-500">
            Loading resource histogram...
          </span>
        </div>
      )}

      {/* Error state */}
      {histogramError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to load resource histogram data. Please try again later.
        </div>
      )}

      {/* Leveling error */}
      {levelMutation.isError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to level resources. Please try again.
        </div>
      )}

      {/* No over-allocations message */}
      {histogramData && !hasOverAllocations && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          All resources are within capacity. No leveling needed.
        </div>
      )}

      {/* Before / After toggle */}
      {histogramData && levelingResult && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveView('before')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === 'before'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Before
          </button>
          <button
            onClick={() => setActiveView('after')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === 'after'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            After
          </button>
        </div>
      )}

      {/* Histogram chart */}
      {histogramData && (
        <ResourceHistogram
          data={
            activeView === 'after' && levelingResult
              ? levelingResult.histogram
              : histogramData
          }
        />
      )}

      {/* Adjustments table */}
      {levelingResult && levelingResult.adjustments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800">
              Proposed Adjustments
            </h3>
            <span className="text-[10px] text-gray-400">
              {levelingResult.adjustments.length} task
              {levelingResult.adjustments.length !== 1 ? 's' : ''} affected
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                  <th className="text-left px-3 py-2 font-semibold">
                    Task Name
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Original Start
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Original End
                  </th>
                  <th className="text-center px-3 py-2 font-semibold" />
                  <th className="text-left px-3 py-2 font-semibold">
                    New Start
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    New End
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {levelingResult.adjustments.map((adj) => (
                  <tr
                    key={adj.taskId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                      {adj.taskName}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {formatDate(adj.originalStart)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {formatDate(adj.originalEnd)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 inline-block" />
                    </td>
                    <td className="px-3 py-2 text-indigo-600 font-medium whitespace-nowrap">
                      {formatDate(adj.newStart)}
                    </td>
                    <td className="px-3 py-2 text-indigo-600 font-medium whitespace-nowrap">
                      {formatDate(adj.newEnd)}
                    </td>
                    <td
                      className="px-3 py-2 text-gray-500 max-w-[180px] truncate"
                      title={adj.reason}
                    >
                      {adj.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Apply button */}
          {!applied && (
            <div className="flex justify-end mt-4">
              <button
                onClick={() =>
                  applyMutation.mutate(levelingResult.adjustments)
                }
                disabled={applyMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply Leveling
                  </>
                )}
              </button>
            </div>
          )}

          {/* Apply error */}
          {applyMutation.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mt-4">
              Failed to apply leveling changes. Please try again.
            </div>
          )}

          {/* Applied success */}
          {applied && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center gap-2 mt-4">
              <Check className="w-4 h-4" />
              Leveling changes have been applied to the schedule.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
