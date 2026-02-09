import React, { useMemo, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GanttTask {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  progressPercentage?: number;
  dependency?: string;
  dependencyType?: string;
  parentTaskId?: string;
  assignedTo?: string;
  estimatedDays?: number;
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

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Build a flat, sorted list of tasks with WBS numbers & hierarchy levels */
function buildFlatRows(tasks: GanttTask[]): FlatRow[] {
  const rows: FlatRow[] = [];
  const topLevel = tasks.filter((t) => !t.parentTaskId);
  // Sort by start date
  topLevel.sort((a, b) => {
    const da = toDate(a.startDate)?.getTime() ?? 0;
    const db = toDate(b.startDate)?.getTime() ?? 0;
    return da - db;
  });

  function addChildren(parentId: string, level: number, parentWbs: string) {
    const children = tasks
      .filter((t) => t.parentTaskId === parentId)
      .sort((a, b) => {
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
const HEADER_H = 48;
const DAY_PX = 3.2; // pixels per day — controls how wide the timeline is
const TABLE_MIN_W = 520;

// ---------------------------------------------------------------------------
// GanttChart component
// ---------------------------------------------------------------------------

export function GanttChart({
  tasks,
  scheduleName,
  onTaskClick,
  onAddTask,
}: {
  tasks: GanttTask[];
  scheduleName?: string;
  /** Called when a task row is clicked */
  onTaskClick?: (task: GanttTask) => void;
  /** Called when the "Add Task" button is clicked */
  onAddTask?: () => void;
}) {
  const rows = useMemo(() => buildFlatRows(tasks), [tasks]);
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

  const timelineWidth = totalDays * DAY_PX;

  // Scroll to today on mount
  useEffect(() => {
    if (!timelineRef.current) return;
    const today = new Date();
    const dayOffset = daysBetween(minDate, today);
    const px = dayOffset * DAY_PX - 200;
    timelineRef.current.scrollLeft = Math.max(0, px);
  }, [minDate]);

  // Build month columns for header
  const months = useMemo(() => {
    const result: { label: string; left: number; width: number }[] = [];
    const cursor = new Date(minDate);
    cursor.setDate(1);
    if (cursor < minDate) cursor.setMonth(cursor.getMonth() + 1);

    while (cursor <= maxDate) {
      const monthStart = new Date(Math.max(cursor.getTime(), minDate.getTime()));
      const nextMonth = new Date(cursor);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = new Date(Math.min(nextMonth.getTime(), maxDate.getTime()));

      const left = daysBetween(minDate, monthStart) * DAY_PX;
      const width = daysBetween(monthStart, monthEnd) * DAY_PX;

      result.push({ label: formatMonthYear(cursor), left, width });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }, [minDate, maxDate]);

  // Today line position
  const todayOffset = useMemo(() => {
    const today = new Date();
    if (today < minDate || today > maxDate) return null;
    return daysBetween(minDate, today) * DAY_PX;
  }, [minDate, maxDate]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No tasks to display.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Schedule title bar */}
      {scheduleName && (
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-indigo-500" />
            <span className="text-sm font-semibold text-gray-800">
              {scheduleName}
            </span>
            <span className="text-xs text-gray-400 ml-2">
              {rows.length} tasks
            </span>
          </div>
          {onAddTask && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          )}
        </div>
      )}

      <div className="flex overflow-hidden" style={{ maxHeight: '70vh' }}>
        {/* ============================================================= */}
        {/* LEFT: Task table                                               */}
        {/* ============================================================= */}
        <div
          className="flex-shrink-0 border-r border-gray-200 overflow-y-auto"
          style={{ minWidth: TABLE_MIN_W, maxWidth: TABLE_MIN_W }}
        >
          {/* Table header */}
          <div
            className="sticky top-0 z-10 flex items-center bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wider"
            style={{ height: HEADER_H }}
          >
            <div className="w-12 px-2 text-center">WBS</div>
            <div className="flex-1 px-2">Task Name</div>
            <div className="w-20 px-1 text-center">Start</div>
            <div className="w-20 px-1 text-center">End</div>
            <div className="w-12 px-1 text-center">%</div>
            <div className="w-16 px-1 text-center">Status</div>
          </div>

          {/* Task rows */}
          {rows.map(({ task, level, wbs }) => {
            const start = toDate(task.startDate);
            const end = toDate(task.endDate);
            const pct = task.progressPercentage ?? 0;
            const isParent = rows.some((r) => r.task.parentTaskId === task.id);

            return (
              <div
                key={task.id}
                className={`flex items-center border-b border-gray-100 hover:bg-blue-50/40 transition-colors group ${onTaskClick ? 'cursor-pointer' : ''}`}
                style={{ height: ROW_H }}
                onClick={() => onTaskClick?.(task)}
              >
                {/* WBS */}
                <div className="w-12 px-2 text-center text-[10px] text-gray-400 font-mono">
                  {wbs}
                </div>

                {/* Task name with indent */}
                <div
                  className="flex-1 px-2 flex items-center gap-1.5 min-w-0"
                  style={{ paddingLeft: `${8 + level * 20}px` }}
                >
                  {task.priority && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[task.priority] || 'bg-gray-300'}`}
                    />
                  )}
                  <span
                    className={`text-xs truncate ${isParent ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                    title={task.name}
                  >
                    {task.name}
                  </span>
                </div>

                {/* Start */}
                <div className="w-20 px-1 text-center text-[10px] text-gray-500">
                  {start ? formatShortDate(start) : '—'}
                </div>

                {/* End */}
                <div className="w-20 px-1 text-center text-[10px] text-gray-500">
                  {end ? formatShortDate(end) : '—'}
                </div>

                {/* % Complete */}
                <div className="w-12 px-1 text-center text-[10px] font-medium text-gray-600">
                  {pct}%
                </div>

                {/* Status */}
                <div className="w-16 px-1 text-center">
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
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
                </div>
              </div>
            );
          })}
        </div>

        {/* ============================================================= */}
        {/* RIGHT: Gantt timeline                                          */}
        {/* ============================================================= */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
        >
          <div style={{ width: timelineWidth, position: 'relative' }}>
            {/* Timeline header — months */}
            <div
              className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200"
              style={{ height: HEADER_H }}
            >
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex items-end pb-1.5 border-l border-gray-200"
                  style={{
                    left: m.left,
                    width: m.width,
                    height: HEADER_H,
                  }}
                >
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-2">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid lines (vertical month borders) */}
            <div
              className="absolute top-0 left-0"
              style={{ width: timelineWidth, height: HEADER_H + rows.length * ROW_H }}
            >
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-gray-100"
                  style={{ left: m.left }}
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

            {/* Task bars */}
            {rows.map(({ task }, idx) => {
              const start = toDate(task.startDate);
              const end = toDate(task.endDate);
              if (!start || !end) return null;

              const left = daysBetween(minDate, start) * DAY_PX;
              const width = Math.max(daysBetween(start, end) * DAY_PX, 8);
              const pct = task.progressPercentage ?? 0;
              const colors = barColors[task.status] || barColors.pending;
              const isParent = rows.some((r) => r.task.parentTaskId === task.id);
              const top = HEADER_H + idx * ROW_H + 6;
              const barH = ROW_H - 12;

              return (
                <div
                  key={task.id}
                  className="absolute group/bar"
                  style={{ left, top, width, height: barH }}
                >
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 rounded-sm"
                    style={{
                      backgroundColor: colors.bg,
                      border: `1px solid ${colors.fill}40`,
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
                        className="text-[9px] font-medium truncate"
                        style={{ color: colors.text }}
                      >
                        {task.name}
                      </span>
                    </div>
                  )}

                  {/* Tooltip on hover */}
                  <div className="invisible group-hover/bar:visible absolute z-30 left-0 -top-16 bg-gray-900 text-white rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-lg pointer-events-none">
                    <div className="font-semibold">{task.name}</div>
                    <div className="text-gray-300 mt-0.5">
                      {formatShortDate(start)} — {formatShortDate(end)} &middot;{' '}
                      {daysBetween(start, end)}d &middot; {pct}% complete
                    </div>
                    {task.assignedTo && (
                      <div className="text-gray-300">
                        Assigned: {task.assignedTo}
                      </div>
                    )}
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
                <marker
                  id="arrowhead"
                  markerWidth="6"
                  markerHeight="4"
                  refX="6"
                  refY="2"
                  orient="auto"
                >
                  <polygon points="0 0, 6 2, 0 4" fill="#9ca3af" />
                </marker>
              </defs>
              {rows.map(({ task }, idx) => {
                if (!task.dependency) return null;
                const depIdx = rows.findIndex(
                  (r) => r.task.id === task.dependency
                );
                if (depIdx === -1) return null;

                const depTask = rows[depIdx].task;
                const depEnd = toDate(depTask.endDate);
                const taskStart = toDate(task.startDate);
                if (!depEnd || !taskStart) return null;

                const x1 = daysBetween(minDate, depEnd) * DAY_PX;
                const y1 = HEADER_H + depIdx * ROW_H + ROW_H / 2;
                const x2 = daysBetween(minDate, taskStart) * DAY_PX;
                const y2 = HEADER_H + idx * ROW_H + ROW_H / 2;

                // Elbow path: right, down, right
                const midX = x1 + 10;

                return (
                  <path
                    key={`dep-${task.id}`}
                    d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1.5"
                    markerEnd="url(#arrowhead)"
                    opacity={0.6}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-4 flex-wrap">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-3 h-2.5 rounded-sm"
              style={{ backgroundColor: barColors[key]?.fill || '#9ca3af' }}
            />
            <span className="text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-3 h-0.5 bg-red-500" />
          <span className="text-[10px] text-gray-500">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">
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
          <span className="text-[10px] text-gray-500">Dependency</span>
        </div>
      </div>
    </div>
  );
}
