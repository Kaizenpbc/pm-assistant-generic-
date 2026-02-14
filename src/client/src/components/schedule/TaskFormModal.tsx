import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import type { GanttTask } from './GanttChart';
import { TaskActivityPanel } from './TaskActivityPanel';

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
  parentTaskId: string;
  estimatedDays: string;
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
}: TaskFormModalProps) {
  const isEdit = !!task;
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key handler (WCAG 2.1.2, 2.4.3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: Tab key cycles through modal focusable elements
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Save previously focused element and restore on close
    const previouslyFocused = document.activeElement as HTMLElement;
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

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
      });
    }
  }, [task]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div ref={modalRef} className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="task-modal-title" className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Task' : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Task Name */}
          <div>
            <label htmlFor="task-name" className="block text-xs font-medium text-gray-600 mb-1">
              Task Name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="task-name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Site Survey & Analysis"
              className="input w-full"
              required
              autoFocus
              aria-required="true"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-description" className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <textarea
              id="task-description"
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
              <label htmlFor="task-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                id="task-status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="pending">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-priority" className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                id="task-priority"
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
              <label htmlFor="task-start-date" className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                id="task-start-date"
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
            <div>
              <label htmlFor="task-end-date" className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input
                id="task-end-date"
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
              <label htmlFor="task-progress" className="block text-xs font-medium text-gray-600 mb-1">
                Progress: {form.progressPercentage}%
              </label>
              <input
                id="task-progress"
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.progressPercentage}
                onChange={handleProgressChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <label htmlFor="task-est-days" className="block text-xs font-medium text-gray-600 mb-1">
                Est. Duration (days)
              </label>
              <input
                id="task-est-days"
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
            <label htmlFor="task-assigned-to" className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
            <input
              id="task-assigned-to"
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
              <label htmlFor="task-parent" className="block text-xs font-medium text-gray-600 mb-1">Parent Task</label>
              <select
                id="task-parent"
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
              <label htmlFor="task-dependency" className="block text-xs font-medium text-gray-600 mb-1">
                Depends On
              </label>
              <select
                id="task-dependency"
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
