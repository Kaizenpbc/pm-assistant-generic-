import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, X } from 'lucide-react';

interface ReadinessStep {
  key: string;
  label: string;
  tooltip: string;
  done: boolean;
  action: () => void;
}

interface ProjectReadinessBarProps {
  projectId: string;
  tasks: any[];
  resources: any[];
  scheduleId?: string;
  onTabChange: (tab: string) => void;
}

const STORAGE_PREFIX = 'readiness-dismissed-';
const STEP_PREFIX = 'readiness-step-';

export function ProjectReadinessBar({ projectId, tasks, resources, scheduleId, onTabChange }: ProjectReadinessBarProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(`${STORAGE_PREFIX}${projectId}`) === '1'
  );
  const [clickedSteps, setClickedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(`${STEP_PREFIX}${projectId}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(`${STEP_PREFIX}${projectId}`, JSON.stringify(clickedSteps));
  }, [clickedSteps, projectId]);

  if (dismissed) return null;

  const hasTasks = tasks.length > 0;
  const hasDependencies = tasks.some((t: any) => t.dependency || t.predecessors?.length > 0);
  const hasResources = resources.length > 0;
  const criticalPathClicked = !!clickedSteps['critical-path'];
  const simulationClicked = !!clickedSteps['simulation'];

  const steps: ReadinessStep[] = [
    {
      key: 'tasks',
      label: 'Tasks',
      tooltip: 'Import or create tasks to build your schedule',
      done: hasTasks,
      action: () => onTabChange('schedule'),
    },
    {
      key: 'dependencies',
      label: 'Dependencies',
      tooltip: 'Link tasks to reveal your critical path',
      done: hasDependencies,
      action: () => onTabChange('schedule'),
    },
    {
      key: 'resources',
      label: 'Resources',
      tooltip: 'Add team members for workload and cost forecasting',
      done: hasResources,
      action: () => onTabChange('resources'),
    },
    {
      key: 'critical-path',
      label: 'Critical Path',
      tooltip: 'See which tasks drive your finish date',
      done: criticalPathClicked,
      action: () => {
        setClickedSteps(prev => ({ ...prev, 'critical-path': true }));
        onTabChange('schedule');
      },
    },
    {
      key: 'simulation',
      label: 'Simulation',
      tooltip: 'Run Monte Carlo to quantify schedule risk',
      done: simulationClicked,
      action: () => {
        setClickedSteps(prev => ({ ...prev, simulation: true }));
        if (scheduleId) {
          navigate(`/monte-carlo/${scheduleId}`);
        } else {
          navigate(`/monte-carlo`);
        }
      },
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  const handleDismiss = () => {
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, '1');
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
      {steps.map((step, i) => (
        <span key={step.key} className="contents">
          {i > 0 && <span className="text-gray-300 dark:text-gray-600 text-xs mx-0.5 flex-shrink-0 hidden sm:inline">&middot;</span>}
          <button
            onClick={step.action}
            title={step.tooltip}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              step.done
                ? 'text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            {step.label}
          </button>
        </span>
      ))}
      <span className="ml-auto flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {completedCount}/{steps.length} ready
        </span>
        <button
          onClick={handleDismiss}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    </div>
  );
}
