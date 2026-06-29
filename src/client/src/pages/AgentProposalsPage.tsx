import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ChevronRight,
  Activity,
  X,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Proposal {
  id: string;
  project_id: string;
  schedule_id?: string;
  agent_id: string;
  agent_version: string;
  status: string;
  title: string;
  reasoning: string;
  summary: string;
  confidence_score: number;
  confidence_factors: Record<string, unknown> | null;
  risk_level: string;
  expires_at?: string;
  created_at: string;
  reviewed_at?: string;
  executed_at?: string;
}

interface ProposalAction {
  id: string;
  execution_order: number;
  action_type: string;
  target_entity_type: string;
  target_entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown>;
  reasoning?: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'executed', label: 'Executed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Expired' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-600',
  executing: 'bg-indigo-100 text-indigo-800',
  executed: 'bg-green-100 text-green-800',
  rolled_back: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-800',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

function confidenceColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAgentName(agentId: string): string {
  return agentId.replace(/-v\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HealthBanner() {
  const { data } = useQuery({
    queryKey: ['agent-health'],
    queryFn: () => apiService.getAgentHealth(),
    refetchInterval: 60000,
  });

  if (!data) return null;

  const isHealthy = data.status === 'healthy';

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm ${isHealthy ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
      <Activity className={`w-4 h-4 ${isHealthy ? 'text-green-600' : 'text-yellow-600'}`} />
      <span className={isHealthy ? 'text-green-700' : 'text-yellow-700'}>
        Agent system: <span className="font-medium">{data.status}</span>
      </span>
      {data.recommendedScanScope && data.recommendedScanScope !== 'full' && (
        <span className="text-yellow-600 text-xs">Scan scope: {data.recommendedScanScope}</span>
      )}
      {typeof data.pendingProposals === 'number' && (
        <span className="ml-auto text-xs text-gray-500">{data.pendingProposals} pending</span>
      )}
      {data.costs?.today && (
        <span className="text-xs text-gray-500">
          Today: {data.costs.today.invocations} calls / ${data.costs.today.estimatedCostUsd?.toFixed(4) ?? '0'}
        </span>
      )}
    </div>
  );
}

function ProposalDetailModal({
  proposalId,
  onClose,
}: {
  proposalId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [comment, setComment] = useState('');
  const [feedbackOutcome, setFeedbackOutcome] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['agent-proposal', proposalId],
    queryFn: () => apiService.getAgentProposal(proposalId),
  });

  const { data: actionsData } = useQuery({
    queryKey: ['agent-proposal-actions', proposalId],
    queryFn: () => apiService.getAgentProposalActions(proposalId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['agent-proposals'] });
    queryClient.invalidateQueries({ queryKey: ['agent-proposal', proposalId] });
    queryClient.invalidateQueries({ queryKey: ['agent-health'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => apiService.approveAgentProposal(proposalId, comment || undefined),
    onSuccess: () => { invalidate(); setComment(''); },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiService.rejectAgentProposal(proposalId, comment || undefined),
    onSuccess: () => { invalidate(); setComment(''); },
  });

  const executeMutation = useMutation({
    mutationFn: () => apiService.executeAgentProposal(proposalId),
    onSuccess: invalidate,
  });

  const rollbackMutation = useMutation({
    mutationFn: () => apiService.rollbackAgentProposal(proposalId),
    onSuccess: invalidate,
  });

  const feedbackMutation = useMutation({
    mutationFn: () => apiService.submitAgentProposalFeedback(proposalId, feedbackOutcome, feedbackComment || undefined),
    onSuccess: () => { invalidate(); setFeedbackOutcome(''); setFeedbackComment(''); },
  });

  const proposal: Proposal | undefined = data?.proposal;
  const actions: ProposalAction[] = actionsData?.actions || [];
  const isAdmin = user?.role === 'admin';
  const canReview = proposal?.status === 'pending';
  const canExecute = proposal?.status === 'approved' && isAdmin;
  const canRollback = proposal?.status === 'executed' && isAdmin;
  const canFeedback = proposal?.status === 'executed';

  const anyMutating = approveMutation.isPending || rejectMutation.isPending || executeMutation.isPending || rollbackMutation.isPending || feedbackMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-start justify-between z-10">
          <div className="min-w-0 pr-4">
            {isLoading ? (
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 truncate">{proposal?.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[proposal?.status || ''] || 'bg-gray-100 text-gray-600'}`}>
                    {proposal?.status?.replace(/_/g, ' ')}
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[proposal?.risk_level || ''] || ''}`}>
                    {proposal?.risk_level} risk
                  </span>
                  <span className={`text-sm font-medium ${confidenceColor(proposal?.confidence_score ?? 0)}`}>
                    {proposal?.confidence_score?.toFixed(0)}% confidence
                  </span>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : proposal ? (
          <div className="px-6 py-4 space-y-5">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Agent:</span>{' '}
                <span className="font-medium text-gray-900">{formatAgentName(proposal.agent_id)}</span>
                <span className="text-gray-400 text-xs ml-1">v{proposal.agent_version}</span>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>{' '}
                <span className="text-gray-900">{new Date(proposal.created_at).toLocaleString()}</span>
              </div>
              {proposal.expires_at && (
                <div>
                  <span className="text-gray-500">Expires:</span>{' '}
                  <span className="text-gray-900">{new Date(proposal.expires_at).toLocaleString()}</span>
                </div>
              )}
              {proposal.executed_at && (
                <div>
                  <span className="text-gray-500">Executed:</span>{' '}
                  <span className="text-gray-900">{new Date(proposal.executed_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Summary</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{proposal.summary}</p>
            </div>

            {/* Reasoning */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Reasoning</h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{proposal.reasoning}</p>
            </div>

            {/* Confidence Factors */}
            {proposal.confidence_factors && Object.keys(proposal.confidence_factors).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Confidence Breakdown</h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(proposal.confidence_factors).map(([key, val]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">{key.replace(/_/g, ' ')}</div>
                      <div className={`text-sm font-semibold ${confidenceColor(Number(val) || 0)}`}>
                        {typeof val === 'number' ? val.toFixed(0) : String(val)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Proposed Actions ({actions.length})</h3>
                <div className="space-y-2">
                  {actions.map(action => (
                    <div key={action.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            #{action.execution_order}. {action.action_type.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[action.status] || 'bg-gray-100 text-gray-600'}`}>
                            {action.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Target: {action.target_entity_type} ({action.target_entity_id.slice(0, 8)}...)
                      </div>
                      {action.reasoning && (
                        <p className="text-xs text-gray-600 mt-1">{action.reasoning}</p>
                      )}
                      {action.new_value && (
                        <div className="mt-1 text-xs">
                          <span className="text-gray-500">Change: </span>
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">
                            {JSON.stringify(action.new_value)}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error messages from mutations */}
            {(approveMutation.error || rejectMutation.error || executeMutation.error || rollbackMutation.error || feedbackMutation.error) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {String((approveMutation.error || rejectMutation.error || executeMutation.error || rollbackMutation.error || feedbackMutation.error) as Error)}
              </div>
            )}

            {/* Review Actions (pending) */}
            {canReview && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Review</h3>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Optional comment..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={anyMutating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate()}
                    disabled={anyMutating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Execute Action (approved, admin only) */}
            {canExecute && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => executeMutation.mutate()}
                    disabled={anyMutating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    Execute Proposal
                  </button>
                  <span className="text-xs text-gray-500">This will apply all proposed actions</span>
                </div>
              </div>
            )}

            {/* Rollback Action (executed, admin only) */}
            {canRollback && (
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => rollbackMutation.mutate()}
                  disabled={anyMutating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Rollback
                </button>
              </div>
            )}

            {/* Feedback (executed) */}
            {canFeedback && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Outcome Feedback</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['effective', 'partially_effective', 'ineffective', 'made_worse'].map(o => (
                    <button
                      key={o}
                      onClick={() => setFeedbackOutcome(o)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        feedbackOutcome === o
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {o === 'effective' && <ThumbsUp className="w-3 h-3 inline mr-1" />}
                      {o === 'made_worse' && <ThumbsDown className="w-3 h-3 inline mr-1" />}
                      {o.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                {feedbackOutcome && (
                  <>
                    <textarea
                      value={feedbackComment}
                      onChange={e => setFeedbackComment(e.target.value)}
                      placeholder="Optional comment..."
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                    />
                    <button
                      onClick={() => feedbackMutation.mutate()}
                      disabled={anyMutating}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Submit Feedback
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">Proposal not found.</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export const AgentProposalsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent-proposals', statusFilter],
    queryFn: () => apiService.getAgentProposals({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 100,
    }),
  });

  const proposals: Proposal[] = data?.proposals || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Proposals</h1>
          <p className="text-sm text-gray-500 mt-1">Review, approve, and execute AI agent recommendations</p>
        </div>
      </div>

      {/* Health Banner */}
      <HealthBanner />

      {/* Status Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load proposals. Please try again.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && proposals.length === 0 && (
        <div className="text-center py-20">
          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No proposals found</h3>
          <p className="text-sm text-gray-500">
            {statusFilter === 'all'
              ? 'Agents have not generated any proposals yet.'
              : `No ${statusFilter} proposals.`}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && proposals.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Agent</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Title</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Risk</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Confidence</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Created</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {proposals.map(p => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="font-medium text-gray-900 truncate max-w-[140px]">
                        {formatAgentName(p.agent_id)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900 truncate block max-w-[280px]">{p.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[p.risk_level] || ''}`}>
                      {p.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${confidenceColor(p.confidence_score)}`}>
                      {p.confidence_score?.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {timeAgo(p.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedId && (
        <ProposalDetailModal proposalId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
};
