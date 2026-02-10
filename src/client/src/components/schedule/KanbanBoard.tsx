import React, { useState, useCallback } from 'react';

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
}

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onTaskClick?: (task: KanbanTask) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
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

export function KanbanBoard({ tasks, onTaskClick, onStatusChange }: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">Kanban Board</h3>
        <span className="text-xs text-gray-400">{tasks.length} tasks</span>
      </div>

      <div className="flex gap-3 p-4 overflow-x-auto" style={{ minHeight: '400px' }}>
        {COLUMNS.map((col) => {
          const columnTasks = grouped[col.id] || [];
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              className={`flex-1 min-w-[240px] rounded-lg border ${col.border} ${col.bg} transition-all ${
                isOver ? 'ring-2 ring-indigo-400 ring-opacity-50' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/60">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>
                    {col.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 bg-white rounded-full w-5 h-5 flex items-center justify-center">
                  {columnTasks.length}
                </span>
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
                      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group"
                    >
                      {/* Title */}
                      <div className="text-xs font-medium text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {task.name}
                      </div>

                      {/* Priority + Due date */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${pBadge.bg} ${pBadge.text} capitalize`}>
                          {task.priority || 'medium'}
                        </span>

                        {due && (
                          <span className={`text-[10px] ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                            {overdue ? 'Overdue ' : ''}{formatDate(due)}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {(task.progressPercentage ?? 0) > 0 && task.status !== 'completed' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
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
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold">
                            {getInitials(task.assignedTo)}
                          </div>
                          <span className="text-[10px] text-gray-500 truncate">{task.assignedTo}</span>
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
