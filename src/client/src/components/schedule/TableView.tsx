import { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import type { GanttTask } from './GanttChart';

const barColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
  pending: { bg: 'bg-gray-100', text: 'text-gray-600' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-600' },
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

type SortField = 'name' | 'status' | 'priority' | 'startDate' | 'endDate' | 'progressPercentage' | 'assignedTo';
type SortDir = 'asc' | 'desc';

interface TableViewProps {
  tasks: GanttTask[];
  onTaskClick: (task: GanttTask) => void;
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => void;
}

const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled'];
const priorityOptions = ['low', 'medium', 'high', 'urgent'];

export function TableView({ tasks, onTaskClick, onTaskUpdate }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let va: any, vb: any;
      switch (sortField) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'status': va = a.status; vb = b.status; break;
        case 'priority': {
          const order = { urgent: 0, high: 1, medium: 2, low: 3 };
          va = order[(a.priority || 'medium') as keyof typeof order] ?? 2;
          vb = order[(b.priority || 'medium') as keyof typeof order] ?? 2;
          break;
        }
        case 'startDate': va = a.startDate || ''; vb = b.startDate || ''; break;
        case 'endDate': va = a.endDate || ''; vb = b.endDate || ''; break;
        case 'progressPercentage': va = a.progressPercentage ?? 0; vb = b.progressPercentage ?? 0; break;
        case 'assignedTo': va = (a.assignedTo || '').toLowerCase(); vb = (b.assignedTo || '').toLowerCase(); break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tasks, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-indigo-600" />
      : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  };

  const handleInlineChange = (taskId: string, field: string, value: unknown) => {
    onTaskUpdate(taskId, { [field]: value });
    setEditingCell(null);
  };

  const formatDate = (d?: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const columns: { key: SortField; label: string; width: string }[] = [
    { key: 'name', label: 'Task Name', width: 'min-w-[200px]' },
    { key: 'status', label: 'Status', width: 'w-28' },
    { key: 'priority', label: 'Priority', width: 'w-24' },
    { key: 'startDate', label: 'Start', width: 'w-28' },
    { key: 'endDate', label: 'End', width: 'w-28' },
    { key: 'progressPercentage', label: 'Progress', width: 'w-28' },
    { key: 'assignedTo', label: 'Assignee', width: 'w-32' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 select-none ${col.width}`}
                  onClick={() => toggleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} />
                  </div>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(task => {
              const statusStyle = barColors[task.status] || barColors.pending;
              const priorityStyle = priorityColors[task.priority || 'medium'] || priorityColors.medium;
              const progress = task.progressPercentage ?? 0;

              return (
                <tr
                  key={task.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group"
                >
                  {/* Name */}
                  <td
                    className="px-3 py-2 font-medium text-gray-900 cursor-pointer hover:text-indigo-600"
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="flex items-center gap-2">
                      {task.parentTaskId && <span className="text-gray-300 ml-3">└</span>}
                      {task.name}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2" onDoubleClick={() => setEditingCell({ taskId: task.id, field: 'status' })}>
                    {editingCell?.taskId === task.id && editingCell.field === 'status' ? (
                      <select
                        autoFocus
                        className="text-xs border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        defaultValue={task.status}
                        onChange={e => handleInlineChange(task.id, 'status', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                      >
                        {statusOptions.map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-2" onDoubleClick={() => setEditingCell({ taskId: task.id, field: 'priority' })}>
                    {editingCell?.taskId === task.id && editingCell.field === 'priority' ? (
                      <select
                        autoFocus
                        className="text-xs border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        defaultValue={task.priority || 'medium'}
                        onChange={e => handleInlineChange(task.id, 'priority', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                      >
                        {priorityOptions.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${priorityStyle}`}>
                        {task.priority || 'medium'}
                      </span>
                    )}
                  </td>

                  {/* Start Date */}
                  <td className="px-3 py-2 text-xs text-gray-600" onDoubleClick={() => setEditingCell({ taskId: task.id, field: 'startDate' })}>
                    {editingCell?.taskId === task.id && editingCell.field === 'startDate' ? (
                      <input
                        type="date"
                        autoFocus
                        className="text-xs border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        defaultValue={task.startDate?.split('T')[0] || ''}
                        onChange={e => handleInlineChange(task.id, 'startDate', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                      />
                    ) : (
                      formatDate(task.startDate)
                    )}
                  </td>

                  {/* End Date */}
                  <td className="px-3 py-2 text-xs text-gray-600" onDoubleClick={() => setEditingCell({ taskId: task.id, field: 'endDate' })}>
                    {editingCell?.taskId === task.id && editingCell.field === 'endDate' ? (
                      <input
                        type="date"
                        autoFocus
                        className="text-xs border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        defaultValue={task.endDate?.split('T')[0] || ''}
                        onChange={e => handleInlineChange(task.id, 'endDate', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                      />
                    ) : (
                      formatDate(task.endDate)
                    )}
                  </td>

                  {/* Progress */}
                  <td className="px-3 py-2" onDoubleClick={() => setEditingCell({ taskId: task.id, field: 'progressPercentage' })}>
                    {editingCell?.taskId === task.id && editingCell.field === 'progressPercentage' ? (
                      <input
                        type="number"
                        autoFocus
                        min={0}
                        max={100}
                        className="w-16 text-xs border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        defaultValue={progress}
                        onKeyDown={e => { if (e.key === 'Enter') handleInlineChange(task.id, 'progressPercentage', Number((e.target as HTMLInputElement).value)); }}
                        onBlur={e => handleInlineChange(task.id, 'progressPercentage', Number(e.target.value))}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-200 min-w-[40px]">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-7 text-right">{progress}%</span>
                      </div>
                    )}
                  </td>

                  {/* Assignee */}
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {task.assignedTo || '-'}
                  </td>

                  {/* Edit button */}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => onTaskClick(task)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all"
                      title="Edit task"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-sm text-gray-400">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
