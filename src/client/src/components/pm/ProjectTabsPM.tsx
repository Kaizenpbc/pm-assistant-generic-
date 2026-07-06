interface ProjectTabsPMProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: Record<string, number>;
}

const TABS = [
  { id: 'tasks',      label: 'Tasks' },
  { id: 'risks',      label: 'Risks' },
  { id: 'issues',     label: 'Issues' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'raid',       label: 'RAID' },
  { id: 'documents',  label: 'Documents' },
];

export function ProjectTabsPM({ activeTab, onTabChange, counts }: ProjectTabsPMProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
      <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap
                transition-colors duration-150
                ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold
                    ${
                      isActive
                        ? 'bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }
                  `}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
