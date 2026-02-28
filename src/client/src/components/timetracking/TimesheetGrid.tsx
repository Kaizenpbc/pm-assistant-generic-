import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function TimesheetGrid() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => {
    const monday = getMonday(new Date());
    return monday.toISOString().slice(0, 10);
  });

  const { data, isLoading } = useQuery({
    queryKey: ['timesheet', weekStart],
    queryFn: () => apiService.getWeeklyTimesheet(weekStart),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteTimeEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timesheet', weekStart] }),
  });

  const entries: any[] = data?.entries || [];
  const days: string[] = data?.days || [];
  const totalHours: number = data?.totalHours || 0;

  // Group entries by task
  const taskMap = new Map<string, { taskId: string; entries: any[] }>();
  for (const e of entries) {
    if (!taskMap.has(e.taskId)) taskMap.set(e.taskId, { taskId: e.taskId, entries: [] });
    taskMap.get(e.taskId)!.entries.push(e);
  }
  const taskRows = Array.from(taskMap.values());

  const navigateWeek = (offset: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offset * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold text-gray-900">
          Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <button onClick={() => navigateWeek(1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Task</th>
                {days.map(d => (
                  <th key={d} className="text-center py-2 px-2 text-xs font-medium text-gray-500 min-w-[80px]">
                    {formatDay(d)}
                  </th>
                ))}
                <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {taskRows.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 2} className="text-center py-8 text-gray-400 text-sm">
                    No time entries for this week
                  </td>
                </tr>
              ) : (
                taskRows.map(({ taskId, entries: taskEntries }) => {
                  const dayTotals = days.map(d => {
                    const dayEntries = taskEntries.filter(e => e.date === d);
                    return { hours: dayEntries.reduce((s: number, e: any) => s + e.hours, 0), entries: dayEntries };
                  });
                  const rowTotal = dayTotals.reduce((s, d) => s + d.hours, 0);
                  return (
                    <tr key={taskId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm font-medium text-gray-900">
                        {taskEntries[0]?.description || taskId}
                      </td>
                      {dayTotals.map((d, i) => (
                        <td key={days[i]} className="text-center py-2 px-2">
                          {d.hours > 0 ? (
                            <div className="group relative">
                              <span className="text-sm font-medium text-gray-900">{d.hours}</span>
                              <button
                                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600"
                                onClick={() => { d.entries.forEach((e: any) => deleteMutation.mutate(e.id)); }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center py-2 px-2 font-semibold text-indigo-600">{rowTotal}h</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300">
                <td className="py-2 px-3 text-sm font-bold text-gray-900">Total</td>
                {days.map(d => {
                  const dayTotal = entries.filter((e: any) => e.date === d).reduce((s: number, e: any) => s + e.hours, 0);
                  return (
                    <td key={d} className="text-center py-2 px-2 font-semibold text-gray-700">
                      {dayTotal > 0 ? `${dayTotal}` : '-'}
                    </td>
                  );
                })}
                <td className="text-center py-2 px-2 font-bold text-indigo-600">{totalHours}h</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
