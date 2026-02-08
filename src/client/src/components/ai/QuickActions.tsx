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
    <div className="border-t border-gray-100 px-4 py-3">
      <p className="mb-2 text-xs font-medium text-gray-500">Quick actions</p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = iconMap[action.icon] || Zap;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
