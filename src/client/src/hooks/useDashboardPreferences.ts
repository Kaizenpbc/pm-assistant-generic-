import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import type { WidgetDef } from '../components/dashboard/WidgetRegistry';
import { getDefaultWidgetIds } from '../components/dashboard/WidgetRegistry';

type Scope = 'mine' | 'portfolio';

interface DashboardPrefs {
  enabledWidgets: string[];
  widgetOrder: string[];
  scope: Scope;
}

const STORAGE_KEY = 'dashboard-pm-prefs';

function loadLocal(): DashboardPrefs | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as DashboardPrefs;
  } catch { /* ignore */ }
  return null;
}

function saveLocal(prefs: DashboardPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useDashboardPreferences(widgets: WidgetDef[]) {
  const defaultIds = getDefaultWidgetIds(widgets);
  const defaultOrder = widgets.map(w => w.id);

  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => {
    const local = loadLocal();
    return local ? new Set(local.enabledWidgets) : new Set(defaultIds);
  });

  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    const local = loadLocal();
    return local?.widgetOrder ?? defaultOrder;
  });

  const [scope, setScope] = useState<Scope>(() => {
    const local = loadLocal();
    return local?.scope ?? 'mine';
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save to server
  const scheduleSave = useCallback((prefs: DashboardPrefs) => {
    saveLocal(prefs);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiService.updateDashboardPreferences(prefs).catch(() => {/* silent */});
    }, 500);
  }, []);

  // On mount: fetch from server in background and overwrite if exists
  useEffect(() => {
    apiService.getDashboardPreferences()
      .then((res: any) => {
        const prefs = res?.preferences;
        if (prefs?.enabledWidgets && prefs?.widgetOrder) {
          setEnabledIds(new Set(prefs.enabledWidgets));
          setWidgetOrder(prefs.widgetOrder);
          if (prefs.scope === 'mine' || prefs.scope === 'portfolio') {
            setScope(prefs.scope);
          }
          saveLocal(prefs);
        }
      })
      .catch(() => {/* no server prefs yet, use local */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const prefs: DashboardPrefs = { enabledWidgets: [...next], widgetOrder, scope };
      scheduleSave(prefs);
      return next;
    });
  }, [widgetOrder, scope, scheduleSave]);

  const reorder = useCallback((newOrder: string[]) => {
    setWidgetOrder(newOrder);
    const prefs: DashboardPrefs = { enabledWidgets: [...enabledIds], widgetOrder: newOrder, scope };
    scheduleSave(prefs);
  }, [enabledIds, scope, scheduleSave]);

  const changeScope = useCallback((newScope: Scope) => {
    setScope(newScope);
    const prefs: DashboardPrefs = { enabledWidgets: [...enabledIds], widgetOrder, scope: newScope };
    scheduleSave(prefs);
  }, [enabledIds, widgetOrder, scheduleSave]);

  const resetLayout = useCallback(() => {
    const defaults: DashboardPrefs = {
      enabledWidgets: defaultIds,
      widgetOrder: defaultOrder,
      scope: 'mine',
    };
    setEnabledIds(new Set(defaultIds));
    setWidgetOrder(defaultOrder);
    setScope('mine');
    scheduleSave(defaults);
  }, [defaultIds, defaultOrder, scheduleSave]);

  return {
    enabledIds,
    widgetOrder,
    scope,
    toggleWidget,
    reorder,
    changeScope,
    resetLayout,
  };
}
