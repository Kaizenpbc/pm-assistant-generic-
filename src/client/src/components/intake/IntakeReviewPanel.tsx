import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  FolderPlus,
  ClipboardList,
} from 'lucide-react';
import { apiService } from '../../services/api';

interface Props {
  submissionId: string;
  onClose: () => void;
  onUpdated: () => void;
}

const statusBadgeStyles: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
};

const statusLabels: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  converted: 'Converted',
};

export const IntakeReviewPanel: React.FC<Props> = ({ submissionId, onClose, onUpdated }) => {
  const [reviewStatus, setReviewStatus] = useState('under_review');
  const [reviewNotes, setReviewNotes] = useState('');
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [convertedProjectId, setConvertedProjectId] = useState<string | null>(null);

  const { data: submissionData, isLoading } = useQuery({
    queryKey: ['intake-submission', submissionId],
    queryFn: () => apiService.getIntakeSubmission(submissionId),
  });

  const submission = submissionData?.submission;
  const formFields: any[] = submission?.fields || [];
  const submittedValues: Record<string, any> = submission?.values || {};

  const canReview =
    submission?.status === 'submitted' || submission?.status === 'under_review';
  const canConvert = submission?.status === 'approved';

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: () =>
      apiService.reviewIntakeSubmission(submissionId, {
        status: reviewStatus,
        notes: reviewNotes,
      }),
    onSuccess: () => onUpdated(),
  });

  // Convert to project mutation
  const convertMutation = useMutation({
    mutationFn: () => apiService.convertIntakeToProject(submissionId),
    onSuccess: (data) => {
      setConvertedProjectId(data?.projectId || data?.project?.id || null);
      setShowConvertConfirm(false);
      onUpdated();
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-gray-400">Loading submission...</div>;
  }

  if (!submission) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Submission not found.</p>
        <button
          onClick={onClose}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Review Submission
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {submission.form_name || submission.formName || 'Intake Form'}
          </p>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${
            statusBadgeStyles[submission.status] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {statusLabels[submission.status] || submission.status}
        </span>
      </div>

      {/* Submission info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-xs text-gray-500 font-medium block mb-0.5">Submitted By</span>
            <span className="text-gray-900 font-medium">
              {submission.submitted_by_name || submission.submittedByName || 'Unknown'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium block mb-0.5">Submission Date</span>
            <span className="text-gray-900">
              {submission.created_at
                ? new Date(submission.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium block mb-0.5">Form</span>
            <span className="text-gray-900">
              {submission.form_name || submission.formName || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Submitted values */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Submitted Values
        </h2>
        {formFields.length === 0 && Object.keys(submittedValues).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No data submitted.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {formFields.map((field: any) => (
              <div key={field.id} className="py-3 flex items-start gap-4">
                <span className="text-sm font-medium text-gray-600 w-1/3 shrink-0">
                  {field.label}
                </span>
                <span className="text-sm text-gray-900">
                  {field.type === 'checkbox'
                    ? submittedValues[field.id]
                      ? 'Yes'
                      : 'No'
                    : submittedValues[field.id] !== undefined &&
                      submittedValues[field.id] !== null &&
                      submittedValues[field.id] !== ''
                    ? String(submittedValues[field.id])
                    : '-'}
                </span>
              </div>
            ))}
            {/* Also show any values not in formFields (in case fields definition is incomplete) */}
            {Object.entries(submittedValues)
              .filter(([key]) => !formFields.some((f: any) => f.id === key))
              .map(([key, val]) => (
                <div key={key} className="py-3 flex items-start gap-4">
                  <span className="text-sm font-medium text-gray-600 w-1/3 shrink-0">
                    {key}
                  </span>
                  <span className="text-sm text-gray-900">
                    {val !== undefined && val !== null && val !== '' ? String(val) : '-'}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Review actions */}
      {canReview && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Review Actions</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Set Status</label>
            <div className="flex gap-2">
              {[
                { value: 'under_review', label: 'Under Review', icon: null },
                { value: 'approved', label: 'Approve', icon: CheckCircle2 },
                { value: 'rejected', label: 'Reject', icon: XCircle },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setReviewStatus(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${
                    reviewStatus === opt.value
                      ? opt.value === 'approved'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : opt.value === 'rejected'
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-yellow-50 border-yellow-300 text-yellow-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Review Notes</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this submission..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {reviewMutation.isPending ? 'Saving...' : 'Save Review'}
            </button>
            {reviewMutation.isError && (
              <span className="text-xs text-red-600">Failed to save review.</span>
            )}
          </div>
        </div>
      )}

      {/* Convert to project */}
      {canConvert && !convertedProjectId && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FolderPlus className="w-4 h-4" />
            Convert to Project
          </h2>
          <p className="text-xs text-gray-500">
            This submission has been approved. You can convert it into a new project.
          </p>
          {!showConvertConfirm ? (
            <button
              onClick={() => setShowConvertConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FolderPlus className="w-4 h-4" /> Convert to Project
            </button>
          ) : (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-purple-800 font-medium">
                Are you sure you want to create a new project from this submission?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => convertMutation.mutate()}
                  disabled={convertMutation.isPending}
                  className="px-4 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {convertMutation.isPending ? 'Converting...' : 'Yes, Convert'}
                </button>
                <button
                  onClick={() => setShowConvertConfirm(false)}
                  className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {convertMutation.isError && (
                <span className="text-xs text-red-600">Failed to convert. Please try again.</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Converted success */}
      {convertedProjectId && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h2 className="text-sm font-semibold text-green-800">Project Created</h2>
          </div>
          <p className="text-sm text-green-700 mb-3">
            This submission has been successfully converted into a project.
          </p>
          <a
            href={`/projects/${convertedProjectId}`}
            className="text-sm font-medium text-green-700 underline hover:text-green-800"
          >
            View Project
          </a>
        </div>
      )}

      {/* Review notes display for already reviewed submissions */}
      {!canReview && submission.review_notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Review Notes</h2>
          <p className="text-sm text-gray-600">{submission.review_notes}</p>
          {submission.reviewed_by_name && (
            <p className="text-xs text-gray-400">
              Reviewed by {submission.reviewed_by_name}
              {submission.reviewed_at &&
                ` on ${new Date(submission.reviewed_at).toLocaleDateString()}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
