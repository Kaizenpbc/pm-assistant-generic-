import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GanttTask } from './GanttChart';

const barColors: Record<string, string> = {
  completed: 'bg-green-500',
  in_progress: 'bg-blue-500',
  pending: 'bg-gray-400',
  cancelled: 'bg-red-400',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarViewProps {
  tasks: GanttTask[];
  onTaskClick: (task: GanttTask) => void;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateOnly(s: string): Date {
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Build grid days
  const gridDays = useMemo(() => {
    const days: Date[] = [];
    // Fill from start of week
    const firstDay = new Date(monthStart);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay());
    // Fill to 6 weeks
    for (let i = 0; i < 42; i++) {
      days.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i));
    }
    return days;
  }, [monthStart.getTime()]);

  // Tasks that overlap with this month
  const monthTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.startDate && !t.endDate) return false;
      const start = t.startDate ? toDateOnly(t.startDate) : toDateOnly(t.endDate!);
      const end = t.endDate ? toDateOnly(t.endDate) : start;
      return start <= monthEnd && end >= monthStart;
    });
  }, [tasks, monthStart.getTime(), monthEnd.getTime()]);

  // Get tasks for a specific day
  const getTasksForDay = (day: Date) => {
    return monthTasks.filter(t => {
      const start = t.startDate ? toDateOnly(t.startDate) : toDateOnly(t.endDate!);
      const end = t.endDate ? toDateOnly(t.endDate) : start;
      return day >= start && day <= end;
    });
  };

  // Check if task starts on this day
  const taskStartsOnDay = (task: GanttTask, day: Date) => {
    if (!task.startDate) return isSameDay(day, toDateOnly(task.endDate!));
    return isSameDay(day, toDateOnly(task.startDate));
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white min-w-[160px] text-center">{monthLabel}</h3>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/40 dark:text-primary-400 rounded-md transition-colors"
        >
          Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {DAYS.map(day => (
          <div key={day} className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {gridDays.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, today);
          const dayTasks = getTasksForDay(day);

          return (
            <div
              key={idx}
              className={`min-h-[80px] border-b border-r border-gray-100 dark:border-gray-800 p-1 ${
                !isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''
              } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
            >
              {/* Day number */}
              <div className="flex justify-end mb-0.5">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-primary-600 text-white'
                    : isCurrentMonth
                    ? 'text-gray-700 dark:text-gray-200'
                    : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {day.getDate()}
                </span>
              </div>

              {/* Task pills */}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => {
                  const startsHere = taskStartsOnDay(task, day);
                  const color = barColors[task.status] || barColors.pending;
                  return startsHere ? (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`w-full text-left rounded px-1.5 py-0.5 text-xs font-medium text-white truncate ${color} hover:opacity-80 transition-opacity`}
                      title={task.name}
                    >
                      {task.name}
                    </button>
                  ) : (
                    <div
                      key={task.id}
                      className={`w-full h-[18px] rounded-sm ${color} opacity-40 cursor-pointer hover:opacity-60`}
                      onClick={() => onTaskClick(task)}
                      title={task.name}
                    />
                  );
                })}
                {dayTasks.length > 3 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 pl-1">+{dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
