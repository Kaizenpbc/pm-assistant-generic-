import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, CheckSquare, ArrowRight, Plus, BarChart3, FileText } from 'lucide-react';
import { apiService } from '../../services/api';

interface SearchResult {
  type: 'project' | 'task';
  id: string;
  name: string;
  description?: string;
  status?: string;
  projectId?: string;
  projectName?: string;
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
  active: 'bg-green-100 text-green-700',
  planning: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-gray-100 text-gray-600',
  not_started: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

function getStatusColor(status?: string): string {
  if (!status) return 'bg-gray-100 text-gray-500';
  return statusColors[status] || 'bg-gray-100 text-gray-500';
}

function formatStatus(status?: string): string {
  if (!status) return '';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
      if (result.type === 'project') {
        navigateTo(`/project/${result.id}`);
      } else if (result.type === 'task' && result.projectId) {
        navigateTo(`/project/${result.projectId}`);
      }
    },
    [navigateTo]
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

  const projects = results.filter((r) => r.type === 'project');
  const tasks = results.filter((r) => r.type === 'task');
  const hasResults = query.length >= 2 && results.length > 0;
  const showEmpty = query.length >= 2 && !loading && results.length === 0;
  const showQuickActions = query.length < 2;

  // Map flat selectedIndex to category-aware index
  let projectSelectedIdx = -1;
  let taskSelectedIdx = -1;
  if (query.length >= 2) {
    if (selectedIndex < projects.length) {
      projectSelectedIdx = selectedIndex;
    } else {
      taskSelectedIdx = selectedIndex - projects.length;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-12 pl-3 pr-4 text-sm bg-transparent border-0 outline-none focus:ring-0 placeholder-gray-400 text-gray-900"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded border border-gray-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-80 overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Searching...</div>
          )}

          {/* Quick Actions (when empty) */}
          {showQuickActions && !loading && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                      isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{action.label}</p>
                      <p className="text-xs text-gray-400 truncate">{action.description}</p>
                    </div>
                    <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`} />
                  </button>
                );
              })}
              <div className="px-4 py-3 text-center text-xs text-gray-400">
                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-[10px] font-medium">
                  {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}K
                </kbd> to search
              </div>
            </div>
          )}

          {/* Search Results */}
          {hasResults && !loading && (
            <div className="py-2">
              {/* Projects */}
              {projects.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Projects
                  </div>
                  {projects.map((result, i) => {
                    const isSelected = projectSelectedIdx === i;
                    return (
                      <button
                        key={`project-${result.id}`}
                        data-selected={isSelected}
                        onClick={() => selectResult(result)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <FolderKanban className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{result.name}</p>
                          {result.description && (
                            <p className="text-xs text-gray-400 truncate">{result.description}</p>
                          )}
                        </div>
                        {result.status && (
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${getStatusColor(result.status)}`}>
                            {formatStatus(result.status)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Tasks */}
              {tasks.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
                    Tasks
                  </div>
                  {tasks.map((result, i) => {
                    const isSelected = taskSelectedIdx === i;
                    return (
                      <button
                        key={`task-${result.id}`}
                        data-selected={isSelected}
                        onClick={() => selectResult(result)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{result.name}</p>
                          {result.projectName && (
                            <p className="text-xs text-gray-400 truncate">{result.projectName}</p>
                          )}
                        </div>
                        {result.status && (
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${getStatusColor(result.status)}`}>
                            {formatStatus(result.status)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No results found for "{query}"</p>
              <p className="text-xs text-gray-300 mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
