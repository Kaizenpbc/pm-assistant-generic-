import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, Loader2, X, Trash2, CheckSquare } from 'lucide-react';
import type { GanttTask } from './GanttChart';
import { apiService } from '../../services/api';
import { ColumnPickerDropdown } from './ColumnPickerDropdown';
import { SavedViewsDropdown, type SavedView } from './SavedViewsDropdown';
import { COLUMN_DEFS, DEFAULT_VISIBLE_KEYS, SCHEDULING_KEYS } from './tableColumns';
import type { ColumnKey, ColumnGroup, ColumnDef } from './tableColumns';

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

type SortDir = 'asc' | 'desc';

interface CpmTaskData {
  taskId: string;
  ES: number;
  EF: number;
  LS: number;
  LF: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

interface BaselineTaskVariance {
  taskId: string;
  baselineStart?: string;
  baselineEnd?: string;
  startVarianceDays?: number;
  endVarianceDays?: number;
}

interface TableViewProps {
  tasks: GanttTask[];
  scheduleId: string;
  onTaskClick: (task: GanttTask) => void;
  onTaskUpdate: (taskId: string, data: Record<string, unknown>) => void;
  cpmData?: { tasks: CpmTaskData[]; criticalPathTaskIds: string[] };
  baselineData?: { taskVariances: BaselineTaskVariance[] };
  scheduleStartDate?: string;
  onCpmNeeded?: (needed: boolean) => void;
}

const statusOptions = ['pending', 'in_progress', 'completed'];
const priorityOptions = ['low', 'medium', 'high', 'urgent'];

type EditableField = 'name' | 'status' | 'priority' | 'startDate' | 'endDate' | 'progressPercentage' | 'assignedTo';

function addDaysToDate(baseDate: string, days: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TableView({ tasks, scheduleId, onTaskClick, onTaskUpdate, cpmData, baselineData, scheduleStartDate, onCpmNeeded }: TableViewProps) {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<ColumnKey>('startDate');
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

  // Column visibility state — persisted per schedule
  const [visibleKeys, setVisibleKeys] = useState<Set<ColumnKey>>(() => {
    try {
      const stored = localStorage.getItem(`tableview-cols:${scheduleId}`);
      if (stored) {
        const arr = JSON.parse(stored) as ColumnKey[];
        return new Set(arr);
      }
    } catch { /* ignore */ }
    return new Set(DEFAULT_VISIBLE_KEYS);
  });

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(`tableview-cols:${scheduleId}`, JSON.stringify([...visibleKeys]));
  }, [visibleKeys, scheduleId]);

  // Notify parent when CPM columns are visible
  useEffect(() => {
    if (!onCpmNeeded) return;
    const needsCpm = [...visibleKeys].some(k => SCHEDULING_KEYS.has(k));
    onCpmNeeded(needsCpm);
  }, [visibleKeys, onCpmNeeded]);

