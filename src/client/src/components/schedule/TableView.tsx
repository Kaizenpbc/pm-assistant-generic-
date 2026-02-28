import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, Loader2, X, Trash2, CheckSquare } from 'lucide-react';
import type { GanttTask } from './GanttChart';
import { apiService } from '../../services/api';

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
  scheduleId: string;
  onTaskClick: (task: GanttTask) => void;
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => void;
}

const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled'];
const priorityOptions = ['low', 'medium', 'high', 'urgent'];

type EditableField = 'name' | 'status' | 'priority' | 'startDate' | 'endDate' | 'progressPercentage' | 'assignedTo';

export function TableView({ tasks, scheduleId, onTaskClick, onTaskUpdate }: TableViewProps) {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<{ taskId: string; field: string } | null>(null);
  const [savedCell, setSavedCell] = useState<{ taskId: string; field: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus the input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  // Cleanup saved timer
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

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

  const getTaskFieldValue = (task: GanttTask, field: EditableField): string => {
    switch (field) {
      case 'name': return task.name || '';
      case 'status': return task.status || 'pending';
      case 'priority': return task.priority || 'medium';
      case 'startDate': return task.startDate?.split('T')[0] || '';
      case 'endDate': return task.endDate?.split('T')[0] || '';
      case 'progressPercentage': return String(task.progressPercentage ?? 0);
      case 'assignedTo': return task.assignedTo || '';
      default: return '';
    }
  };

  const startEditing = (taskId: string, field: EditableField, task: GanttTask) => {
    setEditingCell({ taskId, field });
    setEditValue(getTaskFieldValue(task, field));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = (taskId: string, field: EditableField, value: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalValue = getTaskFieldValue(task, field);
    // Don't save if unchanged
    if (value === originalValue) {
      cancelEditing();
      return;
    }

    const saveValue = field === 'progressPercentage'
      ? Math.max(0, Math.min(100, Number(value)))
      : value;

    setSavingCell({ taskId, field });
    setEditingCell(null);
    setEditValue('');

    onTaskUpdate(taskId, { [field]: saveValue });

    // Brief saving indicator, then show saved check
    setTimeout(() => {
      setSavingCell(null);
      setSavedCell({ taskId, field });
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedCell(null), 1200);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent, taskId: string, field: EditableField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(taskId, field, editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleSelectChange = (taskId: string, field: EditableField, value: string) => {
    setEditValue(value);
    saveEdit(taskId, field, value);
  };

  const handleDateChange = (taskId: string, field: EditableField, value: string) => {
    setEditValue(value);
    saveEdit(taskId, field, value);
  };

  const formatDate = (d?: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isEditing = (taskId: string, field: string) =>
    editingCell?.taskId === taskId && editingCell.field === field;

  const isSaving = (taskId: string, field: string) =>
    savingCell?.taskId === taskId && savingCell.field === field;

  const isSaved = (taskId: string, field: string) =>
    savedCell?.taskId === taskId && savedCell.field === field;

  const editableCellClass = (taskId: string, field: string) => {
    const base = 'relative cursor-pointer transition-all duration-150';
    if (isEditing(taskId, field)) return `${base} ring-2 ring-blue-400 ring-inset rounded`;
    if (isSaved(taskId, field)) return `${base} bg-green-50`;
    return `${base} hover:bg-blue-50/50 group/cell`;
  };

  // Selection helpers
  const allSelected = sorted.length > 0 && sorted.every(t => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(t => t.id)));
    }
  };

  const toggleSelect = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const showBulkSuccess = (msg: string) => {
    setBulkMessage(msg);
    setTimeout(() => setBulkMessage(''), 3000);
  };

  const clearBulkState = () => {
    setSelectedIds(new Set());
    setBulkStatus('');
    setBulkPriority('');
    setBulkAssignee('');
  };

  const applyBulkUpdate = async (field: string, value: string) => {
    if (!value || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(taskId =>
          apiService.updateTask(scheduleId, taskId, { [field]: value })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['tasks', scheduleId] });
      showBulkSuccess(`Updated ${selectedIds.size} task${selectedIds.size > 1 ? 's' : ''}`);
      clearBulkState();
    } catch (err) {
      console.error('Bulk update failed:', err);
      setBulkMessage('Some updates failed');
      setTimeout(() => setBulkMessage(''), 3000);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} task${selectedIds.size > 1 ? 's' : ''}? This will set them to cancelled.`
    );
    if (!confirmed) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(taskId =>
          apiService.updateTask(scheduleId, taskId, { status: 'cancelled' })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['tasks', scheduleId] });
      showBulkSuccess(`Deleted ${selectedIds.size} task${selectedIds.size > 1 ? 's' : ''}`);
      clearBulkState();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      setBulkMessage('Some deletes failed');
      setTimeout(() => setBulkMessage(''), 3000);
    } finally {
      setBulkLoading(false);
    }
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

  const renderSaveIndicator = (taskId: string, field: string) => {
    if (isSaving(taskId, field)) {
      return (
        <span className="absolute top-1 right-1">
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
        </span>
      );
    }
    if (isSaved(taskId, field)) {
      return (
        <span className="absolute top-1 right-1">
          <Check className="w-3 h-3 text-green-600" />
        </span>
      );
    }
    return null;
  };

  const renderHoverPencil = (taskId: string, field: string) => {
    if (isEditing(taskId, field) || isSaving(taskId, field) || isSaved(taskId, field)) return null;
    return (
      <span className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
        <Pencil className="w-2.5 h-2.5 text-gray-400" />
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="sticky top-0 z-10 bg-indigo-50 border border-indigo-200 rounded-lg p-3 m-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-700">{selectedIds.size} selected</span>
          </div>

          <div className="h-4 w-px bg-indigo-200" />

          {/* Change Status */}
          <div className="flex items-center gap-1">
            <select
              className="text-xs px-2 py-1 rounded border border-indigo-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              disabled={bulkLoading}
            >
              <option value="">Status...</option>
              {statusOptions.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            {bulkStatus && (
              <button
                className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
                onClick={() => applyBulkUpdate('status', bulkStatus)}
                disabled={bulkLoading}
              >
                Apply
              </button>
            )}
          </div>

          {/* Change Priority */}
          <div className="flex items-center gap-1">
            <select
              className="text-xs px-2 py-1 rounded border border-indigo-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={bulkPriority}
              onChange={e => setBulkPriority(e.target.value)}
              disabled={bulkLoading}
            >
              <option value="">Priority...</option>
              {priorityOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {bulkPriority && (
              <button
                className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
                onClick={() => applyBulkUpdate('priority', bulkPriority)}
                disabled={bulkLoading}
              >
                Apply
              </button>
            )}
          </div>

          {/* Assign To */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Assign to..."
              className="text-xs px-2 py-1 rounded border border-indigo-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
              value={bulkAssignee}
              onChange={e => setBulkAssignee(e.target.value)}
              disabled={bulkLoading}
              onKeyDown={e => { if (e.key === 'Enter' && bulkAssignee) applyBulkUpdate('assignedTo', bulkAssignee); }}
            />
            {bulkAssignee && (
              <button
                className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
                onClick={() => applyBulkUpdate('assignedTo', bulkAssignee)}
                disabled={bulkLoading}
              >
                Apply
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-indigo-200" />

          {/* Delete Selected */}
          <button
            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
            onClick={handleBulkDelete}
            disabled={bulkLoading}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>

          {/* Clear Selection */}
          <button
            className="text-xs px-2 py-1 rounded bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 flex items-center gap-1 ml-auto"
            onClick={clearBulkState}
          >
            <X className="w-3 h-3" />
            Clear
          </button>

          {/* Success / error message */}
          {bulkMessage && (
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
              {bulkMessage}
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Checkbox header */}
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                />
              </th>
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

              const isSelected = selectedIds.has(task.id);

              return (
                <tr
                  key={task.id}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors group ${isSelected ? 'bg-indigo-50/40' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(task.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                  </td>

                  {/* Name */}
                  <td
                    className={`px-3 py-2 font-medium text-gray-900 ${editableCellClass(task.id, 'name')}`}
                    onClick={() => {
                      if (!isEditing(task.id, 'name')) startEditing(task.id, 'name', task);
                    }}
                  >
                    {isEditing(task.id, 'name') ? (
                      <input
                        ref={el => { inputRef.current = el; }}
                        type="text"
                        className="w-full text-sm border-0 bg-transparent px-0 py-0 focus:outline-none focus:ring-0 font-medium text-gray-900"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, task.id, 'name')}
                        onBlur={() => saveEdit(task.id, 'name', editValue)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {task.parentTaskId && <span className="text-gray-300 ml-3">&lsaquo;</span>}
                        {task.name}
                      </div>
                    )}
                    {renderSaveIndicator(task.id, 'name')}
                    {renderHoverPencil(task.id, 'name')}
                  </td>

                  {/* Status */}
                  <td
                    className={`px-3 py-2 ${editableCellClass(task.id, 'status')}`}
                    onClick={() => {
                      if (!isEditing(task.id, 'status')) startEditing(task.id, 'status', task);
                    }}
                  >
                    {isEditing(task.id, 'status') ? (
                      <select
                        ref={el => { inputRef.current = el; }}
                        className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={editValue}
                        onChange={e => handleSelectChange(task.id, 'status', e.target.value)}
                        onBlur={() => cancelEditing()}
                        onKeyDown={e => {
                          if (e.key === 'Escape') cancelEditing();
                        }}
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
                    {renderSaveIndicator(task.id, 'status')}
                    {renderHoverPencil(task.id, 'status')}
                  </td>

                  {/* Priority */}
                  <td
                    className={`px-3 py-2 ${editableCellClass(task.id, 'priority')}`}
                    onClick={() => {
                      if (!isEditing(task.id, 'priority')) startEditing(task.id, 'priority', task);
                    }}
                  >
                    {isEditing(task.id, 'priority') ? (
                      <select
                        ref={el => { inputRef.current = el; }}
                        className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={editValue}
                        onChange={e => handleSelectChange(task.id, 'priority', e.target.value)}
                        onBlur={() => cancelEditing()}
                        onKeyDown={e => {
                          if (e.key === 'Escape') cancelEditing();
                        }}
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
                    {renderSaveIndicator(task.id, 'priority')}
                    {renderHoverPencil(task.id, 'priority')}
                  </td>

                  {/* Start Date */}
                  <td
                    className={`px-3 py-2 text-xs text-gray-600 ${editableCellClass(task.id, 'startDate')}`}
                    onClick={() => {
                      if (!isEditing(task.id, 'startDate')) startEditing(task.id, 'startDate', task);
                    }}
                  >
                    {isEditing(task.id, 'startDate') ? (
                      <input
                        ref={el => { inputRef.current = el; }}
                        type="date"
                        className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={editValue}
                        onChange={e => handleDateChange(task.id, 'startDate', e.target.value)}
                        onBlur={() => cancelEditing()}
                        onKeyDown={e => {
                          if (e.key === 'Escape') cancelEditing();
                        }}
                      />
                    ) : (
                      formatDate(task.startDate)
                    )}
                    {renderSaveIndicator(task.id, 'startDate')}
                    {renderHoverPencil(task.id, 'startDate')}
                  </td>

                  {/* End Date */}
                  <td
                    className={`px-3 py-2 text-xs text-gray-600 ${editableCellClass(task.id, 'endDate')}`}
                    onClick={() => {
                      if (!isEditing(task.id, 'endDate')) startEditing(task.id, 'endDate', task);
                    }}
                  >
                    {isEditing(task.id, 'endDate') ? (
                      <input
                        ref={el => { inputRef.current = el; }}
                        type="date"
                        className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={editValue}
                        onChange={e => handleDateChange(task.id, 'endDate', e.target.value)}
                        onBlur={() => cancelEditing()}
                        onKeyDown={e => {
                          if (e.key === 'Escape') cancelEditing();
                        }}
                      />
                    ) : (
                      formatDate(task.endDate)
                    )}
                    {renderSaveIndicator(task.id, 'endDate')}
                    {renderHoverPencil(task.id, 'endDate')}
                  </td>

                  {/* Progress */}
                  <td
                    className={`px-3 py-2 ${editableCellClass(task.id, 'progressPercentage')}`}
                    onClick={() => {
                      if (!isEditing(task.id, 'progressPercentage')) startEditing(task.id, 'progressPercentage', task);
                    }}
                  >
                    {isEditing(task.id, 'progressPercentage') ? (
                      <input
                        ref={el => { inputRef.current = el; }}
                        type="number"
                        min={0}
                        max={100}
                        className="w-16 text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, task.id, 'progressPercentage')}
                        onBlur={() => saveEdit(task.id, 'progressPercentage', editValue)}
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
                    {renderSaveIndicator(task.id, 'progressPercentage')}
                    {renderHoverPencil(task.id, 'progressPercentage')}
                  </td>

                  {/* Assignee */}
                  <td
                    className={`px-3 py-2 text-xs text-gray-600 ${editableCellClass(task.id, 'assignedTo')}`}
                    onClick={() => {
                      if (!isEditing(task.id, 'assignedTo')) startEditing(task.id, 'assignedTo', task);
                    }}
                  >
                    {isEditing(task.id, 'assignedTo') ? (
                      <input
                        ref={el => { inputRef.current = el; }}
                        type="text"
                        className="w-full text-xs border-0 bg-transparent px-0 py-0 focus:outline-none focus:ring-0 text-gray-600"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, task.id, 'assignedTo')}
                        onBlur={() => saveEdit(task.id, 'assignedTo', editValue)}
                      />
                    ) : (
                      task.assignedTo || '-'
                    )}
                    {renderSaveIndicator(task.id, 'assignedTo')}
                    {renderHoverPencil(task.id, 'assignedTo')}
                  </td>

                  {/* Edit button (opens full modal) */}
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
                <td colSpan={9} className="text-center py-8 text-sm text-gray-400">
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
