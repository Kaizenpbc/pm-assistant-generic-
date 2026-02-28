import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, BarChart3 } from 'lucide-react';
import { apiService } from '../services/api';
import { TimesheetGrid } from '../components/timetracking/TimesheetGrid';
import { ActualVsEstimatedChart } from '../components/timetracking/ActualVsEstimatedChart';

type Tab = 'my-timesheet' | 'project-summary';

export function TimesheetPage() {
  const [tab, setTab] = useState<Tab>('my-timesheet');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });
  const projects: any[] = projectsData?.projects || [];

  const { data: schedulesData } = useQuery({
    queryKey: ['schedules', selectedProjectId],
    queryFn: () => apiService.getSchedules(selectedProjectId),
    enabled: !!selectedProjectId,
  });
  const schedules: any[] = schedulesData?.schedules || [];

  const { data: comparisonData } = useQuery({
    queryKey: ['actual-vs-estimated', selectedScheduleId],
    queryFn: () => apiService.getActualVsEstimated(selectedScheduleId),
    enabled: !!selectedScheduleId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Timesheets</h1>
        <p className="text-sm text-gray-500 mt-1">Track time and compare against estimates</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('my-timesheet')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors
            ${tab === 'my-timesheet' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Clock className="w-4 h-4" /> My Timesheet
        </button>
        <button
          onClick={() => setTab('project-summary')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors
            ${tab === 'project-summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <BarChart3 className="w-4 h-4" /> Project Summary
        </button>
      </div>

      {tab === 'my-timesheet' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <TimesheetGrid />
        </div>
      )}

      {tab === 'project-summary' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <select
              value={selectedProjectId}
              onChange={(e) => { setSelectedProjectId(e.target.value); setSelectedScheduleId(''); }}
              className="input text-sm"
            >
              <option value="">Select a project...</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedProjectId && (
              <select
                value={selectedScheduleId}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                className="input text-sm"
              >
                <option value="">Select a schedule...</option>
                {schedules.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          {selectedScheduleId && comparisonData?.tasks && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Actual vs Estimated Hours</h3>
              <ActualVsEstimatedChart tasks={comparisonData.tasks} />
            </div>
          )}

          {!selectedScheduleId && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              Select a project and schedule to view time comparison
            </div>
          )}
        </div>
      )}
    </div>
  );
}
