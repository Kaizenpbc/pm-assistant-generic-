import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workflow, Plus, Trash2, ToggleLeft, ToggleRight, Zap, Clock } from 'lucide-react';
import { apiService } from '../services/api';

interface TriggerConfig {
  type: 'status_change' | 'date_passed' | 'progress_threshold';
  fromStatus?: string;
  toStatus?: string;
  progressThreshold?: number;
  progressDirection?: 'above' | 'below';
}

interface ActionConfig {
  type: 'update_field' | 'log_activity' | 'send_notification';
  field?: string;
  value?: string;
  message?: string;
}

interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: TriggerConfig;
  action: ActionConfig;
  createdAt: string;
  updatedAt: string;
}

const defaultTrigger: TriggerConfig = { type: 'status_change', toStatus: 'completed' };
const defaultAction: ActionConfig = { type: 'log_activity', message: '' };

export function WorkflowPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<TriggerConfig>(defaultTrigger);
  const [action, setAction] = useState<ActionConfig>(defaultAction);

  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => apiService.getWorkflows(),
  });

  const { data: execData } = useQuery({
    queryKey: ['workflowExecutions'],
    queryFn: () => apiService.getWorkflowExecutions(),
  });

  const rules: WorkflowRule[] = data?.rules || [];
  const executions = execData?.executions || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => apiService.createWorkflow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiService.updateWorkflow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteWorkflow(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiService.updateWorkflow(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingRule(null);
    setName('');
    setDescription('');
    setTrigger(defaultTrigger);
    setAction(defaultAction);
  };

  const openEditForm = (rule: WorkflowRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || '');
    setTrigger(rule.trigger);
    setAction(rule.action);
    setShowForm(true);
  };

  const handleSave = () => {
    const payload = { name, description, enabled: true, trigger, action };
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const triggerLabel = (t: TriggerConfig) => {
    switch (t.type) {
      case 'status_change': return `Status changes${t.fromStatus ? ` from ${t.fromStatus}` : ''}${t.toStatus ? ` to ${t.toStatus}` : ''}`;
      case 'progress_threshold': return `Progress ${t.progressDirection === 'below' ? '<=' : '>='} ${t.progressThreshold}%`;
      case 'date_passed': return 'End date has passed';
      default: return t.type;
    }
  };

  const actionLabel = (a: ActionConfig) => {
    switch (a.type) {
      case 'update_field': return `Set ${a.field} to "${a.value}"`;
      case 'log_activity': return `Log: ${a.message || 'activity'}`;
      case 'send_notification': return `Notify: ${a.message || 'notification'}`;
      default: return a.type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
            <Workflow className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Workflow Automation</h1>
            <p className="text-sm text-gray-500">Define rules to automate task actions</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Rule
        </button>
      </div>

      {/* Rule Builder Form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{editingRule ? 'Edit Rule' : 'Create Rule'}</h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rule Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g., Auto-complete on 100%"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Trigger */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <h4 className="text-xs font-semibold text-blue-700 mb-2">WHEN (Trigger)</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={trigger.type}
                onChange={e => setTrigger({ type: e.target.value as TriggerConfig['type'] })}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
              >
                <option value="status_change">Status Changes</option>
                <option value="progress_threshold">Progress Threshold</option>
                <option value="date_passed">End Date Passed</option>
              </select>
              {trigger.type === 'status_change' && (
                <>
                  <select
                    value={trigger.toStatus || ''}
                    onChange={e => setTrigger({ ...trigger, toStatus: e.target.value || undefined })}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
                  >
                    <option value="">Any status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    value={trigger.fromStatus || ''}
                    onChange={e => setTrigger({ ...trigger, fromStatus: e.target.value || undefined })}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
                  >
                    <option value="">From any</option>
                    <option value="pending">From Pending</option>
                    <option value="in_progress">From In Progress</option>
                    <option value="completed">From Completed</option>
                  </select>
                </>
              )}
              {trigger.type === 'progress_threshold' && (
                <>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={trigger.progressThreshold || 0}
                    onChange={e => setTrigger({ ...trigger, progressThreshold: Number(e.target.value) })}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
                    placeholder="Threshold %"
                  />
                  <select
                    value={trigger.progressDirection || 'above'}
                    onChange={e => setTrigger({ ...trigger, progressDirection: e.target.value as 'above' | 'below' })}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
                  >
                    <option value="above">At or above</option>
                    <option value="below">At or below</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <h4 className="text-xs font-semibold text-green-700 mb-2">THEN (Action)</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={action.type}
                onChange={e => setAction({ type: e.target.value as ActionConfig['type'] })}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
              >
                <option value="update_field">Update Field</option>
                <option value="log_activity">Log Activity</option>
                <option value="send_notification">Send Notification</option>
              </select>
              {action.type === 'update_field' && (
                <>
                  <select
                    value={action.field || ''}
                    onChange={e => setAction({ ...action, field: e.target.value })}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
                  >
                    <option value="">Select field</option>
                    <option value="status">Status</option>
                    <option value="priority">Priority</option>
                  </select>
                  <input
                    type="text"
                    value={action.value || ''}
                    onChange={e => setAction({ ...action, value: e.target.value })}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1.5"
                    placeholder="New value"
                  />
                </>
              )}
              {(action.type === 'log_activity' || action.type === 'send_notification') && (
                <input
                  type="text"
                  value={action.message || ''}
                  onChange={e => setAction({ ...action, message: e.target.value })}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1.5 sm:col-span-2"
                  placeholder="Message"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Rules ({rules.length})</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">No workflow rules defined yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.map((rule) => (
              <div key={rule.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-300" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${rule.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                          {rule.name}
                        </span>
                        {!rule.enabled && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Disabled</span>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-[10px]">
                        <span className="text-blue-600">When: {triggerLabel(rule.trigger)}</span>
                        <span className="text-green-600">Then: {actionLabel(rule.action)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditForm(rule)}
                      className="px-2 py-1 text-[10px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution History */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Execution History</h3>
          </div>
        </div>
        {executions.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">No workflow executions yet. Rules fire when tasks are updated.</div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {executions.slice(0, 20).map((exec: any, idx: number) => (
              <div key={idx} className="px-4 py-2 text-xs flex items-center gap-3">
                <Zap className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-gray-700">{exec.ruleName}</span>
                  <span className="text-gray-400"> on </span>
                  <span className="text-gray-600">{exec.taskName}</span>
                  <span className="text-gray-400"> — {exec.result}</span>
                </div>
                <span className="text-gray-300 flex-shrink-0">{new Date(exec.executedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
