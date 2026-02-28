import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Save, Plug, Check, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationConfigModalProps {
  provider: string;
  integrationId?: string; // if editing
  onClose: () => void;
  onSaved: () => void;
}

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Provider field definitions
// ---------------------------------------------------------------------------

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  jira: [
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: true,
      placeholder: 'https://your-domain.atlassian.net',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      required: true,
      placeholder: 'you@company.com',
    },
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'password',
      required: true,
      placeholder: 'Enter your Jira API token',
    },
    {
      key: 'projectKey',
      label: 'Project Key',
      type: 'text',
      required: true,
      placeholder: 'e.g. PROJ',
    },
  ],
  github: [
    {
      key: 'owner',
      label: 'Repository Owner',
      type: 'text',
      required: true,
      placeholder: 'e.g. octocat',
    },
    {
      key: 'repo',
      label: 'Repository Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. my-project',
    },
    {
      key: 'token',
      label: 'Personal Access Token',
      type: 'password',
      required: true,
      placeholder: 'ghp_...',
    },
  ],
  slack: [
    {
      key: 'webhookUrl',
      label: 'Webhook URL',
      type: 'url',
      required: true,
      placeholder: 'https://hooks.slack.com/services/...',
    },
    {
      key: 'channel',
      label: 'Channel',
      type: 'text',
      required: false,
      placeholder: '#project-updates (optional)',
    },
  ],
  trello: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Enter your Trello API key',
    },
    {
      key: 'token',
      label: 'Token',
      type: 'password',
      required: true,
      placeholder: 'Enter your Trello token',
    },
    {
      key: 'boardId',
      label: 'Board ID',
      type: 'text',
      required: true,
      placeholder: 'e.g. 60d5ec49f...',
    },
  ],
};

const PROVIDER_NAMES: Record<string, string> = {
  jira: 'Jira',
  github: 'GitHub',
  slack: 'Slack',
  trello: 'Trello',
};

const PROVIDER_COLORS: Record<string, string> = {
  jira: '#0052CC',
  github: '#333333',
  slack: '#4A154B',
  trello: '#0079BF',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const IntegrationConfigModal: React.FC<IntegrationConfigModalProps> = ({
  provider,
  integrationId,
  onClose,
  onSaved,
}) => {
  const isEdit = !!integrationId;
  const fields = PROVIDER_FIELDS[provider] ?? [];
  const providerName = PROVIDER_NAMES[provider] ?? provider;

  // Form state: key -> value
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.key] = '';
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Load existing config if editing
  const { data: existingData } = useQuery({
    queryKey: ['integration', integrationId],
    queryFn: () => apiService.getIntegration(integrationId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingData?.integration?.config) {
      const config = existingData.integration.config as Record<string, string>;
      setFormValues((prev) => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          if (config[key] !== undefined) {
            updated[key] = config[key];
          }
        }
        return updated;
      });
    }
  }, [existingData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (config: Record<string, string>) => {
      if (isEdit) {
        return apiService.updateIntegration(integrationId!, {
          provider,
          config,
        });
      }
      return apiService.createIntegration({ provider, config });
    },
    onSuccess: () => {
      onSaved();
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => apiService.testIntegrationConnection(id),
    onSuccess: (data) => {
      setTestResult({
        success: data.success !== false,
        message: data.message || 'Connection successful!',
      });
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Connection test failed',
      });
    },
  });

  // Handlers
  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    // Clear field error on edit
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setTestResult(null);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !formValues[f.key]?.trim()) {
        newErrors[f.key] = `${f.label} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveMutation.mutate(formValues);
  };

  const handleTestConnection = () => {
    if (!integrationId) return;
    setTestResult(null);
    testMutation.mutate(integrationId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: PROVIDER_COLORS[provider] || '#6366f1' }}
            >
              {providerName.charAt(0)}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? `Configure ${providerName}` : `Connect ${providerName}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </label>
              <input
                type={field.type}
                value={formValues[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors[field.key]
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
              />
              {errors[field.key] && (
                <p className="mt-1 text-xs text-red-600">
                  {errors[field.key]}
                </p>
              )}
            </div>
          ))}

          {/* Test connection (only when editing an existing integration) */}
          {isEdit && (
            <div className="pt-2">
              <button
                onClick={handleTestConnection}
                disabled={testMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {testMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
                Test Connection
              </button>

              {testResult && (
                <div
                  className={`mt-2 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                    testResult.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {testResult.success ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {/* Save error */}
          {saveMutation.isError && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">
              {(saveMutation.error as any)?.response?.data?.message ||
                'Failed to save integration. Please try again.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit ? 'Save Changes' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
};
