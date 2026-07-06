interface SparklineCardPMProps {
  title: string;
  data: number[];
  color: string;
  currentValue: number;
  unit?: string;
}

function buildPolylinePoints(data: number[], width: number, height: number): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  return data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = pad + ((max - val) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
}

export function SparklineCardPM({ title, data, color, currentValue, unit = '' }: SparklineCardPMProps) {
  const W = 160;
  const H = 40;
  const points = buildPolylinePoints(data, W, H);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${color}22`, color }}
        >
          {currentValue}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="w-full h-auto">
        {data.length >= 2 ? (
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={color} strokeWidth={1} strokeDasharray="4 2" />
        )}
      </svg>
    </div>
  );
}
