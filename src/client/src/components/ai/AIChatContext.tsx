import React from 'react';
import { LayoutDashboard, FolderKanban, FileBarChart } from 'lucide-react';
import type { AIPanelContext } from '../../stores/uiStore';

interface AIChatContextProps {
  context: AIPanelContext;
}

const contextConfig: Record<AIPanelContext['type'], { icon: React.ElementType; label: string; color: string }> = {
  dashboard: { icon: LayoutDashboard, label: 'Dashboard', color: 'text-blue-600 bg-blue-50' },
  project: { icon: FolderKanban, label: 'Project', color: 'text-indigo-600 bg-indigo-50' },
  schedule: { icon: FolderKanban, label: 'Schedule', color: 'text-purple-600 bg-purple-50' },
  reports: { icon: FileBarChart, label: 'Reports', color: 'text-orange-600 bg-orange-50' },
  general: { icon: LayoutDashboard, label: 'General', color: 'text-gray-600 bg-gray-50' },
};

export function AIChatContext({ context }: AIChatContextProps) {
  const config = contextConfig[context.type] || contextConfig.general;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
      <span className="text-xs text-gray-400">Context:</span>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
        {context.projectName && (
          <span className="max-w-[140px] truncate">
            &middot; {context.projectName}
          </span>
        )}
      </span>
    </div>
  );
}
