import { useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import type { WidgetDef } from './WidgetRegistry';

interface WidgetGridProps {
  widgets: WidgetDef[];
  enabledIds: Set<string>;
  widgetOrder: string[];
  onReorder: (newOrder: string[]) => void;
  renderWidget: (id: string) => ReactNode;
}

export function WidgetGrid({ widgets, enabledIds, widgetOrder, onReorder, renderWidget }: WidgetGridProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Order widgets: use widgetOrder first, then append any enabled widgets not in order
  const orderedIds = widgetOrder.filter(id => enabledIds.has(id));
  for (const w of widgets) {
    if (enabledIds.has(w.id) && !orderedIds.includes(w.id)) {
      orderedIds.push(w.id);
    }
  }

  if (orderedIds.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No widgets enabled. Click Customize to add widgets.</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }
    const newOrder = [...orderedIds];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dropIdx, 0, moved);
    onReorder(newOrder);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="space-y-4">
      {orderedIds.map((id, idx) => (
        <div
          key={id}
          draggable
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          className={`group relative transition-all ${dragIdx === idx ? 'opacity-40' : ''} ${overIdx === idx && dragIdx !== idx ? 'ring-2 ring-primary-400 ring-offset-2 rounded-xl' : ''}`}
        >
          {/* Drag handle */}
          <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-gray-300" />
          </div>
          <div className="pl-0 group-hover:pl-6 transition-all">
            {renderWidget(id)}
          </div>
        </div>
      ))}
    </div>
  );
}
