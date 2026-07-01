import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import type { GanttTask } from './GanttChart';
import { TaskActivityPanel } from './TaskActivityPanel';
import { TimeLogForm } from '../timetracking/TimeLogForm';
import { CustomFieldsSection } from '../customfields/CustomFieldsSection';
import { AttachmentPanel } from '../attachments/AttachmentPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskFormData {
  name: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  startDate: string;
  endDate: string;
  progressPercentage: number;
  dependency: string;
  dependencyType: string;
  dependencyLagDays: string;
  parentTaskId: string;
  estimatedDays: string;
  recurrenceRule: string;
  isRecurrenceTemplate: boolean;
  isMilestone: boolean;
}

interface TaskFormModalProps {
  /** null = create mode, object = edit mode */
  task: GanttTask | null;
  /** All tasks in the schedule (for dependency & parent dropdowns) */
  allTasks: GanttTask[];
  onSave: (data: TaskFormData) => void;
  onDelete?: (taskId: string) => void;
  onClose: () => void;
  isSaving?: boolean;
  /** Schedule ID for comments/activity panel */
  scheduleId?: string;
  /** Project ID for custom fields, time tracking, and attachments */
  projectId?: string;
  /** ID of the currently active/selected task (used to pre-fill parent in create mode) */
  activeTaskId?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInputDate(s?: string): string {
  if (!s) return '';
  try {
    return new Date(s).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskFormModal({
  task,
  allTasks,
  onSave,
  onDelete,
  onClose,
  isSaving,
  scheduleId,
  projectId,
  activeTaskId,
}: TaskFormModalProps) {
  const isEdit = !!task;

  const [form, setForm] = useState<TaskFormData>({
    name: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedTo: '',
    startDate: '',
    endDate: '',
    progressPercentage: 0,
    dependency: '',
    parentTaskId: '',
    estimatedDays: '',
    recurrenceRule: '',
    isRecurrenceTemplate: false,
    dependencyType: 'FS',
    dependencyLagDays: '',
    isMilestone: false,
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (task) {
      setForm({
        name: task.name || '',
        description: task.description || '',
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        assignedTo: task.assignedTo || '',
        startDate: toInputDate(task.startDate),
        endDate: toInputDate(task.endDate),
        progressPercentage: task.progressPercentage ?? 0,
        dependency: task.dependency || '',
        parentTaskId: task.parentTaskId || '',
        estimatedDays: task.estimatedDays?.toString() || '',
        recurrenceRule: (task as any).recurrenceRule || '',
        isRecurrenceTemplate: (task as any).isRecurrenceTemplate || false,
        dependencyType: (task as any).dependencyType || 'FS',
        dependencyLagDays: (task as any).dependencyLagDays?.toString() || '',
        isMilestone: (task as any).isMilestone || false,
      });
    }
  }, [task]);

  // Pre-fill parentTaskId based on active task context (create mode only)
  useEffect(() => {
    if (isEdit || !activeTaskId) return;
    const activeTask = allTasks.find(t => t.id === activeTaskId);
    if (!activeTask) return;
    const hasChildren = allTasks.some(t => t.parentTaskId === activeTask.id);
    if (hasChildren) {
      // Active task is a parent — new task becomes its child
      setForm(f => ({ ...f, parentTaskId: activeTask.id }));
    } else if (activeTask.parentTaskId) {
      // Active task is a child — new task becomes sibling (same parent)
      setForm(f => ({ ...f, parentTaskId: activeTask.parentTaskId || '' }));
    }
    // If active task is a top-level leaf, no parent pre-fill
  }, [isEdit, activeTaskId, allTasks]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
    setForm((prev) => ({ ...prev, progressPercentage: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  // Filter tasks for dependency/parent dropdowns (exclude self)
  const otherTasks = allTasks.filter((t) => t.id !== task?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Task' : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Task Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Site Survey & Analysis"
              className="input w-full"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              placeholder="Brief description of the task..."
              className="input w-full resize-none"
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="pending">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
          </div>

          {/* Progress + Estimated Days */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Progress: {form.progressPercentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.progressPercentage}
                onChange={handleProgressChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Est. Duration (days)
              </label>
              <input
                type="number"
                name="estimatedDays"
                value={form.estimatedDays}
                onChange={handleChange}
                min="1"
                placeholder="—"
                className="input w-full"
              />
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
            <input
              type="text"
              name="assignedTo"
              value={form.assignedTo}
              onChange={handleChange}
              placeholder="Person or team name"
              className="input w-full"
            />
          </div>

          {/* Parent Task + Dependency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parent Task</label>
              <select
                name="parentTaskId"
                value={form.parentTaskId}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="">None (top-level)</option>
                {otherTasks
                  .filter((t) => !t.parentTaskId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Depends On
              </label>
              <select
                name="dependency"
                value={form.dependency}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="">None</option>
                {otherTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dependency Type + Lag (visible when a dependency is selected) */}
          {form.dependency && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dependency Type</label>
                <select
                  name="dependencyType"
                  value={form.dependencyType}
                  onChange={handleChange}
                  className="input w-full"
                >
                  <option value="FS">Finish-to-Start (FS)</option>
                  <option value="SS">Start-to-Start (SS)</option>
                  <option value="FF">Finish-to-Finish (FF)</option>
                  <option value="SF">Start-to-Finish (SF)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lag (days)</label>
                <input
                  type="number"
                  name="dependencyLagDays"
                  value={form.dependencyLagDays}
                  onChange={handleChange}
                  placeholder="0"
                  className="input w-full"
                />
              </div>
            </div>
          )}

          {/* Milestone checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isMilestone}
              onChange={(e) => setForm((prev) => ({ ...prev, isMilestone: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs font-medium text-gray-600">Mark as Milestone</span>
          </label>

          {/* Recurrence */}
          <RecurrenceSection form={form} setForm={setForm} isRecurringInstance={!!(task as any)?.recurrenceParentId} />

          {/* Time Tracking (edit mode only) */}
          {isEdit && scheduleId && projectId && task && (
            <TimeLogForm taskId={task.id} scheduleId={scheduleId} projectId={projectId} />
          )}

          {/* Custom Fields (edit mode only) */}
          {isEdit && projectId && task && (
            <CustomFieldsSection entityType="task" entityId={task.id} projectId={projectId} />
          )}

          {/* Attachments (edit mode only) */}
          {isEdit && task && (
            <AttachmentPanel entityType="task" entityId={task.id} />
          )}

          {/* Comments & Activity (edit mode only) */}
          {isEdit && scheduleId && task && (
            <TaskActivityPanel scheduleId={scheduleId} taskId={task.id} />
          )}
        </form>

        {/* Footer buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div>
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (task && confirm('Delete this task?')) {
                    onDelete(task.id);
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSaving || !form.name.trim()}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update Task' : 'Create Task'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recurrence section
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = [
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
  { key: 'SU', label: 'Sun' },
];

function parseFrequency(rule: string): string {
  if (!rule) return 'none';
  if (rule.startsWith('FREQ=DAILY')) return 'daily';
  if (rule.startsWith('FREQ=BIWEEKLY')) return 'biweekly';
  if (rule.startsWith('FREQ=WEEKLY')) return 'weekly';
  if (rule.startsWith('FREQ=MONTHLY')) return 'monthly';
  return 'none';
}

function parseDays(rule: string): string[] {
  const match = rule.match(/BYDAY=([A-Z,]+)/);
  return match ? match[1].split(',') : [];
}

function buildRule(freq: string, days: string[]): string {
  if (freq === 'none') return '';
  let rule = `FREQ=${freq.toUpperCase()}`;
  if ((freq === 'weekly' || freq === 'biweekly') && days.length > 0) {
    rule += `;BYDAY=${days.join(',')}`;
  }
  return rule;
}

function RecurrenceSection({
  form,
  setForm,
  isRecurringInstance,
}: {
  form: TaskFormData;
  setForm: React.Dispatch<React.SetStateAction<TaskFormData>>;
  isRecurringInstance: boolean;
}) {
  const freq = parseFrequency(form.recurrenceRule);
  const selectedDays = parseDays(form.recurrenceRule);

  if (isRecurringInstance) {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
        <span className="text-xs text-blue-700 font-medium">This is a recurring task instance</span>
      </div>
    );
  }

  const setFreq = (newFreq: string) => {
    const rule = buildRule(newFreq, selectedDays);
    setForm(prev => ({
      ...prev,
      recurrenceRule: rule,
      isRecurrenceTemplate: newFreq !== 'none',
    }));
  };

  const toggleDay = (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    const rule = buildRule(freq, newDays);
    setForm(prev => ({ ...prev, recurrenceRule: rule }));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Recurrence</label>
      <div className="flex items-center gap-3">
        <select
          value={freq}
          onChange={e => setFreq(e.target.value)}
          className="input"
        >
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>

        {(freq === 'weekly' || freq === 'biweekly') && (
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map(d => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  selectedDays.includes(d.key)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
