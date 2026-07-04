import { BookOpen } from 'lucide-react';

interface ReadingLevelBadgeProps {
  score: number;
  level: 'easy' | 'moderate' | 'advanced';
  grade?: string;
}

const levelColors = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const levelLabels = {
  easy: 'Easy',
  moderate: 'Moderate',
  advanced: 'Advanced',
};

export function ReadingLevelBadge({ score, level, grade }: ReadingLevelBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[level]}`}
      title={`Flesch Reading Ease: ${score}${grade ? `, Grade ${grade}` : ''}`}
    >
      <BookOpen className="w-3 h-3" />
      {levelLabels[level]}
    </span>
  );
}
