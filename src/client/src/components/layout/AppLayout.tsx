import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Sparkles, X } from 'lucide-react';
import { AIChatPanel } from '../ai/AIChatPanel';
import { useUIStore } from '../../stores/uiStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'pm-generic-sidebar-collapsed';
const AI_PANEL_STORAGE_KEY = 'pm-generic-ai-panel-open';

function readLocalStorageBool(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored === 'true';
  } catch {
    return defaultValue;
  }
}

function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w < 768) return 'mobile';
    if (w < 1280) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    let rafId: number;

    function handleResize() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const w = window.innerWidth;
        if (w < 768) setBreakpoint('mobile');
        else if (w < 1280) setBreakpoint('tablet');
        else setBreakpoint('desktop');
      });
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return breakpoint;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const breakpoint = useBreakpoint();
  const { aiPanelContext } = useUIStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readLocalStorageBool(SIDEBAR_STORAGE_KEY, false)
  );
  const [aiPanelOpen, setAiPanelOpen] = useState(() =>
    readLocalStorageBool(AI_PANEL_STORAGE_KEY, true)
  );

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_PANEL_STORAGE_KEY, String(aiPanelOpen));
    } catch {
      // ignore
    }
  }, [aiPanelOpen]);

  useEffect(() => {
    if (breakpoint === 'tablet') {
      setSidebarCollapsed(true);
    }
    if (breakpoint !== 'desktop') {
      setAiPanelOpen(false);
    }
  }, [breakpoint]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleAiPanelToggle = useCallback(() => {
    setAiPanelOpen((prev) => !prev);
  }, []);

  const showSidebar = breakpoint !== 'mobile';
  const showAiPanel = breakpoint === 'desktop' && aiPanelOpen;
  const effectiveCollapsed = breakpoint === 'mobile' ? true : sidebarCollapsed;

  const sidebarWidth = showSidebar ? (effectiveCollapsed ? 64 : 240) : 0;
  const aiPanelWidth = showAiPanel ? 380 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      {showSidebar && (
        <Sidebar collapsed={effectiveCollapsed} onToggle={handleSidebarToggle} />
      )}

      {/* Main Wrapper */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300 ease-in-out"
        style={{
          marginLeft: sidebarWidth,
          marginRight: aiPanelWidth,
        }}
      >
        {/* Top Bar */}
        <TopBar />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto" id="main-content">
          {children}
        </main>
      </div>

      {/* AI Panel (right side) */}
      {breakpoint === 'desktop' && (
        <aside
          className={`
            fixed top-0 right-0 z-30 h-screen
            flex flex-col
            bg-white border-l border-gray-200
            transition-all duration-300 ease-in-out
            ${showAiPanel ? 'w-ai-panel translate-x-0' : 'w-0 translate-x-full'}
          `}
          aria-label="AI Assistant panel"
        >
          {showAiPanel && (
            <>
              {/* AI Panel Header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
                    <p className="text-[10px] text-gray-500 leading-none mt-0.5">
                      Powered by Claude
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAiPanelToggle}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
                  aria-label="Close AI panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* AI Chat Panel */}
              <AIChatPanel context={aiPanelContext} />
            </>
          )}
        </aside>
      )}

      {/* Floating AI Toggle */}
      {breakpoint === 'desktop' && !aiPanelOpen && (
        <button
          onClick={handleAiPanelToggle}
          className="
            fixed bottom-6 right-6 z-40
            w-12 h-12 rounded-full
            bg-indigo-600 text-white
            shadow-lg shadow-indigo-500/30
            hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/40
            transition-all duration-200
            flex items-center justify-center
          "
          aria-label="Open AI Assistant"
          title="Open AI Assistant"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default AppLayout;
