import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { apiService } from '../../services/api';
import { SprintList } from '../../components/sprints/SprintList';
import { SprintPlanningPanel } from '../../components/sprints/SprintPlanningPanel';
import { SprintBoard } from '../../components/sprints/SprintBoard';
import { SprintBurndownChart } from '../../components/sprints/SprintBurndownChart';
import { CumulativeFlowChart } from '../../components/sprints/CumulativeFlowChart';
import { CapacityCard } from '../../components/sprints/CapacityCard';

export function SprintsTab({ projectId }: { projectId: string }) {
  const { data: schedulesData } = useQuery({
    queryKey: ['schedules', projectId],
    queryFn: () => apiService.getSchedules(projectId),
    enabled: !!projectId,
  });

  const schedules: any[] = schedulesData?.schedules || [];
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>();
  const [sprintView, setSprintView] = useState<'list' | 'planning' | 'board' | 'burndown' | 'flow' | 'capacity'>('list');
  const [retroData, setRetroData] = useState<{ markdown: string; sprintName: string } | null>(null);
  const [retroLoading, setRetroLoading] = useState(false);

  useEffect(() => {
    if (schedules.length > 0 && !selectedScheduleId) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId]);

  const handleRetro = async (sprintId: string) => {
    setRetroLoading(true);
    try {
      const res = await apiService.generateSprintRetrospective(sprintId);
      setRetroData({
        markdown: res.retrospective || 'AI retrospective unavailable. Please try again later.',
        sprintName: res.sprint?.name || 'Sprint',
      });
    } catch {
      setRetroData({ markdown: 'Failed to generate retrospective. Please try again.', sprintName: 'Sprint' });
    } finally {
      setRetroLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sprint Planning</h3>
        <div className="flex items-center gap-3">
          {schedules.length > 1 && (
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
            >
              {schedules.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {selectedSprintId && (
            <div className="flex gap-1">
              {(['list', 'planning', 'board', 'burndown', 'flow', 'capacity'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSprintView(v)}
                  className={`px-3 py-1 text-xs rounded-md capitalize ${sprintView === v ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {sprintView === 'list' && (
        <SprintList
          projectId={projectId}
          onSelect={(id) => { setSelectedSprintId(id); setSprintView('planning'); }}
          onCreate={() => { setSelectedSprintId(undefined); setSprintView('planning'); }}
          onRetro={handleRetro}
        />
      )}
      {sprintView === 'planning' && selectedScheduleId && (
        <SprintPlanningPanel
          projectId={projectId}
          scheduleId={selectedScheduleId}
          sprintId={selectedSprintId || ''}
        />
      )}
      {sprintView === 'board' && selectedSprintId && (
        <SprintBoard sprintId={selectedSprintId} />
      )}
      {sprintView === 'burndown' && selectedSprintId && (
        <SprintBurndownChart sprintId={selectedSprintId} />
      )}
      {sprintView === 'flow' && selectedSprintId && (
        <CumulativeFlowChart sprintId={selectedSprintId} />
      )}
      {sprintView === 'capacity' && selectedSprintId && (
        <CapacityCard sprintId={selectedSprintId} />
      )}

      {/* AI Retrospective Loading */}
      {retroLoading && (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-6 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-indigo-600 dark:text-indigo-400">Generating AI retrospective...</p>
        </div>
      )}

      {/* AI Retrospective Result */}
      {retroData && !retroLoading && (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                AI Retrospective — {retroData.sprintName}
              </h4>
            </div>
            <button
              onClick={() => setRetroData(null)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Dismiss
            </button>
          </div>
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {retroData.markdown}
          </div>
        </div>
      )}
    </div>
  );
}
