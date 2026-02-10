import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mic,
  ChevronDown,
  Clock,
  FileText,
  Send,
} from 'lucide-react';
import { apiService } from '../services/api';
import { MeetingResultPanel } from '../components/meeting/MeetingResultPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
}

interface Schedule {
  id: string;
  name: string;
}

interface HistoryEntry {
  id: string;
  summary: string;
  createdAt: string;
  projectId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MeetingMinutesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Form state
  const [transcript, setTranscript] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');

  // Analysis result
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // ---- Queries ----

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
  });

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', selectedProjectId],
    queryFn: () => apiService.getSchedules(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const { data: historyData } = useQuery({
    queryKey: ['meetingHistory', selectedProjectId],
    queryFn: () => (apiService as any).getMeetingHistory(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const projects: Project[] = projectsData?.projects || [];
  const schedules: Schedule[] = schedulesData?.schedules || [];
  const history: HistoryEntry[] = historyData?.history || historyData?.analyses || [];

  // ---- Mutations ----

  const analyzeMutation = useMutation({
    mutationFn: () =>
      (apiService as any).analyzeMeetingTranscript({
        transcript,
        projectId: selectedProjectId,
        scheduleId: selectedScheduleId,
      }),
    onSuccess: (data: any) => {
      setAnalysisResult(data?.analysis || data);
      queryClient.invalidateQueries({ queryKey: ['meetingHistory', selectedProjectId] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (selectedIndices: number[]) =>
      (apiService as any).applyMeetingChanges(
        analysisResult?.id || analysisResult?.analysisId,
        selectedIndices
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingHistory', selectedProjectId] });
    },
  });

  const handleProjectChange = (pid: string) => {
    setSelectedProjectId(pid);
    setSelectedScheduleId('');
  };

  const handleAnalyze = () => {
    if (!transcript.trim()) return;
    analyzeMutation.mutate();
  };

  const handleApply = (indices: number[]) => {
    applyMutation.mutate(indices);
  };

  const handleHistoryClick = (entry: HistoryEntry) => {
    // Load the analysis from history into the result panel
    setAnalysisResult(entry);
  };

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mic className="w-6 h-6 text-indigo-500" />
            Meeting Minutes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste a meeting transcript and let AI extract action items, decisions, risks, and task updates.
          </p>
        </div>

        {/* Input card */}
        <div className="card space-y-4">
          {/* Transcript textarea */}
          <div>
            <label
              htmlFor="transcript"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Meeting Transcript
            </label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your meeting notes or transcript here..."
              className="input w-full resize-y"
              style={{ minHeight: '200px' }}
              rows={8}
            />
          </div>

          {/* Selectors row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Project selector */}
            <div>
              <label
                htmlFor="meeting-project"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Project
              </label>
              <div className="relative">
                <select
                  id="meeting-project"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="input w-full appearance-none pr-8"
                  disabled={projectsLoading}
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Schedule selector */}
            <div>
              <label
                htmlFor="meeting-schedule"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Schedule
              </label>
              <div className="relative">
                <select
                  id="meeting-schedule"
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="input w-full appearance-none pr-8"
                  disabled={!selectedProjectId || schedulesLoading}
                >
                  <option value="">
                    {!selectedProjectId
                      ? 'Select a project first'
                      : schedulesLoading
                        ? 'Loading...'
                        : 'Select a schedule...'}
                  </option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Analyze button */}
            <div className="flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={!transcript.trim() || analyzeMutation.isPending}
                className="btn btn-primary flex items-center gap-2 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Analyze
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {analyzeMutation.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Failed to analyze transcript. Please try again.
            </div>
          )}
        </div>

        {/* Results */}
        {analysisResult && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              Analysis Results
            </h2>
            <MeetingResultPanel
              analysis={analysisResult}
              onApply={handleApply}
              isApplying={applyMutation.isPending}
            />

            {/* Apply success/error feedback */}
            {applyMutation.isSuccess && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                Changes applied successfully.
              </div>
            )}
            {applyMutation.isError && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                Failed to apply changes. Please try again.
              </div>
            )}
          </div>
        )}
      </div>

      {/* History sidebar */}
      <div className="w-72 flex-shrink-0 hidden lg:block">
        <div className="card sticky top-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Analysis History
          </h2>

          {!selectedProjectId ? (
            <p className="text-xs text-gray-400 italic">Select a project to see history.</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No previous analyses.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleHistoryClick(entry)}
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:bg-gray-50 hover:shadow-sm transition-all"
                >
                  <p className="text-xs font-medium text-gray-900 line-clamp-2">
                    {entry.summary || 'Meeting analysis'}
                  </p>
                  {entry.createdAt && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(entry.createdAt)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
