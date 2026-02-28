import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { apiService } from '../../services/api';
import { CustomFieldEditorModal } from './CustomFieldEditorModal';

interface CustomFieldManagerProps {
  projectId: string;
  entityType: 'task' | 'project';
}

export function CustomFieldManager({ projectId, entityType }: CustomFieldManagerProps) {
  const queryClient = useQueryClient();
  const [editField, setEditField] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['custom-fields', projectId, entityType],
    queryFn: () => apiService.getCustomFields(projectId, entityType),
    enabled: !!projectId,
  });

  const fields: any[] = data?.fields || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteCustomField(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields', projectId, entityType] }),
  });

  const fieldTypeLabel: Record<string, string> = {
    text: 'Text',
    number: 'Number',
    date: 'Date',
    dropdown: 'Dropdown',
    checkbox: 'Checkbox',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Custom Fields ({entityType})
        </h4>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Field
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : fields.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No custom fields defined</p>
      ) : (
        <div className="space-y-1">
          {fields.map((field: any) => (
            <div key={field.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50 group">
              <div>
                <p className="text-sm font-medium text-gray-900">{field.fieldLabel}</p>
                <p className="text-[10px] text-gray-400">
                  {fieldTypeLabel[field.fieldType] || field.fieldType}
                  {field.isRequired && ' · Required'}
                  {field.options?.length > 0 && ` · ${field.options.length} options`}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditField(field)} className="p-1 text-gray-400 hover:text-indigo-600">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this custom field? All values will be lost.')) deleteMutation.mutate(field.id); }}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editField) && (
        <CustomFieldEditorModal
          projectId={projectId}
          entityType={entityType}
          field={editField}
          onClose={() => { setShowCreate(false); setEditField(null); }}
        />
      )}
    </div>
  );
}
