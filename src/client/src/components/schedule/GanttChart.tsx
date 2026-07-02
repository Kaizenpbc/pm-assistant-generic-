import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { ColumnState } from '../../hooks/useColumnState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskDependencyRef {
  dependencyId: string;
  dependencyType: string;
  lagDays: number;
}

export interface GanttTask {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  progressPercentage?: number;
  /** @deprecated Use dependencies[] */
  dependency?: string;
  /** @deprecated Use dependencies[] */
  dependencyType?: string;
  /** @deprecated Use dependencies[] */
  dependencyLagDays?: number;
  parentTaskId?: string;
  assignedTo?: string;
  estimatedDays?: number;
  recurrenceRule?: string;
  recurrenceParentId?: string;
  isRecurrenceTemplate?: boolean;
  isMilestone?: boolean;
  sortOrder?: number;
  dependencies?: TaskDependencyRef[];
}

interface FlatRow {
  task: GanttTask;
  level: number;
  wbs: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function toDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / DAY_MS));
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Build a flat, sorted list of tasks with WBS numbers & hierarchy levels */
function buildFlatRows(tasks: GanttTask[]): FlatRow[] {
  const rows: FlatRow[] = [];
  const taskIds = new Set(tasks.map((t) => t.id));
  const topLevel = tasks.filter((t) => !t.parentTaskId || !taskIds.has(t.parentTaskId));
  // Sort by sort_order (user-defined), then start date as fallback
  topLevel.sort((a, b) => {
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    const da = toDate(a.startDate)?.getTime() ?? 0;
    const db = toDate(b.startDate)?.getTime() ?? 0;
    return da - db;
  });

  function addChildren(parentId: string, level: number, parentWbs: string) {
    const children = tasks
      .filter((t) => t.parentTaskId === parentId)
      .sort((a, b) => {
        const sa = a.sortOrder ?? 0;
        const sb = b.sortOrder ?? 0;
        if (sa !== sb) return sa - sb;
        const da = toDate(a.startDate)?.getTime() ?? 0;
        const db = toDate(b.startDate)?.getTime() ?? 0;
        return da - db;
      });
    children.forEach((child, idx) => {
      const wbs = `${parentWbs}.${idx + 1}`;
      rows.push({ task: child, level, wbs });
      addChildren(child.id, level + 1, wbs);
    });
  }

  topLevel.forEach((task, idx) => {
    const wbs = `${idx + 1}`;
    rows.push({ task, level: 0, wbs });
    addChildren(task.id, 1, wbs);
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Status / priority colors
// ---------------------------------------------------------------------------

const barColors: Record<string, { bg: string; fill: string; text: string }> = {
  completed: { bg: '#dcfce7', fill: '#22c55e', text: '#166534' },
  in_progress: { bg: '#dbeafe', fill: '#3b82f6', text: '#1e40af' },
  pending: { bg: '#f3f4f6', fill: '#9ca3af', text: '#374151' },
  cancelled: { bg: '#fee2e2', fill: '#ef4444', text: '#991b1b' },
};

const statusLabels: Record<string, string> = {
  completed: 'Complete',
  in_progress: 'In Progress',
  pending: 'Not Started',
  cancelled: 'Cancelled',
};

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-green-400',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_H = 36;
const HEADER_H = 52;
const TABLE_DEFAULT_W = 720;
const TABLE_MIN_W = 200;
const TABLE_MAX_W = 1100;

// ---------------------------------------------------------------------------
// Gantt left-panel column definitions (for resizable columns)
// ---------------------------------------------------------------------------

interface GanttColDef {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  resizable: boolean;
  /** If true, column uses flex-1 instead of fixed width */
  flex?: boolean;
  /** Fixed columns cannot be resized and ignore width state */
  fixed?: boolean;
}

const GANTT_COLUMNS: GanttColDef[] = [
  { key: 'rowNum',    label: '#',        defaultWidth: 40,  minWidth: 30,  resizable: false, fixed: true },
  { key: 'name',      label: 'Task Name',defaultWidth: 0,   minWidth: 120, resizable: false, flex: true },
  { key: 'pred',      label: 'Pred',     defaultWidth: 56,  minWidth: 40,  resizable: true },
  { key: 'start',     label: 'Start',    defaultWidth: 80,  minWidth: 60,  resizable: true },
  { key: 'end',       label: 'End',      defaultWidth: 80,  minWidth: 60,  resizable: true },
  { key: 'dur',       label: 'Dur',      defaultWidth: 48,  minWidth: 36,  resizable: true },
  { key: 'est',       label: 'Est',      defaultWidth: 48,  minWidth: 36,  resizable: true },
  { key: 'pct',       label: '%',        defaultWidth: 48,  minWidth: 36,  resizable: true },
  { key: 'priority',  label: 'Priority', defaultWidth: 64,  minWidth: 50,  resizable: true },
  { key: 'assigned',  label: 'Assigned', defaultWidth: 96,  minWidth: 60,  resizable: true },
  { key: 'status',    label: 'Status',   defaultWidth: 64,  minWidth: 50,  resizable: true },
  { key: 'editIcon',  label: '',         defaultWidth: 32,  minWidth: 32,  resizable: false, fixed: true },
];

// ---------------------------------------------------------------------------
// Zoom / Timescale
// ---------------------------------------------------------------------------

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';
type TierUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

const ZOOM_CONFIGS: Record<ZoomLevel, { dayPx: number; lower: TierUnit; upper: TierUnit | null }> = {
  day:     { dayPx: 32,   lower: 'day',     upper: 'month' },
  week:    { dayPx: 10,   lower: 'week',    upper: 'month' },
  month:   { dayPx: 3.2,  lower: 'month',   upper: 'year' },
  quarter: { dayPx: 1.2,  lower: 'quarter', upper: 'year' },
  year:    { dayPx: 0.27, lower: 'year',    upper: null },
};

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];
const ZOOM_LABELS: Record<ZoomLevel, string> = { day: 'D', week: 'W', month: 'M', quarter: 'Q', year: 'Y' };

interface TimescaleBand { label: string; left: number; width: number }
interface Timescale { upper: TimescaleBand[]; lower: TimescaleBand[] }

function daysBetweenRaw(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS;
}

function snapToUnitStart(d: Date, unit: TierUnit): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  switch (unit) {
    case 'day':
      break;
    case 'week': {
      // ISO week: Monday
      const day = r.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      r.setDate(r.getDate() + diff);
      break;
    }
    case 'month':
      r.setDate(1);
      break;
    case 'quarter':
      r.setDate(1);
      r.setMonth(Math.floor(r.getMonth() / 3) * 3);
      break;
    case 'year':
      r.setMonth(0, 1);
      break;
  }
  return r;
}

function advanceByUnit(d: Date, unit: TierUnit): Date {
  const r = new Date(d);
  switch (unit) {
    case 'day': r.setDate(r.getDate() + 1); break;
    case 'week': r.setDate(r.getDate() + 7); break;
    case 'month': r.setMonth(r.getMonth() + 1); break;
    case 'quarter': r.setMonth(r.getMonth() + 3); break;
    case 'year': r.setFullYear(r.getFullYear() + 1); break;
  }
  return r;
}

function getISOWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function formatTierLabel(d: Date, unit: TierUnit): string {
  switch (unit) {
    case 'day': return String(d.getDate());
    case 'week': return `W${getISOWeek(d)}`;
    case 'month': return d.toLocaleDateString('en-US', { month: 'short' });
    case 'quarter': return `Q${Math.floor(d.getMonth() / 3) + 1}`;
    case 'year': return String(d.getFullYear());
  }
}

function formatUpperLabel(d: Date, unit: TierUnit): string {
  switch (unit) {
    case 'month': return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    case 'year': return String(d.getFullYear());
    default: return formatTierLabel(d, unit);
  }
}

function buildTier(unit: TierUnit, minDate: Date, maxDate: Date, dayPx: number, isUpper: boolean): TimescaleBand[] {
  const bands: TimescaleBand[] = [];
  let cursor = snapToUnitStart(new Date(minDate), unit);

  while (cursor <= maxDate) {
    const unitStart = new Date(Math.max(cursor.getTime(), minDate.getTime()));
    const nextUnit = advanceByUnit(new Date(cursor), unit);
    const unitEnd = new Date(Math.min(nextUnit.getTime(), maxDate.getTime()));

    const left = daysBetweenRaw(minDate, unitStart) * dayPx;
    const width = Math.max(daysBetweenRaw(unitStart, unitEnd) * dayPx, 1);

    bands.push({ label: isUpper ? formatUpperLabel(cursor, unit) : formatTierLabel(cursor, unit), left, width });
    cursor = nextUnit;
  }
  return bands;
}

function buildTimescale(zoom: ZoomLevel, minDate: Date, maxDate: Date, dayPx: number): Timescale {
  const cfg = ZOOM_CONFIGS[zoom];
  const lower = buildTier(cfg.lower, minDate, maxDate, dayPx, false);
  const upper = cfg.upper ? buildTier(cfg.upper, minDate, maxDate, dayPx, true) : [];
  return { upper, lower };
}

// ---------------------------------------------------------------------------
// GanttChart component
// ---------------------------------------------------------------------------

export function GanttChart({
  tasks,
  scheduleName,
  scheduleId,
  onTaskClick,
  onTaskSelect,
  activeTaskId,
  onAddTask,
  onDeleteTask,
  columnState: _columnState,
  criticalPathTaskIds,
  baselineTasks,
  onTaskDragEnd,
  onTaskUpdate,
}: {
  tasks: GanttTask[];
  scheduleName?: string;
  /** Schedule ID for persisting zoom level */
  scheduleId?: string;
  /** Called when a task row is double-clicked (opens edit modal) */
  onTaskClick?: (task: GanttTask) => void;
  /** Called when a task row is single-clicked (selects it) */
  onTaskSelect?: (task: GanttTask) => void;
  /** Currently active/selected task ID */
  activeTaskId?: string | null;
  /** Called when the "Add Task" button is clicked */
  onAddTask?: () => void;
  /** Called when the delete button is clicked for the active task */
  onDeleteTask?: (taskId: string) => void;
  /** Shared column state (for future left-panel column rendering) */
  columnState?: ColumnState;
  /** Task IDs that are on the critical path (rendered in red) */
  criticalPathTaskIds?: string[];
  /** Baseline task data for ghost bars */
  baselineTasks?: Array<{ taskId: string; startDate: string; endDate: string }>;
  /** Called when a task bar is dragged to new dates */
  onTaskDragEnd?: (taskId: string, newStartDate: string, newEndDate: string) => void;
  /** Called when a task field is edited inline in the left panel */
  onTaskUpdate?: (taskId: string, data: Record<string, unknown>) => void;
}) {
  const criticalSet = useMemo(() => new Set(criticalPathTaskIds || []), [criticalPathTaskIds]);
  const baselineMap = useMemo(() => {
    const m = new Map<string, { startDate: string; endDate: string }>();
    if (baselineTasks) {
      for (const bt of baselineTasks) {
        m.set(bt.taskId, bt);
      }
    }
    return m;
  }, [baselineTasks]);
  // Zoom state — persisted per schedule in localStorage
  const [zoom, setZoom] = useState<ZoomLevel>(() => {
    if (!scheduleId) return 'month';
    const stored = localStorage.getItem(`gantt-zoom:${scheduleId}`);
    return (stored && ZOOM_LEVELS.includes(stored as ZoomLevel)) ? stored as ZoomLevel : 'month';
  });
  const dayPx = ZOOM_CONFIGS[zoom].dayPx;

  useEffect(() => {
    if (scheduleId) localStorage.setItem(`gantt-zoom:${scheduleId}`, zoom);
  }, [zoom, scheduleId]);

  // Draggable splitter: table panel width
  const [tableWidth, setTableWidth] = useState<number>(() => {
    if (!scheduleId) return TABLE_DEFAULT_W;
    const stored = localStorage.getItem(`gantt-table-w:${scheduleId}`);
    return stored ? Math.max(TABLE_MIN_W, Math.min(TABLE_MAX_W, Number(stored))) : TABLE_DEFAULT_W;
  });
  const [splitterDrag, setSplitterDrag] = useState<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    if (scheduleId) localStorage.setItem(`gantt-table-w:${scheduleId}`, String(tableWidth));
  }, [tableWidth, scheduleId]);

  useEffect(() => {
    if (!splitterDrag) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      const newW = Math.max(TABLE_MIN_W, Math.min(TABLE_MAX_W, splitterDrag.startW + (e.clientX - splitterDrag.startX)));
      setTableWidth(newW);
    };
    const onUp = () => {
      setSplitterDrag(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [splitterDrag]);

  // Column resize state — persisted per schedule in localStorage
  const [ganttColWidths, setGanttColWidths] = useState<Record<string, number>>(() => {
    if (!scheduleId) return {};
    try {
      const stored = localStorage.getItem(`gantt-col-widths:${scheduleId}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    if (scheduleId && Object.keys(ganttColWidths).length > 0) {
      localStorage.setItem(`gantt-col-widths:${scheduleId}`, JSON.stringify(ganttColWidths));
    }
  }, [ganttColWidths, scheduleId]);

  const colResizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const handleColResizeStart = useCallback((e: React.MouseEvent, colKey: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    colResizingRef.current = { key: colKey, startX: e.clientX, startW: currentWidth };
    const colDef = GANTT_COLUMNS.find(c => c.key === colKey);
    const minW = colDef?.minWidth ?? 36;

    const onMove = (ev: MouseEvent) => {
      if (!colResizingRef.current) return;
      const diff = ev.clientX - colResizingRef.current.startX;
      const newW = Math.max(minW, colResizingRef.current.startW + diff);
      setGanttColWidths(prev => ({ ...prev, [colResizingRef.current!.key]: newW }));
    };
    const onUp = () => {
      colResizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  /** Get the effective width for a gantt column */
  const getColWidth = useCallback((col: GanttColDef): number => {
    if (col.flex || col.fixed) return col.defaultWidth;
    return ganttColWidths[col.key] ?? col.defaultWidth;
  }, [ganttColWidths]);

  const rows = useMemo(() => buildFlatRows(tasks), [tasks]);

  // Row number map: taskId → 1-based row index
  const rowNumMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(({ task }, idx) => map.set(task.id, idx + 1));
    return map;
  }, [rows]);

  // Get dependency health status
  const getDepHealth = useCallback((depTaskId: string): 'satisfied' | 'in_progress' | 'at_risk' => {
    const depTask = tasks.find(t => t.id === depTaskId);
    if (!depTask) return 'at_risk';
    if (depTask.status === 'completed') return 'satisfied';
    if (depTask.status === 'in_progress') return 'in_progress';
    if (depTask.endDate && new Date(depTask.endDate) < new Date()) return 'at_risk';
    return 'in_progress';
  }, [tasks]);

  const healthColor = (health: 'satisfied' | 'in_progress' | 'at_risk') =>
    health === 'satisfied' ? '#22c55e' : health === 'in_progress' ? '#eab308' : '#ef4444';

  // -----------------------------------------------------------------------
  // Drag-and-drop state (declared early so editing helpers can check it)
  // -----------------------------------------------------------------------
  const [drag, setDrag] = useState<{
    taskId: string;
    mode: 'move' | 'resize';
    startX: number;
    origStartDate: Date;
    origEndDate: Date;
    dayDelta: number;
  } | null>(null);

  // -----------------------------------------------------------------------
  // Inline editing state & helpers
  // -----------------------------------------------------------------------
  type EditableField = 'name' | 'dependency' | 'startDate' | 'endDate' | 'duration' | 'estimatedDays' | 'progressPercentage' | 'priority' | 'assignedTo' | 'status';
  const FIELD_ORDER: EditableField[] = ['name', 'dependency', 'startDate', 'endDate', 'duration', 'estimatedDays', 'progressPercentage', 'priority', 'assignedTo', 'status'];
  const statusOptions = ['pending', 'in_progress', 'completed'];
  const priorityOptions = ['low', 'medium', 'high', 'urgent'];

  const [editingCell, setEditingCell] = useState<{ taskId: string; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  // savingCell tracks the cell currently being saved (used for timing the green flash)
  const [savingCell, setSavingCell] = useState<{ taskId: string; field: string } | null>(null);
  void savingCell; // read to satisfy TS — value used internally for save timing
  const [savedCell, setSavedCell] = useState<{ taskId: string; field: string } | null>(null);
  const [depError, setDepError] = useState<{ taskId: string; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus();
  }, [editingCell]);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // Reverse map: row number → taskId
  const rowNumToTaskId = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach(({ task }, idx) => map.set(idx + 1, task.id));
    return map;
  }, [rows]);

  const parsePredecessorInput = useCallback((input: string, currentTaskId: string): { deps: Array<{ taskId: string; type: string; lag: number }> } | { error: string } => {
    const trimmed = input.trim();
    if (!trimmed) return { deps: [] };
    const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    const deps: Array<{ taskId: string; type: string; lag: number }> = [];
    for (const part of parts) {
      const match = part.match(/^(\d+)\s*(FS|FF|SS|SF)?\s*([+-]\d+d?)?$/i);
      if (!match) return { error: `Invalid format: "${part}". Use: row# or row#FS or row#SS+2d` };
      const rowNum = parseInt(match[1], 10);
      const type = (match[2] || 'FS').toUpperCase();
      const lagStr = match[3];
      const lag = lagStr ? parseInt(lagStr.replace(/d$/i, ''), 10) : 0;
      const targetTaskId = rowNumToTaskId.get(rowNum);
      if (!targetTaskId) return { error: `Row ${rowNum} not found` };
      if (targetTaskId === currentTaskId) return { error: 'Cannot reference self' };
      if (deps.some(d => d.taskId === targetTaskId)) return { error: `Duplicate: row ${rowNum}` };
      deps.push({ taskId: targetTaskId, type, lag });
    }
    if (deps.length > 20) return { error: 'Max 20 predecessors' };
    return { deps };
  }, [rowNumToTaskId]);

  const getTaskFieldValue = useCallback((task: GanttTask, field: EditableField): string => {
    switch (field) {
      case 'name': return task.name || '';
      case 'status': return task.status || 'pending';
      case 'priority': return task.priority || 'medium';
      case 'startDate': return task.startDate?.split('T')[0] || '';
      case 'endDate': return task.endDate?.split('T')[0] || '';
      case 'duration': {
        const s = toDate(task.startDate);
        const e = toDate(task.endDate);
        return s && e ? String(daysBetween(s, e)) : '';
      }
      case 'estimatedDays': return task.estimatedDays != null ? String(task.estimatedDays) : '';
      case 'progressPercentage': return String(task.progressPercentage ?? 0);
      case 'assignedTo': return task.assignedTo || '';
      case 'dependency': {
        const deps = task.dependencies;
        if (!deps || deps.length === 0) {
          if (!task.dependency) return '';
          const depRowNum = rowNumMap.get(task.dependency);
          if (!depRowNum) return '';
          const type = task.dependencyType || 'FS';
          const lag = task.dependencyLagDays || 0;
          let label = String(depRowNum);
          if (type !== 'FS') label += type;
          if (lag !== 0) label += (lag > 0 ? `+${lag}d` : `${lag}d`);
          return label;
        }
        return deps.map(d => {
          const depRowNum = rowNumMap.get(d.dependencyId);
          if (!depRowNum) return '';
          let label = String(depRowNum);
          if (d.dependencyType !== 'FS') label += d.dependencyType;
          if (d.lagDays !== 0) label += (d.lagDays > 0 ? `+${d.lagDays}d` : `${d.lagDays}d`);
          return label;
        }).filter(Boolean).join(',');
      }
      default: return '';
    }
  }, [rowNumMap]);

  const startEditing = useCallback((taskId: string, field: EditableField, task: GanttTask) => {
    if (!onTaskUpdate || drag) return;
    setEditingCell({ taskId, field });
    setEditValue(getTaskFieldValue(task, field));
    setDepError(null);
  }, [onTaskUpdate, drag, getTaskFieldValue]);

  const cancelEditing = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setDepError(null);
  }, []);

  const saveEdit = useCallback((taskId: string, field: EditableField, value: string) => {
    if (!onTaskUpdate) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const originalValue = getTaskFieldValue(task, field);
    if (value === originalValue) { cancelEditing(); return; }

    // Name cannot be empty
    if (field === 'name' && !value.trim()) { cancelEditing(); return; }

    // Duration: compute new endDate
    if (field === 'duration') {
      const days = parseInt(value.replace(/d$/i, ''), 10);
      if (isNaN(days) || days < 1 || !task.startDate) { cancelEditing(); return; }
      const newEnd = new Date(task.startDate);
      newEnd.setDate(newEnd.getDate() + days);
      setSavingCell({ taskId, field });
      setEditingCell(null);
      setEditValue('');
      onTaskUpdate(taskId, { endDate: newEnd.toISOString().split('T')[0] });
      setTimeout(() => {
        setSavingCell(null);
        setSavedCell({ taskId, field });
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSavedCell(null), 1200);
      }, 300);
      return;
    }

    // Dependency: multi-dep parsing
    if (field === 'dependency') {
      const result = parsePredecessorInput(value, taskId);
      if ('error' in result) { setDepError({ taskId, message: result.error }); return; }
      setDepError(null);
      setSavingCell({ taskId, field });
      setEditingCell(null);
      setEditValue('');
      onTaskUpdate(taskId, {
        dependencies: result.deps.map(d => ({
          dependencyId: d.taskId,
          dependencyType: d.type,
          lagDays: d.lag,
        })),
      });
      setTimeout(() => {
        setSavingCell(null);
        setSavedCell({ taskId, field });
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSavedCell(null), 1200);
      }, 300);
      return;
    }

    const saveValue = field === 'progressPercentage'
      ? Math.max(0, Math.min(100, Number(value)))
      : field === 'estimatedDays'
        ? Math.max(0, Number(value))
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
  }, [onTaskUpdate, tasks, getTaskFieldValue, cancelEditing, parsePredecessorInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, taskId: string, field: EditableField) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(taskId, field, editValue); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      // Save current cell first
      saveEdit(taskId, field, editValue);
      // Navigate to next/prev editable field
      const fieldIdx = FIELD_ORDER.indexOf(field);
      const rowIdx = rows.findIndex(r => r.task.id === taskId);
      if (rowIdx === -1) return;
      if (e.shiftKey) {
        if (fieldIdx > 0) {
          startEditing(taskId, FIELD_ORDER[fieldIdx - 1], rows[rowIdx].task);
        } else if (rowIdx > 0) {
          startEditing(rows[rowIdx - 1].task.id, FIELD_ORDER[FIELD_ORDER.length - 1], rows[rowIdx - 1].task);
        }
      } else {
        if (fieldIdx < FIELD_ORDER.length - 1) {
          startEditing(taskId, FIELD_ORDER[fieldIdx + 1], rows[rowIdx].task);
        } else if (rowIdx < rows.length - 1) {
          startEditing(rows[rowIdx + 1].task.id, FIELD_ORDER[0], rows[rowIdx + 1].task);
        }
      }
    }
  }, [saveEdit, cancelEditing, editValue, rows, startEditing]);

  const handleSelectChange = useCallback((taskId: string, field: EditableField, value: string) => {
    setEditValue(value);
    saveEdit(taskId, field, value);
  }, [saveEdit]);

  const handleDateChange = useCallback((taskId: string, field: EditableField, value: string) => {
    setEditValue(value);
    saveEdit(taskId, field, value);
  }, [saveEdit]);

  const isEditing = (taskId: string, field: string) =>
    editingCell?.taskId === taskId && editingCell.field === field;
  const isSaved = (taskId: string, field: string) =>
    savedCell?.taskId === taskId && savedCell.field === field;
  const editableCellClass = (taskId: string, field: string) => {
    if (!onTaskUpdate) return '';
    const base = 'relative cursor-pointer transition-all duration-150';
    if (isEditing(taskId, field)) return `${base} ring-2 ring-blue-400 ring-inset rounded`;
    if (isSaved(taskId, field)) return `${base} bg-green-50`;
    return `${base} hover:bg-blue-50/50`;
  };

  const timelineRef = useRef<HTMLDivElement>(null);

  // Compute date range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    let earliest = Infinity;
    let latest = -Infinity;
    for (const { task } of rows) {
      const s = toDate(task.startDate);
      const e = toDate(task.endDate);
      if (s) earliest = Math.min(earliest, s.getTime());
      if (e) latest = Math.max(latest, e.getTime());
    }
    const today = new Date();
    if (earliest === Infinity) earliest = today.getTime();
    if (latest === -Infinity) latest = today.getTime() + 90 * DAY_MS;
    // Add padding: 14 days before, 30 days after
    const min = new Date(earliest - 14 * DAY_MS);
    const max = new Date(latest + 30 * DAY_MS);
    return {
      minDate: min,
      maxDate: max,
      totalDays: daysBetween(min, max),
    };
  }, [rows]);

  const timelineWidth = totalDays * dayPx;

  // Scroll to today on mount
  useEffect(() => {
    if (!timelineRef.current) return;
    const today = new Date();
    const dayOffset = daysBetween(minDate, today);
    const px = dayOffset * dayPx - 200;
    timelineRef.current.scrollLeft = Math.max(0, px);
  }, [minDate, dayPx]);

  // Build two-tier timescale header bands
  const timescale = useMemo(() => buildTimescale(zoom, minDate, maxDate, dayPx), [zoom, minDate, maxDate, dayPx]);

  // Today line position
  const todayOffset = useMemo(() => {
    const today = new Date();
    if (today < minDate || today > maxDate) return null;
    return daysBetween(minDate, today) * dayPx;
  }, [minDate, maxDate]);

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      if (!onTaskDragEnd) return;
      e.stopPropagation();
      e.preventDefault();
      const start = toDate(task.startDate);
      const end = toDate(task.endDate);
      if (!start || !end) return;

      // Right 8px = resize, rest = move
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const mode = localX > rect.width - 8 ? 'resize' : 'move';

      setDrag({
        taskId: task.id,
        mode,
        startX: e.clientX,
        origStartDate: start,
        origEndDate: end,
        dayDelta: 0,
      });
    },
    [onTaskDragEnd]
  );

  useEffect(() => {
    if (!drag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - drag.startX;
      const dayDelta = Math.round(deltaX / dayPx);
      setDrag(prev => prev ? { ...prev, dayDelta } : null);
    };

    const handleMouseUp = () => {
      if (drag && drag.dayDelta !== 0 && onTaskDragEnd) {
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        if (drag.mode === 'move') {
          const newStart = new Date(drag.origStartDate);
          newStart.setDate(newStart.getDate() + drag.dayDelta);
          const newEnd = new Date(drag.origEndDate);
          newEnd.setDate(newEnd.getDate() + drag.dayDelta);
          onTaskDragEnd(drag.taskId, fmt(newStart), fmt(newEnd));
        } else {
          // resize: only change end date, minimum 1 day duration
          const newEnd = new Date(drag.origEndDate);
          newEnd.setDate(newEnd.getDate() + drag.dayDelta);
          if (newEnd > drag.origStartDate) {
            onTaskDragEnd(drag.taskId, fmt(drag.origStartDate), fmt(newEnd));
          }
        }
      }
      setDrag(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drag, onTaskDragEnd, dayPx]);

  // Compute drag visual offset for the dragged bar
  const getDragOffset = useCallback(
    (taskId: string) => {
      if (!drag || drag.taskId !== taskId) return { leftDelta: 0, widthDelta: 0 };
      const pxDelta = drag.dayDelta * dayPx;
      if (drag.mode === 'move') return { leftDelta: pxDelta, widthDelta: 0 };
      return { leftDelta: 0, widthDelta: pxDelta };
    },
    [drag, dayPx]
  );

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No tasks to display.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Schedule title bar */}
      {scheduleName && (
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-primary-500" />
            <span className="text-sm font-semibold text-gray-800">
              {scheduleName}
            </span>
            <span className="text-xs text-gray-400 ml-2">
              {rows.length} tasks
            </span>
          </div>
          {/* Zoom controls */}
          <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-500">
            {ZOOM_LEVELS.map((level, i) => (
              <button
                key={level}
                onClick={() => setZoom(level)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  zoom === level
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                } ${i === 0 ? 'rounded-l-md' : ''} ${i === ZOOM_LEVELS.length - 1 ? 'rounded-r-md' : ''}`}
                title={level.charAt(0).toUpperCase() + level.slice(1)}
              >
                {ZOOM_LABELS[level]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {onAddTask && (
              <button
                onClick={onAddTask}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </button>
            )}
            {onDeleteTask && (
              <button
                onClick={() => {
                  if (!activeTaskId) return;
                  const task = tasks.find(t => t.id === activeTaskId);
                  if (task && confirm(`Delete "${task.name}"?`)) {
                    onDeleteTask(activeTaskId);
                  }
                }}
                disabled={!activeTaskId}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTaskId
                    ? 'text-red-600 bg-red-50 hover:bg-red-100'
                    : 'text-gray-300 bg-gray-50 cursor-not-allowed'
                }`}
                title={activeTaskId ? 'Delete selected task' : 'Select a task first'}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
            <button
              onClick={() => {
                const el = document.getElementById('gantt-print-container');
                if (el) {
                  el.style.maxHeight = 'none';
                  el.style.overflow = 'visible';
                }
                window.print();
                if (el) {
                  el.style.maxHeight = '70vh';
                  el.style.overflow = 'hidden';
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors print:hidden"
              title="Export as PDF"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
          </div>
        </div>
      )}

      <div id="gantt-print-container" className="flex overflow-hidden" style={{ maxHeight: '70vh' }}>
        {/* ============================================================= */}
        {/* LEFT: Task table                                               */}
        {/* ============================================================= */}
        <div
          className="flex-shrink-0 overflow-y-auto overflow-x-hidden"
          style={{ width: tableWidth }}
        >
          {/* Table header */}
          <div
            className="sticky top-0 z-10 flex items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            style={{ height: HEADER_H }}
          >
            {GANTT_COLUMNS.map(col => {
              // Skip editIcon column if no onTaskClick
              if (col.key === 'editIcon' && !onTaskClick) return null;
              const w = getColWidth(col);
              return (
                <div
                  key={col.key}
                  className={`shrink-0 px-1 text-center relative select-none ${col.flex ? 'flex-1 min-w-0 px-2' : ''}`}
                  style={col.flex ? undefined : { width: w }}
                  title={col.key === 'editIcon' ? 'Double-click row or click icon to edit' : undefined}
                >
                  {col.label}
                  {col.resizable && (
                    <div
                      className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-10 hover:bg-primary-400/40 transition-colors"
                      onMouseDown={(e) => handleColResizeStart(e, col.key, w)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Task rows */}
          {rows.map(({ task, level }, rowIdx) => {
            const start = toDate(task.startDate);
            const end = toDate(task.endDate);
            const pct = task.progressPercentage ?? 0;
            const isParent = rows.some((r) => r.task.parentTaskId === task.id);

            return (
              <div
                key={task.id}
                className={`flex items-center border-b border-gray-100 hover:bg-blue-50/40 transition-colors group cursor-pointer ${activeTaskId === task.id ? 'bg-primary-50 ring-1 ring-inset ring-primary-200' : ''}`}
                style={{ height: ROW_H }}
                onClick={() => { if (!editingCell) onTaskSelect?.(task); }}
                onDoubleClick={() => { if (!editingCell) onTaskClick?.(task); }}
              >
                {/* Row # */}
                <div className="shrink-0 px-1 text-center text-xs text-gray-400 font-mono" style={{ width: getColWidth(GANTT_COLUMNS[0]) }}>
                  {rowIdx + 1}
                </div>

                {/* Task name with indent */}
                <div
                  className={`flex-1 min-w-0 ${editableCellClass(task.id, 'name')}`}
                  style={{ paddingLeft: `${8 + level * 20}px` }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'name', task); } }}
                >
                  {isEditing(task.id, 'name') ? (
                    <input
                      ref={el => { inputRef.current = el; }}
                      className="w-full h-full text-xs bg-white border-0 outline-none px-1"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(task.id, 'name', editValue)}
                      onKeyDown={e => handleKeyDown(e, task.id, 'name')}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 px-2">
                      {task.isMilestone && (
                        <span className="w-3 h-3 flex-shrink-0 rotate-45 bg-primary-500 inline-block" title="Milestone" />
                      )}
                      {task.priority && !task.isMilestone && (
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[task.priority] || 'bg-gray-300'}`} />
                      )}
                      <span
                        className={`text-xs truncate ${isParent ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
                        title={task.name}
                      >
                        {task.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Predecessor(s) */}
                <div
                  className={`shrink-0 px-1 text-center text-xs text-gray-500 font-mono ${editableCellClass(task.id, 'dependency')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[2]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'dependency', task); } }}
                  title={(task.dependencies || []).map(d => tasks.find(t => t.id === d.dependencyId)?.name || '').filter(Boolean).join(', ') || undefined}
                >
                  {isEditing(task.id, 'dependency') ? (
                    <div>
                      <input
                        ref={el => { inputRef.current = el; }}
                        className="w-full h-full text-xs bg-white border-0 outline-none px-0.5 text-center font-mono"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(task.id, 'dependency', editValue)}
                        onKeyDown={e => handleKeyDown(e, task.id, 'dependency')}
                        placeholder="e.g. 3FS"
                      />
                      {depError?.taskId === task.id && (
                        <div className="absolute z-30 top-full left-0 bg-red-50 border border-red-200 text-red-600 text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                          {depError.message}
                        </div>
                      )}
                    </div>
                  ) : (
                    (task.dependencies && task.dependencies.length > 0) ? (() => {
                      let worstHealth: 'satisfied' | 'in_progress' | 'at_risk' = 'satisfied';
                      const labels: string[] = [];
                      for (const dep of task.dependencies) {
                        const depRowNum = rowNumMap.get(dep.dependencyId);
                        const depType = (dep.dependencyType || 'FS').toUpperCase();
                        const lag = dep.lagDays || 0;
                        let label = depRowNum != null ? String(depRowNum) : '?';
                        if (depType !== 'FS') label += depType;
                        if (lag !== 0) label += (lag > 0 ? `+${lag}d` : `${lag}d`);
                        labels.push(label);
                        const h = getDepHealth(dep.dependencyId);
                        if (h === 'at_risk') worstHealth = 'at_risk';
                        else if (h === 'in_progress' && worstHealth !== 'at_risk') worstHealth = 'in_progress';
                      }
                      return (
                        <span className="inline-flex items-center gap-1 justify-center">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: healthColor(worstHealth) }} />
                          {labels.join(',')}
                        </span>
                      );
                    })() : '—'
                  )}
                </div>

                {/* Start */}
                <div
                  className={`shrink-0 px-1 text-center text-xs text-gray-500 ${editableCellClass(task.id, 'startDate')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[3]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'startDate', task); } }}
                >
                  {isEditing(task.id, 'startDate') ? (
                    <input
                      ref={el => { inputRef.current = el; }}
                      type="date"
                      className="w-full h-full text-xs bg-white border-0 outline-none px-0.5"
                      value={editValue}
                      onChange={e => handleDateChange(task.id, 'startDate', e.target.value)}
                      onBlur={() => cancelEditing()}
                      onKeyDown={e => handleKeyDown(e, task.id, 'startDate')}
                    />
                  ) : (
                    start ? formatShortDate(start) : '—'
                  )}
                </div>

                {/* End */}
                <div
                  className={`shrink-0 px-1 text-center text-xs text-gray-500 ${editableCellClass(task.id, 'endDate')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[4]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'endDate', task); } }}
                >
                  {isEditing(task.id, 'endDate') ? (
                    <input
                      ref={el => { inputRef.current = el; }}
                      type="date"
                      className="w-full h-full text-xs bg-white border-0 outline-none px-0.5"
                      value={editValue}
                      onChange={e => handleDateChange(task.id, 'endDate', e.target.value)}
                      onBlur={() => cancelEditing()}
                      onKeyDown={e => handleKeyDown(e, task.id, 'endDate')}
                    />
                  ) : (
                    end ? formatShortDate(end) : '—'
                  )}
                </div>

                {/* Duration */}
                <div
                  className={`shrink-0 px-1 text-center text-xs text-gray-500 ${editableCellClass(task.id, 'duration')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[5]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'duration', task); } }}
                >
                  {isEditing(task.id, 'duration') ? (
                    <input
                      ref={el => { inputRef.current = el; }}
                      className="w-full h-full text-xs bg-white border-0 outline-none px-0.5 text-center"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(task.id, 'duration', editValue)}
                      onKeyDown={e => handleKeyDown(e, task.id, 'duration')}
                      placeholder="days"
                    />
                  ) : (
                    start && end ? `${daysBetween(start, end)}d` : '—'
                  )}
                </div>

                {/* Estimated Days */}
                <div
                  className={`shrink-0 px-1 text-center text-xs text-gray-500 ${editableCellClass(task.id, 'estimatedDays')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[6]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'estimatedDays', task); } }}
                >
                  {isEditing(task.id, 'estimatedDays') ? (
                    <input
                      ref={el => { inputRef.current = el; }}
                      type="number"
                      min="0"
                      className="w-full h-full text-xs bg-white border-0 outline-none px-0.5 text-center"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(task.id, 'estimatedDays', editValue)}
                      onKeyDown={e => handleKeyDown(e, task.id, 'estimatedDays')}
                    />
                  ) : (
                    task.estimatedDays != null ? `${task.estimatedDays}d` : '—'
                  )}
                </div>

                {/* % Complete */}
                <div
                  className={`shrink-0 px-1 text-center text-xs font-medium text-gray-600 ${editableCellClass(task.id, 'progressPercentage')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[7]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'progressPercentage', task); } }}
                >
                  {isEditing(task.id, 'progressPercentage') ? (
                    <input
                      ref={el => { inputRef.current = el; }}
                      type="number"
                      min="0"
                      max="100"
                      className="w-full h-full text-xs bg-white border-0 outline-none px-0.5 text-center"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(task.id, 'progressPercentage', editValue)}
                      onKeyDown={e => handleKeyDown(e, task.id, 'progressPercentage')}
                    />
                  ) : (
                    `${pct}%`
                  )}
                </div>

                {/* Priority */}
                <div
                  className={`shrink-0 px-1 text-center ${editableCellClass(task.id, 'priority')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[8]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'priority', task); } }}
                >
                  {isEditing(task.id, 'priority') ? (
                    <select
                      ref={el => { inputRef.current = el; }}
                      className="w-full h-full text-xs bg-white border-0 outline-none"
                      value={editValue}
                      onChange={e => handleSelectChange(task.id, 'priority', e.target.value)}
                      onBlur={() => cancelEditing()}
                      onKeyDown={e => handleKeyDown(e, task.id, 'priority')}
                    >
                      {priorityOptions.map(o => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                  ) : (
                    task.priority ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[task.priority] || 'bg-gray-300'}`} />
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                    ) : '—'
                  )}
                </div>

                {/* Assigned To */}
                <div
                  className={`shrink-0 px-1 text-center text-xs text-gray-500 truncate ${editableCellClass(task.id, 'assignedTo')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[9]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'assignedTo', task); } }}
                  title={task.assignedTo || undefined}
                >
                  {isEditing(task.id, 'assignedTo') ? (
                    <input
                      ref={el => { inputRef.current = el; }}
                      className="w-full h-full text-xs bg-white border-0 outline-none px-0.5 text-center"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(task.id, 'assignedTo', editValue)}
                      onKeyDown={e => handleKeyDown(e, task.id, 'assignedTo')}
                    />
                  ) : (
                    task.assignedTo || '—'
                  )}
                </div>

                {/* Status */}
                <div
                  className={`shrink-0 px-1 text-center ${editableCellClass(task.id, 'status')}`}
                  style={{ width: getColWidth(GANTT_COLUMNS[10]) }}
                  onClick={(e) => { if (onTaskUpdate) { e.stopPropagation(); startEditing(task.id, 'status', task); } }}
                >
                  {isEditing(task.id, 'status') ? (
                    <select
                      ref={el => { inputRef.current = el; }}
                      className="w-full h-full text-xs bg-white border-0 outline-none"
                      value={editValue}
                      onChange={e => handleSelectChange(task.id, 'status', e.target.value)}
                      onBlur={() => cancelEditing()}
                      onKeyDown={e => handleKeyDown(e, task.id, 'status')}
                    >
                      {statusOptions.map(o => (
                        <option key={o} value={o}>
                          {o === 'in_progress' ? 'Active' : o === 'completed' ? 'Done' : o === 'pending' ? 'Pending' : o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: barColors[task.status]?.bg || '#f3f4f6',
                        color: barColors[task.status]?.text || '#374151',
                      }}
                    >
                      {task.status === 'in_progress'
                        ? 'Active'
                        : task.status === 'completed'
                          ? 'Done'
                          : task.status === 'pending'
                            ? 'Pending'
                            : task.status}
                    </span>
                  )}
                </div>

                {/* Edit icon (visible on hover) */}
                {onTaskClick && (
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: getColWidth(GANTT_COLUMNS[11]) }}
                    onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                  >
                    <svg
                      className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary-500 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Draggable splitter */}
        <div
          className={`flex-shrink-0 cursor-col-resize select-none transition-colors ${splitterDrag ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600 hover:bg-primary-400'}`}
          style={{ width: 5 }}
          onMouseDown={(e) => { e.preventDefault(); setSplitterDrag({ startX: e.clientX, startW: tableWidth }); }}
        />

        {/* ============================================================= */}
        {/* RIGHT: Gantt timeline                                          */}
        {/* ============================================================= */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
        >
          <div style={{ width: timelineWidth, position: 'relative' }}>
            {/* Timeline header — two-tier timescale */}
            <div
              className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
              style={{ height: HEADER_H }}
            >
              {/* Upper tier (26px) */}
              {timescale.upper.length > 0 && timescale.upper.map((band, i) => (
                <div
                  key={`u-${i}`}
                  className="absolute top-0 flex items-center border-l border-gray-300 dark:border-gray-500 overflow-hidden"
                  style={{ left: band.left, width: band.width, height: 26 }}
                >
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide px-1.5 truncate">
                    {band.label}
                  </span>
                </div>
              ))}
              {/* Lower tier (26px) */}
              {timescale.lower.map((band, i) => (
                <div
                  key={`l-${i}`}
                  className="absolute flex items-center border-l border-gray-200 dark:border-gray-600 overflow-hidden"
                  style={{ left: band.left, width: band.width, height: 26, top: timescale.upper.length > 0 ? 26 : 0 }}
                >
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 px-1 truncate">
                    {band.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid lines (vertical from lower-tier boundaries) */}
            <div
              className="absolute top-0 left-0"
              style={{ width: timelineWidth, height: HEADER_H + rows.length * ROW_H }}
            >
              {timescale.lower.map((band, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-gray-100 dark:border-gray-700"
                  style={{ left: band.left }}
                />
              ))}
            </div>

            {/* Today line */}
            {todayOffset !== null && (
              <div
                className="absolute top-0 z-20"
                style={{
                  left: todayOffset,
                  height: HEADER_H + rows.length * ROW_H,
                  width: 2,
                  background: '#ef4444',
                }}
              >
                <div className="absolute -top-0.5 -left-[11px] bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm">
                  TODAY
                </div>
              </div>
            )}

            {/* Baseline ghost bars */}
            {rows.map(({ task }, idx) => {
              const bl = baselineMap.get(task.id);
              if (!bl) return null;
              const bStart = toDate(bl.startDate);
              const bEnd = toDate(bl.endDate);
              if (!bStart || !bEnd) return null;

              const left = daysBetween(minDate, bStart) * dayPx;
              const width = Math.max(daysBetween(bStart, bEnd) * dayPx, 8);
              const top = HEADER_H + idx * ROW_H + 2;
              const barH = ROW_H - 4;

              return (
                <div
                  key={`bl-${task.id}`}
                  className="absolute print-baseline-bar"
                  style={{ left, top, width, height: barH }}
                >
                  <div
                    className="absolute inset-0 rounded-sm"
                    style={{
                      backgroundColor: '#d1d5db',
                      opacity: 0.35,
                      border: '1px dashed #9ca3af',
                    }}
                  />
                </div>
              );
            })}

            {/* Task bars */}
            {rows.map(({ task }, idx) => {
              const start = toDate(task.startDate);
              const end = toDate(task.endDate);
              if (!start || !end) return null;

              const baseLeft = daysBetween(minDate, start) * dayPx;
              const baseWidth = Math.max(daysBetween(start, end) * dayPx, 8);
              const { leftDelta, widthDelta } = getDragOffset(task.id);
              const left = baseLeft + leftDelta;
              const width = Math.max(baseWidth + widthDelta, 8);
              const pct = task.progressPercentage ?? 0;
              const isCritical = criticalSet.has(task.id);
              const colors = isCritical
                ? { bg: '#fef2f2', fill: '#dc2626', text: '#991b1b' }
                : barColors[task.status] || barColors.pending;
              const isParent = rows.some((r) => r.task.parentTaskId === task.id);
              const top = HEADER_H + idx * ROW_H + 6;
              const barH = ROW_H - 12;
              const isDragging = drag?.taskId === task.id;
              const canDrag = !!onTaskDragEnd;

              // Milestone: render as a diamond instead of a bar
              if (task.isMilestone) {
                const diamondSize = 14;
                const cx = left;
                const cy = HEADER_H + idx * ROW_H + ROW_H / 2;
                return (
                  <div
                    key={task.id}
                    className="absolute group/bar"
                    style={{ left: cx - diamondSize / 2, top: cy - diamondSize / 2, width: diamondSize, height: diamondSize }}
                  >
                    <div
                      className="w-full h-full rotate-45"
                      style={{
                        backgroundColor: colors.fill,
                        border: isCritical ? '2px solid #dc2626' : `1px solid ${colors.fill}`,
                      }}
                    />
                    {/* Milestone tooltip */}
                    <div className="invisible group-hover/bar:visible absolute z-30 left-1/2 -translate-x-1/2 -top-14 bg-gray-900 text-white rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-lg pointer-events-none">
                      <div className="font-semibold">
                        {isCritical && <span className="text-red-400">[Critical] </span>}
                        Milestone: {task.name}
                      </div>
                      <div className="text-gray-300 mt-0.5">{formatShortDate(start)}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={task.id}
                  className={`absolute group/bar ${isDragging ? 'opacity-80 z-20' : ''}`}
                  style={{
                    left, top, width, height: barH,
                    cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : undefined,
                    userSelect: isDragging ? 'none' : undefined,
                  }}
                  onMouseDown={canDrag ? (e) => handleBarMouseDown(e, task) : undefined}
                >
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 rounded-sm"
                    style={{
                      backgroundColor: colors.bg,
                      border: isCritical ? '2px solid #dc2626' : `1px solid ${colors.fill}40`,
                    }}
                  />

                  {/* Progress fill */}
                  {pct > 0 && (
                    <div
                      className="absolute top-0 left-0 bottom-0 rounded-sm"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: colors.fill,
                        opacity: isParent ? 0.7 : 0.5,
                      }}
                    />
                  )}

                  {/* Summary bar style — diamond markers for parent tasks */}
                  {isParent && (
                    <>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -left-[3px] w-[6px] h-[6px] rotate-45"
                        style={{ backgroundColor: colors.fill }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -right-[3px] w-[6px] h-[6px] rotate-45"
                        style={{ backgroundColor: colors.fill }}
                      />
                    </>
                  )}

                  {/* Bar label (shows on hover or if bar is wide enough) */}
                  {width > 60 && (
                    <div
                      className="absolute inset-0 flex items-center px-1.5 z-10"
                    >
                      <span
                        className="text-xs font-medium truncate"
                        style={{ color: colors.text }}
                      >
                        {task.name}
                      </span>
                    </div>
                  )}

                  {/* Recurring task indicator */}
                  {task.isRecurrenceTemplate && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary-500 text-white flex items-center justify-center z-10" title="Recurring task">
                      <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                      </svg>
                    </div>
                  )}

                  {/* Resize handle on right edge */}
                  {canDrag && (
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-ew-resize opacity-0 group-hover/bar:opacity-100 transition-opacity z-10"
                      style={{ borderRight: `2px solid ${colors.fill}` }}
                    />
                  )}

                  {/* Tooltip on hover */}
                  <div className={`${isDragging ? 'invisible' : 'invisible group-hover/bar:visible'} absolute z-30 left-0 -top-16 bg-gray-900 text-white rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-lg pointer-events-none`}>
                    <div className="font-semibold">
                      {isCritical && <span className="text-red-400">[Critical] </span>}
                      {task.name}
                    </div>
                    <div className="text-gray-300 mt-0.5">
                      {formatShortDate(start)} — {formatShortDate(end)} &middot;{' '}
                      {daysBetween(start, end)}d &middot; {pct}% complete
                    </div>
                    {task.assignedTo && (
                      <div className="text-gray-300">
                        Assigned: {task.assignedTo}
                      </div>
                    )}
                    {task.dependencies && task.dependencies.length > 0 && (() => {
                      return task.dependencies.map((dep, di) => {
                        const depTask = tasks.find(t => t.id === dep.dependencyId);
                        const depRowNum = rowNumMap.get(dep.dependencyId);
                        const depType = (dep.dependencyType || 'FS').toUpperCase();
                        const lag = dep.lagDays || 0;
                        const health = getDepHealth(dep.dependencyId);
                        let label = depRowNum != null ? String(depRowNum) : '?';
                        if (depType !== 'FS') label += depType;
                        if (lag !== 0) label += (lag > 0 ? `+${lag}d` : `${lag}d`);
                        const healthLabel = health === 'satisfied' ? 'Done' : health === 'in_progress' ? 'Active' : 'At Risk';
                        return (
                          <div key={di} className="text-gray-300">
                            Pred: <span className="font-mono">{label}</span> {depTask ? `(${depTask.name})` : ''}{' '}
                            <span style={{ color: healthColor(health) }}>[{healthLabel}]</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}

            {/* Dependency arrows */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: timelineWidth,
                height: HEADER_H + rows.length * ROW_H,
              }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="#9ca3af" />
                </marker>
                <marker id="arrowhead-green" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="#22c55e" />
                </marker>
                <marker id="arrowhead-yellow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="#eab308" />
                </marker>
                <marker id="arrowhead-red" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
                </marker>
              </defs>
              {rows.flatMap(({ task }, idx) => {
                if (!task.dependencies || task.dependencies.length === 0) return [];
                const taskStart = toDate(task.startDate);
                const taskEnd = toDate(task.endDate);
                if (!taskStart || !taskEnd) return [];

                return task.dependencies.map((dep, di) => {
                  const depIdx = rows.findIndex(r => r.task.id === dep.dependencyId);
                  if (depIdx === -1) return null;

                  const depTask = rows[depIdx].task;
                  const depStart = toDate(depTask.startDate);
                  const depEnd = toDate(depTask.endDate);
                  if (!depStart || !depEnd) return null;

                  const depType = (dep.dependencyType || 'FS').toUpperCase();
                  const y1 = HEADER_H + depIdx * ROW_H + ROW_H / 2;
                  const y2 = HEADER_H + idx * ROW_H + ROW_H / 2;

                  let x1: number, x2: number;
                  switch (depType) {
                    case 'SS':
                      x1 = daysBetween(minDate, depStart) * dayPx;
                      x2 = daysBetween(minDate, taskStart) * dayPx;
                      break;
                    case 'FF':
                      x1 = daysBetween(minDate, depEnd) * dayPx;
                      x2 = daysBetween(minDate, taskEnd) * dayPx;
                      break;
                    case 'SF':
                      x1 = daysBetween(minDate, depStart) * dayPx;
                      x2 = daysBetween(minDate, taskEnd) * dayPx;
                      break;
                    default: // FS
                      x1 = daysBetween(minDate, depEnd) * dayPx;
                      x2 = daysBetween(minDate, taskStart) * dayPx;
                      break;
                  }

                  const midX = x1 + (x1 <= x2 ? 10 : -10);
                  const health = getDepHealth(dep.dependencyId);
                  const arrowColor = healthColor(health);
                  const arrowheadId = health === 'satisfied' ? 'arrowhead-green' : health === 'in_progress' ? 'arrowhead-yellow' : 'arrowhead-red';

                  return (
                    <path
                      key={`dep-${task.id}-${di}`}
                      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
                      fill="none"
                      stroke={arrowColor}
                      strokeWidth="1.5"
                      markerEnd={`url(#${arrowheadId})`}
                      opacity={0.7}
                    />
                  );
                });
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center gap-4 flex-wrap print-legend">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-3 h-2.5 rounded-sm"
              style={{ backgroundColor: barColors[key]?.fill || '#9ca3af' }}
            />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-3 h-0.5 bg-red-500" />
          <span className="text-xs text-gray-500">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">
            <svg width="16" height="8" className="inline-block">
              <line
                x1="0"
                y1="4"
                x2="14"
                y2="4"
                stroke="#9ca3af"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
              />
            </svg>
          </span>
          <span className="text-xs text-gray-500">Dependency</span>
        </div>
        {criticalPathTaskIds && criticalPathTaskIds.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm border-2 border-red-600 bg-red-50" />
            <span className="text-xs text-gray-500">Critical Path</span>
          </div>
        )}
        {baselineTasks && baselineTasks.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm bg-gray-300 border border-dashed border-gray-400 opacity-50" />
            <span className="text-xs text-gray-500">Baseline</span>
          </div>
        )}
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          .print-legend { display: flex !important; }
          .print\\:hidden { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          @page { size: landscape; margin: 0.3in; }
          #gantt-print-container { max-height: none !important; overflow: visible !important; }
          nav, aside, header, .fixed { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