  const toggleColumn = useCallback((key: ColumnKey) => {
    if (key === 'name') return; // always visible
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((group: ColumnGroup, visible: boolean) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      for (const col of COLUMN_DEFS) {
        if (col.group === group && col.key !== 'name') {
          if (visible) next.add(col.key);
          else next.delete(col.key);
        }
      }
      return next;
    });
  }, []);

  const loadSavedView = useCallback((view: SavedView) => {
    setVisibleKeys(new Set(view.columns));
    setSortField(view.sortField);
    setSortDir(view.sortDir);
  }, []);

  const visibleColumns = useMemo(() =>
    COLUMN_DEFS.filter(c => visibleKeys.has(c.key)),
  [visibleKeys]);

  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus();
  }, [editingCell]);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // CPM lookup map
  const cpmMap = useMemo(() => {
    const map = new Map<string, CpmTaskData>();
    if (cpmData?.tasks) {
      for (const t of cpmData.tasks) map.set(t.taskId, t);
    }
    return map;
  }, [cpmData]);

  // Baseline lookup map
  const baselineMap = useMemo(() => {
    const map = new Map<string, BaselineTaskVariance>();
    if (baselineData?.taskVariances) {
      for (const t of baselineData.taskVariances) map.set(t.taskId, t);
    }
    return map;
  }, [baselineData]);

  // WBS computation
  const wbsMap = useMemo(() => {
    const map = new Map<string, string>();
    // Group tasks by parent
    const childrenOf = new Map<string | null, GanttTask[]>();
    for (const t of tasks) {
      const parent = t.parentTaskId || null;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(t);
    }
    const assign = (parentId: string | null, prefix: string) => {
      const children = childrenOf.get(parentId) || [];
      children.forEach((child, idx) => {
        const wbs = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
        map.set(child.id, wbs);
        assign(child.id, wbs);
      });
    };
    assign(null, '');
    return map;
  }, [tasks]);

  const toggleSort = useCallback((field: ColumnKey) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  // Get a sortable value for any column
  const getSortValue = useCallback((task: GanttTask, field: ColumnKey): any => {
    switch (field) {
      case 'name': return task.name.toLowerCase();
      case 'status': return task.status;
      case 'priority': {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return order[(task.priority || 'medium') as keyof typeof order] ?? 2;
      }
      case 'startDate': return task.startDate || '';
      case 'endDate': return task.endDate || '';
      case 'progressPercentage': return task.progressPercentage ?? 0;
      case 'assignedTo': return (task.assignedTo || '').toLowerCase();
      case 'duration': return task.estimatedDays ?? 0;
      case 'earlyStart': return cpmMap.get(task.id)?.ES ?? Infinity;
      case 'earlyFinish': return cpmMap.get(task.id)?.EF ?? Infinity;
      case 'lateStart': return cpmMap.get(task.id)?.LS ?? Infinity;
      case 'lateFinish': return cpmMap.get(task.id)?.LF ?? Infinity;
      case 'totalFloat': return cpmMap.get(task.id)?.totalFloat ?? Infinity;
      case 'freeFloat': return cpmMap.get(task.id)?.freeFloat ?? Infinity;
      case 'critical': return cpmMap.get(task.id)?.isCritical ? 0 : 1;
      case 'baselineStart': return baselineMap.get(task.id)?.baselineStart || '';
      case 'baselineEnd': return baselineMap.get(task.id)?.baselineEnd || '';
      case 'startVariance': return baselineMap.get(task.id)?.startVarianceDays ?? Infinity;
      case 'endVariance': return baselineMap.get(task.id)?.endVarianceDays ?? Infinity;
      default: return '';
    }
  }, [cpmMap, baselineMap]);

  // Build hierarchical ordering: parents followed by their children, recursively
  const levelMap = useMemo(() => {
    const map = new Map<string, number>();
    const taskIds = new Set(tasks.map(t => t.id));
    const childrenOf = new Map<string | null, GanttTask[]>();
    for (const t of tasks) {
      const parent = (t.parentTaskId && taskIds.has(t.parentTaskId)) ? t.parentTaskId : null;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(t);
    }
    const assign = (parentId: string | null, level: number) => {
      const children = childrenOf.get(parentId) || [];
      for (const child of children) {
        map.set(child.id, level);
        assign(child.id, level + 1);
      }
    };
    assign(null, 0);
    return map;
  }, [tasks]);

  const sorted = useMemo(() => {
    const taskIds = new Set(tasks.map(t => t.id));
    const childrenOf = new Map<string | null, GanttTask[]>();
    for (const t of tasks) {
      const parent = (t.parentTaskId && taskIds.has(t.parentTaskId)) ? t.parentTaskId : null;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(t);
    }

    // Sort children within each group
    const sortChildren = (list: GanttTask[]) => {
      return [...list].sort((a, b) => {
        const va = getSortValue(a, sortField);
        const vb = getSortValue(b, sortField);
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    };

    const result: GanttTask[] = [];
    const flatten = (parentId: string | null) => {
      const children = childrenOf.get(parentId);
      if (!children) return;
      for (const child of sortChildren(children)) {
        result.push(child);
        flatten(child.id);
      }
    };
    flatten(null);
    return result;
  }, [tasks, sortField, sortDir, getSortValue]);

  const SortIcon = ({ field }: { field: ColumnKey }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-600" />
      : <ArrowDown className="w-3 h-3 text-primary-600" />;
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
    if (value === originalValue) { cancelEditing(); return; }

    const saveValue = field === 'progressPercentage'
      ? Math.max(0, Math.min(100, Number(value)))
      : value;

    setSavingCell({ taskId, field });
    setEditingCell(null);
    setEditValue('');

    onTaskUpdate(taskId, { [field]: saveValue });

    setTimeout(() => {
      setSavingCell(null);
      setSavedCell({ taskId, field });
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedCell(null), 1200);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent, taskId: string, field: EditableField) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(taskId, field, editValue); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
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
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map(t => t.id)));
  };

  const toggleSelect = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
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
      `Are you sure you want to delete ${selectedIds.size} task${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`
    );
    if (!confirmed) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(taskId =>
          apiService.deleteTask(scheduleId, taskId)
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

  // Format a CPM offset as a date or "Day N"
  const formatCpmDate = (offset: number | undefined): string => {
    if (offset === undefined) return '-';
    if (scheduleStartDate) return addDaysToDate(scheduleStartDate, offset);
    return `Day ${offset}`;
  };

  // Render a variance badge (positive = late, negative = early)
  const renderVarianceBadge = (days: number | undefined): React.ReactNode => {
    if (days === undefined || days === null) return '-';
    if (days === 0) return <span className="text-xs text-gray-500">0d</span>;
    const color = days > 0 ? 'text-red-600' : 'text-green-600';
    const prefix = days > 0 ? '+' : '';
    return <span className={`text-xs font-medium ${color}`}>{prefix}{days}d</span>;
  };

  // Render a single cell for a given column definition
  const renderCell = (task: GanttTask, col: ColumnDef): React.ReactNode => {
    const statusStyle = barColors[task.status] || barColors.pending;
    const priorityStyle = priorityColors[task.priority || 'medium'] || priorityColors.medium;
    const progress = task.progressPercentage ?? 0;
    const cpm = cpmMap.get(task.id);
    const baseline = baselineMap.get(task.id);

    switch (col.key) {
      case 'name':
        return (
          <td
            key={col.key}
            className={`px-3 py-2 font-medium text-gray-900 min-w-[200px] ${editableCellClass(task.id, 'name')}`}
            onClick={() => { if (!isEditing(task.id, 'name')) startEditing(task.id, 'name', task); }}
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
              <div className="flex items-center gap-2" style={{ paddingLeft: `${(levelMap.get(task.id) || 0) * 20}px` }}>
                {(task as any).isMilestone && (
                  <span className="inline-block w-2.5 h-2.5 rotate-45 bg-amber-500 flex-shrink-0" title="Milestone" />
                )}
                {(levelMap.get(task.id) || 0) > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.parentTaskId ? 'bg-gray-300' : ''}`} />
                )}
                <span className={(levelMap.get(task.id) || 0) === 0 ? 'font-semibold' : ''}>{task.name}</span>
              </div>
            )}
            {renderSaveIndicator(task.id, 'name')}
            {renderHoverPencil(task.id, 'name')}
          </td>
        );

      case 'status':
        return (
          <td
            key={col.key}
            className={`px-3 py-2 w-28 ${editableCellClass(task.id, 'status')}`}
            onClick={() => { if (!isEditing(task.id, 'status')) startEditing(task.id, 'status', task); }}
          >
            {isEditing(task.id, 'status') ? (
              <select
                ref={el => { inputRef.current = el; }}
                className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                value={editValue}
                onChange={e => handleSelectChange(task.id, 'status', e.target.value)}
                onBlur={() => cancelEditing()}
                onKeyDown={e => { if (e.key === 'Escape') cancelEditing(); }}
              >
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            ) : (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                {task.status.replace('_', ' ')}
              </span>
            )}
            {renderSaveIndicator(task.id, 'status')}
            {renderHoverPencil(task.id, 'status')}
          </td>
        );

      case 'priority':
        return (
          <td
            key={col.key}
            className={`px-3 py-2 w-24 ${editableCellClass(task.id, 'priority')}`}
            onClick={() => { if (!isEditing(task.id, 'priority')) startEditing(task.id, 'priority', task); }}
          >
            {isEditing(task.id, 'priority') ? (
              <select
                ref={el => { inputRef.current = el; }}
                className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                value={editValue}
                onChange={e => handleSelectChange(task.id, 'priority', e.target.value)}
                onBlur={() => cancelEditing()}
                onKeyDown={e => { if (e.key === 'Escape') cancelEditing(); }}
              >
                {priorityOptions.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${priorityStyle}`}>
                {task.priority || 'medium'}
              </span>
            )}
            {renderSaveIndicator(task.id, 'priority')}
            {renderHoverPencil(task.id, 'priority')}
          </td>
        );

      case 'startDate':
        return (
          <td
            key={col.key}
            className={`px-3 py-2 text-xs text-gray-600 w-28 ${editableCellClass(task.id, 'startDate')}`}
            onClick={() => { if (!isEditing(task.id, 'startDate')) startEditing(task.id, 'startDate', task); }}
          >
            {isEditing(task.id, 'startDate') ? (
              <input
                ref={el => { inputRef.current = el; }}
                type="date"
                className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                value={editValue}
                onChange={e => handleDateChange(task.id, 'startDate', e.target.value)}
                onBlur={() => cancelEditing()}
                onKeyDown={e => { if (e.key === 'Escape') cancelEditing(); }}
              />
            ) : (
              formatDate(task.startDate)
            )}
            {renderSaveIndicator(task.id, 'startDate')}
            {renderHoverPencil(task.id, 'startDate')}
          </td>
        );

      case 'endDate':
        return (
          <td
            key={col.key}
            className={`px-3 py-2 text-xs text-gray-600 w-28 ${editableCellClass(task.id, 'endDate')}`}
            onClick={() => { if (!isEditing(task.id, 'endDate')) startEditing(task.id, 'endDate', task); }}
          >
            {isEditing(task.id, 'endDate') ? (
              <input
                ref={el => { inputRef.current = el; }}
                type="date"
                className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                value={editValue}
                onChange={e => handleDateChange(task.id, 'endDate', e.target.value)}
                onBlur={() => cancelEditing()}
                onKeyDown={e => { if (e.key === 'Escape') cancelEditing(); }}
              />
            ) : (
              formatDate(task.endDate)
            )}
            {renderSaveIndicator(task.id, 'endDate')}
            {renderHoverPencil(task.id, 'endDate')}
          </td>
        );

      case 'progressPercentage':
        return (
          <td
            key={col.key}
            className={`px-3 py-2 w-28 ${editableCellClass(task.id, 'progressPercentage')}`}
            onClick={() => { if (!isEditing(task.id, 'progressPercentage')) startEditing(task.id, 'progressPercentage', task); }}
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
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-7 text-right">{progress}%</span>
              </div>
            )}
            {renderSaveIndicator(task.id, 'progressPercentage')}
            {renderHoverPencil(task.id, 'progressPercentage')}
          </td>
        );

      case 'assignedTo':
        return (
          <td
            key={col.key}
            className={`px-3 py-2 text-xs text-gray-600 w-32 ${editableCellClass(task.id, 'assignedTo')}`}
            onClick={() => { if (!isEditing(task.id, 'assignedTo')) startEditing(task.id, 'assignedTo', task); }}
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
        );

      // Read-only columns
      case 'duration':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600">{task.estimatedDays != null ? `${task.estimatedDays}d` : '-'}</td>;

      case 'earlyStart':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600">{formatCpmDate(cpm?.ES)}</td>;
      case 'earlyFinish':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600">{formatCpmDate(cpm?.EF)}</td>;
      case 'lateStart':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600">{formatCpmDate(cpm?.LS)}</td>;
      case 'lateFinish':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600">{formatCpmDate(cpm?.LF)}</td>;

      case 'totalFloat':
        return (
          <td key={col.key} className="px-3 py-2 text-xs text-gray-600">
            {cpm ? `${cpm.totalFloat}d` : '-'}
          </td>
        );
      case 'freeFloat':
        return (
          <td key={col.key} className="px-3 py-2 text-xs text-gray-600">
            {cpm ? `${cpm.freeFloat}d` : '-'}
          </td>
        );

      case 'critical':
        return (
          <td key={col.key} className="px-3 py-2 text-xs">
            {cpm ? (
              cpm.isCritical
                ? <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">Yes</span>
                : <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">No</span>
            ) : '-'}
          </td>
        );

      case 'baselineStart':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600">{baseline?.baselineStart ? formatDate(baseline.baselineStart) : '-'}</td>;
      case 'baselineEnd':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600">{baseline?.baselineEnd ? formatDate(baseline.baselineEnd) : '-'}</td>;
      case 'startVariance':
        return <td key={col.key} className="px-3 py-2">{renderVarianceBadge(baseline?.startVarianceDays)}</td>;
      case 'endVariance':
        return <td key={col.key} className="px-3 py-2">{renderVarianceBadge(baseline?.endVarianceDays)}</td>;

      case 'dependency': {
        let depLabel = '-';
        if (task.dependency) {
          const depTask = tasks.find(t => t.id === task.dependency);
          const depType = task.dependencyType || 'FS';
          depLabel = depTask ? `${depTask.name} (${depType})` : `${task.dependency.slice(0, 8)}... (${depType})`;
        }
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-600 max-w-[160px] truncate" title={depLabel !== '-' ? depLabel : undefined}>{depLabel}</td>;
      }

      case 'wbs':
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-500 font-mono">{wbsMap.get(task.id) || '-'}</td>;

      default:
        return <td key={col.key} className="px-3 py-2 text-xs text-gray-400">-</td>;
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Column picker + saved views header */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <SavedViewsDropdown
          scheduleId={scheduleId}
          currentColumns={visibleKeys}
          currentSortField={sortField}
          currentSortDir={sortDir}
          onLoadView={loadSavedView}
        />
        <ColumnPickerDropdown
          columns={COLUMN_DEFS}
          visibleKeys={visibleKeys}
          onToggle={toggleColumn}
          onToggleGroup={toggleGroup}
        />
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="sticky top-0 z-10 bg-primary-50 border border-primary-200 rounded-lg p-3 m-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-semibold text-primary-700">{selectedIds.size} selected</span>
          </div>

          <div className="h-4 w-px bg-primary-200" />

          <div className="flex items-center gap-1">
            <select
              className="text-xs px-2 py-1 rounded border border-primary-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
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
                className="text-xs px-2 py-1 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 disabled:opacity-50"
                onClick={() => applyBulkUpdate('status', bulkStatus)}
                disabled={bulkLoading}
              >
                Apply
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <select
              className="text-xs px-2 py-1 rounded border border-primary-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
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
                className="text-xs px-2 py-1 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 disabled:opacity-50"
                onClick={() => applyBulkUpdate('priority', bulkPriority)}
                disabled={bulkLoading}
              >
                Apply
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Assign to..."
              className="text-xs px-2 py-1 rounded border border-primary-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400 w-28"
              value={bulkAssignee}
              onChange={e => setBulkAssignee(e.target.value)}
              disabled={bulkLoading}
              onKeyDown={e => { if (e.key === 'Enter' && bulkAssignee) applyBulkUpdate('assignedTo', bulkAssignee); }}
            />
            {bulkAssignee && (
              <button
                className="text-xs px-2 py-1 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 disabled:opacity-50"
                onClick={() => applyBulkUpdate('assignedTo', bulkAssignee)}
                disabled={bulkLoading}
              >
                Apply
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-primary-200" />

          <button
            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
            onClick={handleBulkDelete}
            disabled={bulkLoading}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>

          <button
            className="text-xs px-2 py-1 rounded bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 flex items-center gap-1 ml-auto"
            onClick={clearBulkState}
          >
            <X className="w-3 h-3" />
            Clear
          </button>

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
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5 cursor-pointer"
                />
              </th>
              {visibleColumns.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide select-none ${
                    col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    {col.label}
                    {col.sortable && <SortIcon field={col.key} />}
                  </div>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(task => {
              const isSelected = selectedIds.has(task.id);
              return (
                <tr
                  key={task.id}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors group ${isSelected ? 'bg-primary-50/40' : ''}`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(task.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5 cursor-pointer"
                    />
                  </td>

                  {visibleColumns.map(col => renderCell(task, col))}

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
                <td colSpan={visibleColumns.length + 2} className="text-center py-8 text-sm text-gray-400">
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
