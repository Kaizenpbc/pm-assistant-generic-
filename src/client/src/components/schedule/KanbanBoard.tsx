import React, { useState, useCallback, useEffect } from 'react';

export interface KanbanTask {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  dueDate?: string;
  endDate?: string;
  progressPercentage?: number;
  isMilestone?: boolean;
}

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onTaskClick?: (task: KanbanTask) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  scheduleId?: string;
  activeTaskId?: string | null;
}

const COLUMNS: { id: string; label: string; color: string; bg: string; border: string }[] = [
  { id: 'pending', label: 'Pending', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  { id: 'in_progress', label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'completed', label: 'Completed', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  { id: 'cancelled', label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
];

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityBadge: Record<string, { bg: string; text: string }> = {
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { bg: 'bg-green-100', text: 'text-green-700' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(s?: string): string {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function isOverdue(s?: string): boolean {
  if (!s) return false;
  try {
    return new Date(s).getTime() < Date.now();
  } catch {
    return false;
  }
}

const WIP_STORAGE_KEY = 'pm-kanban-wip-limits';

function loadWipLimits(scheduleId: string): Record<string, number> {
  try {
    const stored = localStorage.getItem(`${WIP_STORAGE_KEY}-${scheduleId}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveWipLimits(scheduleId: string, limits: Record<string, number>) {
  try {
    localStorage.setItem(`${WIP_STORAGE_KEY}-${scheduleId}`, JSON.stringify(limits));
  } catch {}
}

export function KanbanBoard({ tasks, onTaskClick, onStatusChange, scheduleId, activeTaskId }: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(() =>
    loadWipLimits(scheduleId || 'default')
  );

  useEffect(() => {
    saveWipLimits(scheduleId || 'default', wipLimits);
  }, [wipLimits, scheduleId]);

  const handleSetWipLimit = useCallback((columnId: string) => {
    const current = wipLimits[columnId] || 0;
    const input = prompt(`Set WIP limit for this column (0 = no limit):`, String(current));
    if (input === null) return;
    const val = parseInt(input, 10);
    if (isNaN(val) || val < 0) return;
    setWipLimits(prev => ({ ...prev, [columnId]: val }));
  }, [wipLimits]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, columnId: string) => {
      e.preventDefault();
      setDragOverColumn(null);
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId && onStatusChange) {
        const task = tasks.find((t) => t.id === taskId);
        if (task && task.status !== columnId) {
          onStatusChange(taskId, columnId);
        }
      }
    },
    [tasks, onStatusChange],
  );

  // Group tasks by status and sort by priority
  const grouped: Record<string, KanbanTask[]> = {};
  for (const col of COLUMNS) {
    grouped[col.id] = tasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => (priorityOrder[a.priority || 'medium'] ?? 2) - (priorityOrder[b.priority || 'medium'] ?? 2));
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Kanban Board</h3>
        <span className="text-xs text-gray-400">{tasks.length} tasks</span>
      </div>

      <div className="flex gap-3 p-4 overflow-x-auto" style={{ minHeight: '400px' }}>
        {COLUMNS.map((col) => {
          const columnTasks = grouped[col.id] || [];
          const isOver = dragOverColumn === col.id;
          const wipLimit = wipLimits[col.id] || 0;
          const isOverWip = wipLimit > 0 && columnTasks.length >= wipLimit;

          return (
            <div
              key={col.id}
              className={`flex-1 min-w-[240px] rounded-lg border ${col.border} ${col.bg} dark:bg-gray-800/50 dark:border-gray-600 transition-all ${
                isOver ? 'ring-2 ring-primary-400 ring-opacity-50' : ''
              } ${isOverWip ? 'ring-2 ring-amber-400' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-200/60 dark:border-gray-600 ${isOverWip ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${col.color} dark:opacity-90`}>
                    {col.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 ${isOverWip ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-300'}`}>
                    {columnTasks.length}{wipLimit > 0 ? `/${wipLimit}` : ''}
                  </span>
                  <button
                    onClick={() => handleSetWipLimit(col.id)}
                    className="text-gray-300 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    title="Set WIP limit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-400">
                    {isOver ? 'Drop here' : 'No tasks'}
                  </div>
                )}

                {columnTasks.map((task) => {
                  const pBadge = priorityBadge[task.priority || 'medium'] || priorityBadge.medium;
                  const due = task.dueDate || task.endDate;
                  const overdue = (task.status !== 'completed' && task.status !== 'cancelled') && isOverdue(due);

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onTaskClick?.(task)}
                      className={`bg-white dark:bg-gray-700 rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group ${activeTaskId === task.id ? 'border-primary-400 ring-1 ring-primary-200' : 'border-gray-200 dark:border-gray-600'}`}
                    >
                      {/* Title */}
                      <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors flex items-center gap-1.5">
                        {task.isMilestone && <span className="w-2.5 h-2.5 flex-shrink-0 rotate-45 bg-primary-500 inline-block" title="Milestone" />}
                        {task.name}
                      </div>

                      {/* Priority + Due date */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${pBadge.bg} ${pBadge.text} capitalize`}>
                          {task.priority || 'medium'}
                        </span>

                        {due && (
                          <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                            {overdue ? 'Overdue ' : ''}{formatDate(due)}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {(task.progressPercentage ?? 0) > 0 && task.status !== 'completed' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-0.5">
                            <span>Progress</span>
                            <span>{task.progressPercentage}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${Math.min(task.progressPercentage || 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Assignee */}
                      {task.assignedTo && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[8px] font-bold">
                            {getInitials(task.assignedTo)}
                          </div>
                          <span className="text-xs text-gray-500 truncate">{task.assignedTo}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
