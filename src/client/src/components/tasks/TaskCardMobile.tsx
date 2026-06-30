import React from 'react';
import { Calendar, User } from 'lucide-react';

interface TaskCardMobileProps {
  task: {
    id: string;
    name: string;
    status: string;
    priority?: string;
    assignedTo?: string;
    endDate?: string;
  };
  onStatusCycle?: (taskId: string, newStatus: string) => void;
  onClick?: (taskId: string) => void;
}

const statusCycle: Record<string, string> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
};

const statusStyles: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  blocked: 'bg-orange-100 text-orange-700',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
};

const priorityStyles: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
};

export const TaskCardMobile: React.FC<TaskCardMobileProps> = ({ task, onStatusCycle, onClick }) => {
  const handleStatusTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStatusCycle && task.status !== 'cancelled') {
      const nextStatus = statusCycle[task.status] || 'pending';
      onStatusCycle(task.id, nextStatus);
    }
  };

  return (
    <div
      onClick={() => onClick?.(task.id)}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 min-h-[56px] active:bg-gray-50 dark:active:bg-gray-750 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.name}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.assignedTo && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <User className="w-3 h-3" />
                {task.assignedTo}
              </span>
            )}
            {task.endDate && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {task.endDate.substring(0, 10)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {task.priority && (
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${priorityStyles[task.priority] || 'bg-gray-100 text-gray-600'}`}>
              {task.priority}
            </span>
          )}
          <button
            onClick={handleStatusTap}
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[task.status] || 'bg-gray-100 text-gray-700'}`}
          >
            {statusLabels[task.status] || task.status}
          </button>
        </div>
      </div>
    </div>
  );
};
