import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { apiService } from '../../services/api';

interface Props {
  formId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export const IntakeSubmissionForm: React.FC<Props> = ({ formId, onClose, onSubmitted }) => {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: formData, isLoading } = useQuery({
    queryKey: ['intake-form', formId],
    queryFn: () => apiService.getIntakeForm(formId),
  });

  const form = formData?.form;
  const fields: any[] = form?.fields || [];

  const submitMutation = useMutation({
    mutationFn: (submissionValues: Record<string, any>) =>
      apiService.submitIntakeForm(formId, submissionValues),
    onSuccess: () => onSubmitted(),
  });

  const setValue = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error on change
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const val = values[field.id];
        if (val === undefined || val === null || val === '' || val === false) {
          newErrors[field.id] = 'This field is required';
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    submitMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-400">Loading form...</div>
    );
  }

  if (!form) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Form not found.</p>
        <button onClick={onClose} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {form.name}
          </h1>
          {form.description && (
            <p className="text-sm text-gray-500 mt-0.5">{form.description}</p>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {fields.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            This form has no fields configured.
          </p>
        ) : (
          fields.map((field: any) => {
            const hasError = !!errors[field.id];
            const inputClasses = `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              hasError ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'
            }`;

            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    value={values[field.id] || ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={inputClasses}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={values[field.id] ?? ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={inputClasses}
                    placeholder="0"
                  />
                )}

                {field.type === 'date' && (
                  <input
                    type="date"
                    value={values[field.id] || ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={inputClasses}
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    value={values[field.id] || ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    rows={4}
                    className={`${inputClasses} resize-none`}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                )}

                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values[field.id]}
                      onChange={(e) => setValue(field.id, e.target.checked)}
                      className={`rounded text-blue-600 focus:ring-blue-500 ${
                        hasError ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    <span className="text-sm text-gray-600">{field.label}</span>
                  </label>
                )}

                {field.type === 'dropdown' && (
                  <select
                    value={values[field.id] || ''}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">Select an option...</option>
                    {(Array.isArray(field.options) ? field.options : []).map(
                      (opt: string, i: number) => (
                        <option key={i} value={opt}>
                          {opt}
                        </option>
                      ),
                    )}
                  </select>
                )}

                {hasError && (
                  <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit'}
        </button>
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        {submitMutation.isError && (
          <span className="text-xs text-red-600">Failed to submit. Please try again.</span>
        )}
      </div>
    </div>
  );
};
