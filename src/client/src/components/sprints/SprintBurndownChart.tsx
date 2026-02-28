import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown } from 'lucide-react';
import { apiService } from '../../services/api';

interface BurndownPoint {
  date: string;
  remaining: number;
}

interface SprintBurndownData {
  totalPoints: number;
  pointsCompleted: number;
  pointsRemaining: number;
  daysRemaining: number;
  startDate: string;
  endDate: string;
  dataPoints: BurndownPoint[];
}

interface SprintBurndownChartProps {
  sprintId: string;
}

function formatDateShort(s: string): string {
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

export function SprintBurndownChart({ sprintId }: SprintBurndownChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: BurndownPoint; ideal: number } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sprintBurndown', sprintId],
    queryFn: () => apiService.getSprintBurndown(sprintId),
  });

  const burndown: SprintBurndownData | null = data?.burndown ?? data ?? null;

  const svgWidth = 700;
  const svgHeight = 320;

  const chart = useMemo(() => {
    if (!burndown || !burndown.dataPoints || burndown.dataPoints.length === 0) return null;

    const padding = { top: 24, right: 24, bottom: 44, left: 50 };
    const plotWidth = svgWidth - padding.left - padding.right;
    const plotHeight = svgHeight - padding.top - padding.bottom;

    const { totalPoints, dataPoints, startDate, endDate } = burndown;
    const maxVal = totalPoints || Math.max(...dataPoints.map((p) => p.remaining), 1);

    // Build full date range from startDate to endDate for ideal line
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

    const scaleX = (dayIndex: number) => padding.left + (dayIndex / totalDays) * plotWidth;
    const scaleY = (v: number) => padding.top + (1 - v / maxVal) * plotHeight;

    // Ideal burndown: straight line from totalPoints to 0
    const idealStart = `${scaleX(0)},${scaleY(totalPoints)}`;
    const idealEnd = `${scaleX(totalDays)},${scaleY(0)}`;
    const idealLine = `${idealStart} ${idealEnd}`;

    // Actual burndown line
    const actualPoints: { x: number; y: number; point: BurndownPoint; dayIndex: number }[] = [];
    for (const dp of dataPoints) {
      const dpDate = new Date(dp.date + 'T00:00:00');
      const dayIndex = Math.round((dpDate.getTime() - start.getTime()) / 86400000);
      const x = scaleX(dayIndex);
      const y = scaleY(dp.remaining);
      actualPoints.push({ x, y, point: dp, dayIndex });
    }
    const actualLine = actualPoints.map((p) => `${p.x},${p.y}`).join(' ');

    // Today marker
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDayIndex = Math.round((today.getTime() - start.getTime()) / 86400000);
    const todayX = todayDayIndex >= 0 && todayDayIndex <= totalDays ? scaleX(todayDayIndex) : -1;

    // X-axis labels (show ~6-8 labels)
    const labelStep = Math.max(1, Math.floor(totalDays / 7));
    const xLabels: { label: string; x: number }[] = [];
    for (let d = 0; d <= totalDays; d += labelStep) {
      const labelDate = new Date(start.getTime() + d * 86400000);
      xLabels.push({
        label: formatDateShort(labelDate.toISOString().slice(0, 10)),
        x: scaleX(d),
      });
    }
    // Always include end
    if (xLabels.length > 0 && xLabels[xLabels.length - 1].x < scaleX(totalDays) - 30) {
      xLabels.push({ label: formatDateShort(endDate), x: scaleX(totalDays) });
    }

    // Y-axis labels
    const ySteps = 5;
    const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
      const val = Math.round((maxVal / ySteps) * i);
      return { val, y: scaleY(val) };
    });

    return { idealLine, actualLine, actualPoints, todayX, xLabels, yLabels, padding, plotWidth, plotHeight, totalPoints, totalDays };
  }, [burndown]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Failed to load burndown data.</p>
      </div>
    );
  }

  if (!burndown || !chart) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <TrendingDown className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No burndown data available</p>
        <p className="text-xs text-gray-400 mt-1">Burndown data will appear once the sprint is started and tasks are tracked.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">Sprint Burndown</h3>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 px-4 pt-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Total</div>
          <div className="text-lg font-bold text-gray-800">{burndown.totalPoints}</div>
          <div className="text-[10px] text-gray-400">points</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Completed</div>
          <div className="text-lg font-bold text-green-600">{burndown.pointsCompleted}</div>
          <div className="text-[10px] text-gray-400">points</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Remaining</div>
          <div className="text-lg font-bold text-indigo-600">{burndown.pointsRemaining}</div>
          <div className="text-[10px] text-gray-400">points</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Days Left</div>
          <div className="text-lg font-bold text-amber-600">{Math.max(0, burndown.daysRemaining)}</div>
          <div className="text-[10px] text-gray-400">days</div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="px-4 pb-4 pt-2 relative">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" style={{ maxHeight: svgHeight }}>
          {/* Grid lines */}
          {chart.yLabels.map((yl, i) => (
            <g key={i}>
              <line
                x1={chart.padding.left}
                y1={yl.y}
                x2={chart.padding.left + chart.plotWidth}
                y2={yl.y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={chart.padding.left - 8} y={yl.y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {yl.val}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {chart.xLabels.map((xl, i) => (
            <text key={i} x={xl.x} y={svgHeight - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">
              {xl.label}
            </text>
          ))}

          {/* Ideal burndown line (dashed gray) */}
          <polyline
            points={chart.idealLine}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            strokeDasharray="6 3"
          />

          {/* Actual burndown line (solid indigo) */}
          {chart.actualLine && (
            <polyline
              points={chart.actualLine}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Data point circles */}
          {chart.actualPoints.map((ap, i) => (
            <circle
              key={i}
              cx={ap.x}
              cy={ap.y}
              r="3.5"
              fill="#6366f1"
              stroke="white"
              strokeWidth="1.5"
              className="hover:r-[5]"
              onMouseEnter={(e) => {
                const idealRemaining =
                  chart.totalPoints - (ap.dayIndex / chart.totalDays) * chart.totalPoints;
                setTooltip({
                  x: e.clientX,
                  y: e.clientY,
                  point: ap.point,
                  ideal: Math.round(idealRemaining),
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {/* Today marker (vertical dashed line) */}
          {chart.todayX > 0 && (
            <g>
              <line
                x1={chart.todayX}
                y1={chart.padding.top}
                x2={chart.todayX}
                y2={chart.padding.top + chart.plotHeight}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text
                x={chart.todayX}
                y={chart.padding.top - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#f59e0b"
                fontWeight="600"
              >
                Today
              </text>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-5 justify-center mt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5" style={{ borderTop: '2px dashed #9ca3af' }} />
            <span className="text-gray-600">Ideal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-indigo-500 rounded" />
            <span className="text-gray-600">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ borderTop: '2px dashed #f59e0b' }} />
            <span className="text-gray-600">Today</span>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg"
            style={{ left: tooltip.x + 10, top: tooltip.y - 60 }}
          >
            <p className="font-medium">{formatDateShort(tooltip.point.date)}</p>
            <p>Remaining: {tooltip.point.remaining} pts</p>
            <p>Ideal: {tooltip.ideal} pts</p>
          </div>
        )}
      </div>
    </div>
  );
}
