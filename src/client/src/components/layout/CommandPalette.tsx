import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, CheckSquare, ArrowRight, Plus, BarChart3, FileText, AlertTriangle, Target, Users, BookOpen, GitPullRequest, Zap, MessageSquare } from 'lucide-react';
import { apiService } from '../../services/api';

interface SearchResult {
  type: 'project' | 'task' | 'goal' | 'lesson' | 'resource' | 'change_request' | 'risk' | 'sprint' | 'comment';
  id: string;
  name: string;
  description?: string;
  status?: string;
  projectId?: string;
  projectName?: string;
  priority?: string;
  severity?: string;
  recordId?: string;
  assignedTo?: string;
  progress?: number;
  raidType?: string;
  taskId?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const quickActions = [
  { label: 'New Project', path: '/projects', icon: Plus, description: 'Create a new project' },
  { label: 'View Portfolio', path: '/portfolio', icon: BarChart3, description: 'Portfolio dashboard' },
  { label: 'Report Builder', path: '/report-builder', icon: FileText, description: 'Build custom reports' },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  planning: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  on_hold: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  completed: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  not_started: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  done: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  low: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  low: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
};

interface CategoryConfig {
  type: SearchResult['type'];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const categories: CategoryConfig[] = [
  { type: 'project', label: 'Projects', icon: FolderKanban },
  { type: 'task', label: 'Tasks', icon: CheckSquare },
  { type: 'risk', label: 'Risks & Issues', icon: AlertTriangle },
  { type: 'goal', label: 'Goals', icon: Target },
  { type: 'resource', label: 'Resources', icon: Users },
  { type: 'lesson', label: 'Lessons', icon: BookOpen },
  { type: 'change_request', label: 'Change Requests', icon: GitPullRequest },
  { type: 'sprint', label: 'Sprints', icon: Zap },
  { type: 'comment', label: 'Comments', icon: MessageSquare },
];

function getStatusColor(status?: string): string {
  if (!status) return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  return statusColors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
}

function formatStatus(status?: string): string {
  if (!status) return '';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ResultBadges({ result }: { result: SearchResult }) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {result.type === 'risk' && result.recordId && (
        <span className="text-xs text-gray-400 font-mono">{result.recordId}</span>
      )}
      {result.type === 'risk' && result.severity && (
        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full ${severityColors[result.severity] || 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
          {formatStatus(result.severity)}
        </span>
      )}
      {result.type === 'task' && result.priority && (
        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full ${priorityColors[result.priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
          {formatStatus(result.priority)}
        </span>
      )}
      {result.type === 'goal' && result.progress != null && result.progress > 0 && (
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(result.progress, 100)}%` }} />
          </div>
          <span className="text-xs text-gray-400">{result.progress}%</span>
        </div>
      )}
      {result.status && (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(result.status)}`}>
          {formatStatus(result.status)}
        </span>
      )}
    </div>
  );
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Total selectable items count
  const totalItems = query.length >= 2 ? results.length : quickActions.length;

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiService.search(query);
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navigateTo = useCallback(
    (path: string) => {
      onClose();
      navigate(path);
    },
    [navigate, onClose]
  );

  const selectResult = useCallback(
    (result: SearchResult) => {
      switch (result.type) {
        case 'project':
          navigateTo(`/project/${result.id}`);
          break;
        case 'task':
        case 'risk':
        case 'change_request':
        case 'sprint':
        case 'comment':
          if (result.projectId) navigateTo(`/project/${result.projectId}`);
          break;
        case 'goal':
          navigateTo('/goals');
          break;
        case 'resource':
          navigateTo('/resources');
          break;
        case 'lesson':
          // No deep link — just close palette
          onClose();
          break;
      }
    },
    [navigateTo, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(totalItems, 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.length >= 2 && results.length > 0) {
        selectResult(results[selectedIndex]);
      } else if (query.length < 2) {
        const action = quickActions[selectedIndex];
        if (action) navigateTo(action.path);
      }
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.querySelector('[data-selected="true"]');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group results by category, preserving order
  const groupedResults: { config: CategoryConfig; items: SearchResult[] }[] = [];
  let flatIndex = 0;
  const flatIndexMap: Map<SearchResult, number> = new Map();

  for (const result of results) {
    flatIndexMap.set(result, flatIndex++);
  }

  for (const cat of categories) {
    const items = results.filter(r => r.type === cat.type);
    if (items.length > 0) {
      groupedResults.push({ config: cat, items });
    }
  }

  const hasResults = query.length >= 2 && results.length > 0;
  const showEmpty = query.length >= 2 && !loading && results.length === 0;
  const showQuickActions = query.length < 2;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Search commands"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, risks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-12 pl-3 pr-4 text-sm bg-transparent border-0 outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-80 overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Searching...</div>
          )}

          {/* Quick Actions (when empty) */}
          {showQuickActions && !loading && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Quick Actions
              </div>
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                const isSelected = selectedIndex === i;
                return (
                  <button
                    key={action.path}
                    data-selected={isSelected}
                    onClick={() => navigateTo(action.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{action.label}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{action.description}</p>
                    </div>
                    <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-primary-400' : 'text-gray-300 dark:text-gray-600'}`} />
                  </button>
                );
              })}
              <div className="px-4 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-xs font-medium">
                  {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}K
                </kbd> to search
              </div>
            </div>
          )}

          {/* Search Results */}
          {hasResults && !loading && (
            <div className="py-2">
              {groupedResults.map(({ config, items }) => {
                const Icon = config.icon;
                return (
                  <React.Fragment key={config.type}>
                    <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1 first:mt-0">
                      {config.label}
                    </div>
                    {items.map((result) => {
                      const idx = flatIndexMap.get(result) ?? -1;
                      const isSelected = selectedIndex === idx;
                      const subtitle = result.projectName || result.description;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          data-selected={isSelected}
                          onClick={() => selectResult(result)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{result.name}</p>
                            {subtitle && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{subtitle}</p>
                            )}
                          </div>
                          <ResultBadges result={result} />
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">No results found for "{query}"</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
