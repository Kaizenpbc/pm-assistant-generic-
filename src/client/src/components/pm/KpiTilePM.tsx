import { useNavigate } from 'react-router-dom';

type Color = 'green' | 'amber' | 'red' | 'teal' | 'gray';

interface KpiTilePMProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: Color;
  drillPath?: string;
  statusDot?: Color;
}

const chipBg: Record<Color, string> = {
  green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  red:   'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  teal:  'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  gray:  'bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400',
};

const dotBg: Record<Color, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red:   'bg-red-500',
  teal:  'bg-teal-500',
  gray:  'bg-gray-400',
};

export function KpiTilePM({ label, value, icon: Icon, color, drillPath, statusDot }: KpiTilePMProps) {
  const navigate = useNavigate();

  function handleClick() {
    if (drillPath) navigate(drillPath);
  }

  return (
    <div
      onClick={handleClick}
      className={`relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-all duration-150 ${drillPath ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      {statusDot && (
        <span className={`absolute top-2.5 right-2.5 h-2 w-2 rounded-full ${dotBg[statusDot]}`} />
      )}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${chipBg[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[27px] font-[800] leading-tight text-gray-900 dark:text-white">{value}</p>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}
