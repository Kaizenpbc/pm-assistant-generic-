import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Kanban } from 'lucide-react';
import { apiService } from '../../services/api';

interface BoardTask {
  id: string;
  name: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  story_points?: number;
  storyPoints?: number;
}

interface SprintBoardProps {
  sprintId: string;
}

const COLUMNS: { id: string; label: string; headerBg: string; headerText: string; bg: string; border: string }[] = [
  { id: 'pending', label: 'Todo', headerBg: 'bg-gray-100', headerText: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  { id: 'in_progress', label: 'In Progress', headerBg: 'bg-blue-100', headerText: 'text-blue-700', bg: 'bg-blue-50/30', border: 'border-blue-200' },
  { id: 'completed', label: 'Done', headerBg: 'bg-green-100', headerText: 'text-green-700', bg: 'bg-green-50/30', border: 'border-green-200' },
];

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

function getPoints(task: BoardTask): number {
  return task.story_points ?? task.storyPoints ?? 0;
}

export function SprintBoard({ sprintId }: SprintBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [localTaskOverrides, setLocalTaskOverrides] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sprintBoard', sprintId],
    queryFn: () => apiService.getSprintBoard(sprintId),
  });

  const board = data?.board ?? data ?? {};
  const scheduleId: string | null = board.scheduleId ?? null;
  const rawTasks: BoardTask[] = board.tasks ?? [];
  // Apply local status overrides (optimistic drag-and-drop updates)
  const tasks: BoardTask[] = rawTasks.map((t) =>
    localTaskOverrides[t.id] ? { ...t, status: localTaskOverrides[t.id] } : t,
  );

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => {
      if (!scheduleId) return Promise.reject(new Error('No scheduleId available'));
      return apiService.updateTask(scheduleId, taskId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprintBoard', sprintId] });
    },
  });

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
      if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (task && task.status !== columnId) {
          // Optimistically update local state, then persist via API
          setLocalTaskOverrides((prev) => ({ ...prev, [taskId]: columnId }));
          updateStatusMutation.mutate({ taskId, status: columnId });
        }
      }
    },
    [tasks, updateStatusMutation],
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse flex gap-4">
          <div className="flex-1 h-48 bg-gray-100 rounded" />
          <div className="flex-1 h-48 bg-gray-100 rounded" />
          <div className="flex-1 h-48 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Failed to load sprint board.</p>
      </div>
    );
  }

  // Group by status
  const grouped: Record<string, BoardTask[]> = {};
  for (const col of COLUMNS) {
    grouped[col.id] = tasks.filter((t) => t.status === col.id);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <Kanban className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">Sprint Board</h3>
        <span className="text-xs text-gray-400">({tasks.length} tasks)</span>
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
              <div className={`flex items-center justify-between px-3 py-2.5 ${col.headerBg} rounded-t-lg`}>
                <span className={`text-xs font-semibold uppercase tracking-wide ${col.headerText}`}>
                  {col.label}
                </span>
                <span className="text-[10px] font-bold text-gray-500 bg-white rounded-full w-5 h-5 flex items-center justify-center">
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
                  const points = getPoints(task);

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                    >
                      {/* Title */}
                      <div className="text-xs font-medium text-gray-900 mb-2 line-clamp-2">
                        {task.name}
                      </div>

                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${pBadge.bg} ${pBadge.text} capitalize`}
                        >
                          {task.priority || 'medium'}
                        </span>
                        {points > 0 && (
                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                            {points} pts
                          </span>
                        )}
                      </div>

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
