import { useState, useRef, useEffect } from 'react';
import { Settings2, ChevronDown } from 'lucide-react';
import type { ColumnDef, ColumnKey, ColumnGroup } from './tableColumns';

const groupLabels: Record<ColumnGroup, string> = {
  standard: 'Standard',
  scheduling: 'Scheduling (CPM)',
  baseline: 'Baseline',
  other: 'Other',
};

const groupOrder: ColumnGroup[] = ['standard', 'scheduling', 'baseline', 'other'];

interface ColumnPickerDropdownProps {
  columns: ColumnDef[];
  visibleKeys: Set<ColumnKey>;
  onToggle: (key: ColumnKey) => void;
  onToggleGroup: (group: ColumnGroup, visible: boolean) => void;
}

export function ColumnPickerDropdown({ columns, visibleKeys, onToggle, onToggleGroup }: ColumnPickerDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const grouped = groupOrder.map(group => ({
    group,
    label: groupLabels[group],
    cols: columns.filter(c => c.group === group),
  }));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        title="Choose columns"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Columns
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 max-h-[70vh] overflow-y-auto">
          {grouped.map(({ group, label, cols }) => {
            const allVisible = cols.every(c => visibleKeys.has(c.key));
            const someVisible = cols.some(c => visibleKeys.has(c.key));

            return (
              <div key={group} className="px-1">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={allVisible}
                    ref={el => {
                      if (el) el.indeterminate = someVisible && !allVisible;
                    }}
                    onChange={() => onToggleGroup(group, !allVisible)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
                </div>
                {cols.map(col => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-4 py-1 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleKeys.has(col.key)}
                      onChange={() => onToggle(col.key)}
                      disabled={col.key === 'name'}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs text-gray-700">{col.label}</span>
                  </label>
                ))}
                {group !== 'other' && <div className="border-b border-gray-100 my-1 mx-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
