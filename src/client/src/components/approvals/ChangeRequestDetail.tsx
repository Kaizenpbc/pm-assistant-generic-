import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  GitPullRequest,
  X,
} from 'lucide-react';
import { apiService } from '../../services/api';

interface ChangeRequestDetailProps {
  crId: string;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
};

const CATEGORY_COLORS: Record<string, string> = {
  scope: 'bg-purple-100 text-purple-800',
  schedule: 'bg-blue-100 text-blue-800',
  budget: 'bg-green-100 text-green-800',
  resource: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  rejected: <XCircle className="w-4 h-4 text-red-500" />,
  returned: <RotateCcw className="w-4 h-4 text-yellow-500" />,
  submitted: <GitPullRequest className="w-4 h-4 text-blue-500" />,
  withdrawn: <X className="w-4 h-4 text-gray-400" />,
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ChangeRequestDetail({ crId, onBack }: ChangeRequestDetailProps) {
  const queryClient = useQueryClient();

  const [actionComment, setActionComment] = useState('');
  const [showWorkflowSelect, setShowWorkflowSelect] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['change-request', crId],
    queryFn: () => apiService.getChangeRequestDetail(crId),
    enabled: !!crId,
  });

  const cr = data?.changeRequest;
  const approvalHistory: any[] = data?.approvalHistory || [];
  const currentStep = data?.currentStep;

  // Fetch available workflows for submission
  const { data: workflowsData } = useQuery({
    queryKey: ['approval-workflows', cr?.projectId],
    queryFn: () => apiService.getApprovalWorkflows(cr!.projectId),
    enabled: showWorkflowSelect && !!cr?.projectId,
  });

  const workflows: any[] = workflowsData?.workflows || [];

  // Mutations for actions
  const submitMutation = useMutation({
    mutationFn: (workflowId: string) =>
      apiService.submitChangeRequestForApproval(crId, workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-request', crId] });
      setShowWorkflowSelect(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (comment: string) =>
      apiService.actOnChangeRequest(crId, 'approve', comment || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-request', crId] });
      setActionComment('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (comment: string) =>
      apiService.actOnChangeRequest(crId, 'reject', comment || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-request', crId] });
      setActionComment('');
    },
  });

  const returnMutation = useMutation({
    mutationFn: (comment: string) =>
      apiService.actOnChangeRequest(crId, 'return', comment || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-request', crId] });
      setActionComment('');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => apiService.withdrawChangeRequest(crId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-request', crId] });
    },
  });

  const isActionPending =
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    returnMutation.isPending ||
    withdrawMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !cr) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-red-500 mb-3">Failed to load change request.</p>
        <button onClick={onBack} className="text-sm text-indigo-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const canSubmit = cr.status === 'draft';
  const canReview = cr.status === 'pending' || cr.status === 'in_review';
  const canWithdraw = cr.status === 'pending' || cr.status === 'in_review';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={onBack}
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
      >
        &larr; Back to Change Requests
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{cr.title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cr.status] || STATUS_COLORS.draft}`}>
                {statusLabel(cr.status)}
              </span>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cr.category] || CATEGORY_COLORS.other}`}>
                {cr.category}
              </span>
              <span className={`text-xs font-semibold ${PRIORITY_COLORS[cr.priority] || ''}`}>
                {cr.priority?.toUpperCase()} priority
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {cr.description && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.description}</p>
          </div>
        )}

        {/* Impact Summary */}
        {cr.impactSummary && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Impact Summary</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.impactSummary}</p>
          </div>
        )}

        {/* Meta */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span>Requested by: {cr.requestedByName || cr.requestedBy || '-'}</span>
          <span>Created: {new Date(cr.createdAt).toLocaleString()}</span>
          {cr.updatedAt && <span>Updated: {new Date(cr.updatedAt).toLocaleString()}</span>}
        </div>
      </div>

      {/* Current Step Indicator */}
      {currentStep && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">Current Approval Step</h4>
          <p className="text-sm text-indigo-900 font-medium">
            Step {currentStep.stepOrder}: {currentStep.role} - {currentStep.action}
          </p>
        </div>
      )}

      {/* Approval Timeline */}
      {approvalHistory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Approval Timeline</h4>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {approvalHistory.map((entry: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 relative">
                  <div className="relative z-10 mt-0.5 flex-shrink-0">
                    {ACTION_ICONS[entry.action] || <Clock className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {entry.actorName || entry.actor || 'System'}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{entry.action}</span>
                      {entry.stepRole && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {entry.stepRole}
                        </span>
                      )}
                    </div>
                    {entry.comment && (
                      <p className="text-sm text-gray-600 mt-0.5">{entry.comment}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {(canSubmit || canReview || canWithdraw) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</h4>

          {/* Submit for Approval (draft) */}
          {canSubmit && !showWorkflowSelect && (
            <button
              onClick={() => setShowWorkflowSelect(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <GitPullRequest className="w-4 h-4" />
              Submit for Approval
            </button>
          )}

          {/* Workflow selector */}
          {canSubmit && showWorkflowSelect && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">Select Approval Workflow</label>
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choose a workflow...</option>
                {workflows.map((wf: any) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedWorkflowId) submitMutation.mutate(selectedWorkflowId);
                  }}
                  disabled={!selectedWorkflowId || submitMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  onClick={() => setShowWorkflowSelect(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Review Actions (pending / in_review) */}
          {canReview && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder="Add a comment for your decision..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => approveMutation.mutate(actionComment)}
                  disabled={isActionPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {approveMutation.isPending ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => rejectMutation.mutate(actionComment)}
                  disabled={isActionPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={() => returnMutation.mutate(actionComment)}
                  disabled={isActionPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  {returnMutation.isPending ? 'Returning...' : 'Return'}
                </button>
              </div>
            </div>
          )}

          {/* Withdraw */}
          {canWithdraw && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to withdraw this change request?')) {
                    withdrawMutation.mutate();
                  }
                }}
                disabled={isActionPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
                {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          )}

          {/* Error display */}
          {(submitMutation.isError || approveMutation.isError || rejectMutation.isError || returnMutation.isError || withdrawMutation.isError) && (
            <p className="text-sm text-red-600">Action failed. Please try again.</p>
          )}
        </div>
      )}
    </div>
  );
}
