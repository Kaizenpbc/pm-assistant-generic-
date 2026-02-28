import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { X, AlertTriangle, Loader2, CheckCircle2, XCircle, Pencil, Flag } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutoReschedulePanelProps {
  scheduleId: string;
  onClose: () => void;
}

interface Delay {
  taskId: string;
  taskName: string;
  delayDays: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  isCriticalPath: boolean;
}

interface TaskChange {
  taskId: string;
  taskName: string;
  currentStart: string;
  currentEnd: string;
  proposedStart: string;
  proposedEnd: string;
  reason: string;
}

interface EstimatedImpact {
  originalEndDate: string;
  proposedEndDate: string;
  daysChange: number;
}

interface Proposal {
  id: string;
  changes: TaskChange[];
  rationale: string;
  estimatedImpact: EstimatedImpact;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const severityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { bg: 'bg-green-100', text: 'text-green-700' },
};

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

function dateMoved(current: string, proposed: string): 'later' | 'earlier' | 'same' {
  if (!current || !proposed) return 'same';
  const c = new Date(current).getTime();
  const p = new Date(proposed).getTime();
  if (p > c) return 'later';
  if (p < c) return 'earlier';
  return 'same';
}

function dateTextClass(direction: 'later' | 'earlier' | 'same'): string {
  if (direction === 'later') return 'text-red-600 font-medium';
  if (direction === 'earlier') return 'text-green-600 font-medium';
  return 'text-gray-400';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutoReschedulePanel({ scheduleId, onClose }: AutoReschedulePanelProps) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [showRejectFeedback, setShowRejectFeedback] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedChanges, setModifiedChanges] = useState<Record<string, { proposedStart: string; proposedEnd: string }>>({});

  // Fetch detected delays
  const {
    data: delaysData,
    isLoading: delaysLoading,
    isError: delaysError,
  } = useQuery({
    queryKey: ['autoRescheduleDelays', scheduleId],
    queryFn: () => apiService.getDelays(scheduleId),
  });

  const delays: Delay[] = delaysData?.delays || [];

  // Generate proposal mutation
  const generateMutation = useMutation({
    mutationFn: () => apiService.generateRescheduleProposal(scheduleId),
    onSuccess: (data) => {
      setProposal(data.proposal || data);
    },
  });

  // Accept proposal mutation
  const acceptMutation = useMutation({
    mutationFn: (proposalId: string) => apiService.acceptRescheduleProposal(proposalId),
    onSuccess: () => {
      setAccepted(true);
    },
  });

  // Reject proposal mutation
  const rejectMutation = useMutation({
    mutationFn: ({ proposalId, feedback }: { proposalId: string; feedback?: string }) =>
      apiService.rejectRescheduleProposal(proposalId, feedback),
    onSuccess: () => {
      setRejected(true);
      setShowRejectFeedback(false);
    },
  });

  // Modify proposal mutation
  const modifyMutation = useMutation({
    mutationFn: ({ proposalId, modifications }: { proposalId: string; modifications: any[] }) =>
      apiService.modifyRescheduleProposal(proposalId, modifications),
    onSuccess: (data) => {
      setProposal(data.proposal || data);
      setIsModifying(false);
      setModifiedChanges({});
    },
  });

  const handleAccept = () => {
    if (proposal) {
      acceptMutation.mutate(proposal.id);
    }
  };

  const handleReject = () => {
    if (proposal) {
      rejectMutation.mutate({ proposalId: proposal.id, feedback: rejectFeedback || undefined });
    }
  };

  const handleStartModify = () => {
    if (!proposal) return;
    // Initialize modified changes with current proposed values
    const initial: Record<string, { proposedStart: string; proposedEnd: string }> = {};
    for (const change of proposal.changes) {
      initial[change.taskId] = {
        proposedStart: change.proposedStart,
        proposedEnd: change.proposedEnd,
      };
    }
    setModifiedChanges(initial);
    setIsModifying(true);
  };

  const handleModifyDateChange = (taskId: string, field: 'proposedStart' | 'proposedEnd', value: string) => {
    setModifiedChanges((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value },
    }));
  };

  const handleSaveModifications = () => {
    if (!proposal) return;
    const modifications = Object.entries(modifiedChanges).map(([taskId, dates]) => ({
      taskId,
      proposedStart: dates.proposedStart,
      proposedEnd: dates.proposedEnd,
    }));
    modifyMutation.mutate({ proposalId: proposal.id, modifications });
  };

  const handleCancelModify = () => {
    setIsModifying(false);
    setModifiedChanges({});
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-in panel from right */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">AI Auto-Reschedule</h2>
              <p className="text-xs text-gray-500">Detect delays and generate optimized schedule proposals</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* --- Detected Delays Section --- */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Detected Delays</h3>

            {delaysLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" />
                <span className="text-sm text-gray-500">Analyzing schedule for delays...</span>
              </div>
            )}

            {delaysError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                Failed to detect delays. Please try again later.
              </div>
            )}

            {!delaysLoading && !delaysError && delays.length === 0 && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                No delays detected. Schedule is on track.
              </div>
            )}

            {!delaysLoading && delays.length > 0 && (
              <div className="space-y-2">
                {delays.map((delay) => {
                  const colors = severityColors[delay.severity] || severityColors.low;
                  return (
                    <div
                      key={delay.taskId}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {delay.taskName}
                          </span>
                          {delay.isCriticalPath && (
                            <Flag className="w-3.5 h-3.5 text-red-500 flex-shrink-0" aria-label="Critical path" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{delay.reason}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-600 whitespace-nowrap">
                        -{delay.delayDays}d
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors.bg} ${colors.text}`}
                      >
                        {delay.severity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* --- Generate Button --- */}
          {!proposal && !accepted && !rejected && (
            <div className="flex justify-center">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || delays.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Proposal...
                  </>
                ) : (
                  'Generate Proposal'
                )}
              </button>
            </div>
          )}

          {generateMutation.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              Failed to generate proposal. Please try again.
            </div>
          )}

          {/* --- Proposal Section --- */}
          {proposal && (
            <>
              {/* Diff Table */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Proposed Changes</h3>
                  {isModifying && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelModify}
                        className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveModifications}
                        disabled={modifyMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-yellow-500 text-white text-xs font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50"
                      >
                        {modifyMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
                {modifyMutation.isError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 mb-3">
                    Failed to save modifications. Please try again.
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                        <th className="text-left px-3 py-2 font-semibold">Task Name</th>
                        <th className="text-left px-3 py-2 font-semibold">Current Start</th>
                        <th className="text-left px-3 py-2 font-semibold">Current End</th>
                        <th className="text-left px-3 py-2 font-semibold">Proposed Start</th>
                        <th className="text-left px-3 py-2 font-semibold">Proposed End</th>
                        <th className="text-left px-3 py-2 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {proposal.changes.map((change) => {
                        const modDates = modifiedChanges[change.taskId];
                        const displayStart = isModifying && modDates ? modDates.proposedStart : change.proposedStart;
                        const displayEnd = isModifying && modDates ? modDates.proposedEnd : change.proposedEnd;
                        const startDir = dateMoved(change.currentStart, displayStart);
                        const endDir = dateMoved(change.currentEnd, displayEnd);
                        return (
                          <tr key={change.taskId} className={`hover:bg-gray-50 transition-colors ${isModifying ? 'bg-yellow-50/30' : ''}`}>
                            <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                              {change.taskName}
                            </td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {formatDate(change.currentStart)}
                            </td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {formatDate(change.currentEnd)}
                            </td>
                            <td className={`px-3 py-2 whitespace-nowrap ${isModifying ? '' : dateTextClass(startDir)}`}>
                              {isModifying ? (
                                <input
                                  type="date"
                                  value={modDates?.proposedStart ?? change.proposedStart}
                                  onChange={(e) => handleModifyDateChange(change.taskId, 'proposedStart', e.target.value)}
                                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 w-[130px]"
                                />
                              ) : (
                                formatDate(change.proposedStart)
                              )}
                            </td>
                            <td className={`px-3 py-2 whitespace-nowrap ${isModifying ? '' : dateTextClass(endDir)}`}>
                              {isModifying ? (
                                <input
                                  type="date"
                                  value={modDates?.proposedEnd ?? change.proposedEnd}
                                  onChange={(e) => handleModifyDateChange(change.taskId, 'proposedEnd', e.target.value)}
                                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 w-[130px]"
                                />
                              ) : (
                                formatDate(change.proposedEnd)
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate" title={change.reason}>
                              {change.reason}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Rationale */}
              <section>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Rationale</h3>
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4 text-sm text-gray-700 leading-relaxed">
                  {proposal.rationale}
                </div>
              </section>

              {/* Estimated Impact */}
              <section>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Estimated Impact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-[10px] uppercase text-gray-500 font-medium mb-1">Original End Date</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(proposal.estimatedImpact.originalEndDate)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-[10px] uppercase text-gray-500 font-medium mb-1">Proposed End Date</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(proposal.estimatedImpact.proposedEndDate)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-[10px] uppercase text-gray-500 font-medium mb-1">Days Change</p>
                    <p
                      className={`text-sm font-semibold ${
                        proposal.estimatedImpact.daysChange > 0
                          ? 'text-red-600'
                          : proposal.estimatedImpact.daysChange < 0
                          ? 'text-green-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {proposal.estimatedImpact.daysChange > 0 ? '+' : ''}
                      {proposal.estimatedImpact.daysChange} days
                    </p>
                  </div>
                </div>
              </section>

              {/* Reject Feedback */}
              {showRejectFeedback && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Rejection Feedback</h3>
                  <textarea
                    value={rejectFeedback}
                    onChange={(e) => setRejectFeedback(e.target.value)}
                    rows={3}
                    placeholder="Explain why this proposal is not suitable (optional)..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleReject}
                      disabled={rejectMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => setShowRejectFeedback(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              )}

              {/* Success / Rejected states */}
              {accepted && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Proposal accepted. Schedule has been updated.
                </div>
              )}

              {rejected && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Proposal rejected. Feedback has been recorded.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer action buttons */}
        {proposal && !accepted && !rejected && !showRejectFeedback && !isModifying && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setShowRejectFeedback(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={handleStartModify}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Modify
            </button>
            <button
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Accept
            </button>
          </div>
        )}
      </div>

      {/* Slide-in animation style */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
