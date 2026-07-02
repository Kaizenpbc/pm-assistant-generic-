import { useState, useEffect, useCallback, useMemo } from 'react';
import { COLUMN_DEFS, DEFAULT_VISIBLE_KEYS, SCHEDULING_KEYS } from '../components/schedule/tableColumns';
import type { ColumnKey, ColumnGroup, ColumnDef } from '../components/schedule/tableColumns';

export interface ColumnState {
  visibleKeys: Set<ColumnKey>;
  columnOrder: ColumnKey[];
  colWidths: Record<string, number>;
  visibleColumns: ColumnDef[];
  toggleColumn: (key: ColumnKey) => void;
  toggleGroup: (group: ColumnGroup, visible: boolean) => void;
  setVisibleKeys: React.Dispatch<React.SetStateAction<Set<ColumnKey>>>;
  setColumnOrder: React.Dispatch<React.SetStateAction<ColumnKey[]>>;
  setColWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  moveColumn: (colKey: ColumnKey, direction: 'left' | 'right') => void;
  cpmNeeded: boolean;
}

export function useColumnState(scheduleId: string): ColumnState {
  const [visibleKeys, setVisibleKeys] = useState<Set<ColumnKey>>(() => {
    try {
      const stored = localStorage.getItem(`tableview-cols:${scheduleId}`);
      if (stored) {
        const keys = new Set(JSON.parse(stored) as ColumnKey[]);
        keys.add('rowNum'); // always visible
        return keys;
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE_KEYS);
  });

  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    try {
      const stored = localStorage.getItem(`tableview-col-order:${scheduleId}`);
      if (stored) return JSON.parse(stored) as ColumnKey[];
    } catch {}
    return [];
  });

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(`tableview-col-widths:${scheduleId}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  });

  // Persist
  useEffect(() => {
    localStorage.setItem(`tableview-cols:${scheduleId}`, JSON.stringify([...visibleKeys]));
  }, [visibleKeys, scheduleId]);

  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem(`tableview-col-order:${scheduleId}`, JSON.stringify(columnOrder));
    }
  }, [columnOrder, scheduleId]);

  useEffect(() => {
    if (Object.keys(colWidths).length > 0) {
      localStorage.setItem(`tableview-col-widths:${scheduleId}`, JSON.stringify(colWidths));
    }
  }, [colWidths, scheduleId]);

  const toggleColumn = useCallback((key: ColumnKey) => {
    if (key === 'name' || key === 'rowNum') return;
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((group: ColumnGroup, visible: boolean) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      for (const col of COLUMN_DEFS) {
        if (col.group === group && col.key !== 'name') {
          if (visible) next.add(col.key);
          else next.delete(col.key);
        }
      }
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => {
    const visible = COLUMN_DEFS.filter(c => visibleKeys.has(c.key));
    if (columnOrder.length === 0) return visible;
    const orderMap = new Map(columnOrder.map((k, i) => [k, i]));
    return [...visible].sort((a, b) => {
      const ia = orderMap.get(a.key) ?? 999;
      const ib = orderMap.get(b.key) ?? 999;
      return ia - ib;
    });
  }, [visibleKeys, columnOrder]);

  const moveColumn = useCallback((colKey: ColumnKey, direction: 'left' | 'right') => {
    const currentOrder = visibleColumns.map(c => c.key);
    const idx = currentOrder.indexOf(colKey);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;
    const newOrder = [...currentOrder];
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    setColumnOrder(newOrder);
  }, [visibleColumns]);

  const cpmNeeded = useMemo(
    () => [...visibleKeys].some(k => SCHEDULING_KEYS.has(k)),
    [visibleKeys],
  );

  return {
    visibleKeys,
    columnOrder,
    colWidths,
    visibleColumns,
    toggleColumn,
    toggleGroup,
    setVisibleKeys,
    setColumnOrder,
    setColWidths,
    moveColumn,
    cpmNeeded,
  };
}
