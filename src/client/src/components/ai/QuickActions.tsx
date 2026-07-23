import React from 'react';
import {
  Shield,
  Sun,
  Plus,
  FileText,
  BarChart3,
  AlertTriangle,
  Zap,
  List,
} from 'lucide-react';
import type { QuickAction } from '../../stores/aiChatStore';

interface QuickActionsProps {
  actions: QuickAction[];
  onAction: (action: QuickAction) => void;
}

const iconMap: Record<string, React.ElementType> = {
  Shield,
  Sun,
  Plus,
  FileText,
  BarChart3,
  AlertTriangle,
  Zap,
  List,
};

export function QuickActions({ actions, onAction }: QuickActionsProps) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
      <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Quick actions</p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = iconMap[action.icon] || Zap;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 transition-all hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary-500 dark:text-primary-400" />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
