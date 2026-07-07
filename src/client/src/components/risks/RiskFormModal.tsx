import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';

interface RiskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  projectId: string;
  editRisk?: any;
  defaultType?: 'risk' | 'issue';
  members?: any[];
}

const CATEGORIES = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'budget', label: 'Budget' },
  { value: 'resource', label: 'Resource' },
  { value: 'technical', label: 'Technical' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'stakeholder', label: 'Stakeholder' },
  { value: 'weather', label: 'Weather' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const STATUSES_RISK = ['open', 'monitoring', 'mitigating', 'mitigated', 'closed'] as const;
const STATUSES_ISSUE = ['open', 'monitoring', 'mitigating', 'resolved', 'closed'] as const;

export function RiskFormModal({ isOpen, onClose, onSaved, projectId, editRisk, defaultType = 'risk', members = [] }: RiskFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [suggestingMitigation, setSuggestingMitigation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: defaultType as 'risk' | 'issue',
    title: '',
    description: '',
    category: 'other',
    severity: 'medium',
    probability: 3,
    impact: 3,
    status: 'open',
    triggerCondition: '',
    mitigationPlan: '',
    responsePlan: '',
    ownerId: '',
    linkedTaskIds: [] as string[],
  });

  useEffect(() => {
    if (editRisk) {
      setForm({
        type: editRisk.type || defaultType,
        title: editRisk.title || '',
        description: editRisk.description || '',
        category: editRisk.category || 'other',
        severity: editRisk.severity || 'medium',
        probability: editRisk.probability ?? 3,
        impact: editRisk.impact ?? 3,
        status: editRisk.status || 'open',
        triggerCondition: editRisk.triggerCondition || '',
        mitigationPlan: editRisk.mitigationPlan || '',
        responsePlan: editRisk.responsePlan || '',
        ownerId: editRisk.ownerId || '',
        linkedTaskIds: editRisk.linkedTaskIds || [],
      });
    } else {
      setForm({
        type: defaultType,
        title: '',
        description: '',
        category: 'other',
        severity: 'medium',
        probability: 3,
        impact: 3,
        status: 'open',
        triggerCondition: '',
        mitigationPlan: '',
        responsePlan: '',
        ownerId: '',
        linkedTaskIds: [],
      });
    }
    setError(null);
  }, [editRisk, defaultType, isOpen]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = { ...form };
      if (!payload.ownerId) delete payload.ownerId;
      if (!payload.triggerCondition) delete payload.triggerCondition;
      if (!payload.mitigationPlan) delete payload.mitigationPlan;
      if (!payload.responsePlan) delete payload.responsePlan;
      if (payload.linkedTaskIds.length === 0) delete payload.linkedTaskIds;

      if (editRisk) {
        await apiService.updateRiskItem(projectId, editRisk.id, payload);
      } else {
        await apiService.createRiskItem(projectId, payload);
      }
      onSaved();
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestMitigation = async () => {
    if (!form.title.trim()) return;
    setSuggestingMitigation(true);
    try {
      const result = await apiService.suggestRiskMitigation(projectId, editRisk?.id || 'new');
      const suggestions = result?.data || result?.suggestions || [];
      if (suggestions.length > 0) {
        const text = suggestions.map((s: any) => typeof s === 'string' ? s : s.suggestion || s.mitigation || JSON.stringify(s)).join('\n\n');
        setForm(prev => ({ ...prev, mitigationPlan: prev.mitigationPlan ? prev.mitigationPlan + '\n\n' + text : text }));
      }
    } catch {
      // Silently fail — AI not available
    } finally {
      setSuggestingMitigation(false);
    }
  };

  if (!isOpen) return null;

  const statuses = form.type === 'issue' ? STATUSES_ISSUE : STATUSES_RISK;
  const riskScore = form.probability * form.impact;

  const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editRisk ? 'Edit' : 'Add'} {form.type === 'issue' ? 'Issue' : 'Risk'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Type toggle */}
          <div>
            <label className={labelClass}>Type</label>
            <div className="flex gap-2">
              {(['risk', 'issue'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: t }))}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${form.type === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                >
                  {t === 'risk' ? 'Risk' : 'Issue'}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              className={inputClass}
              placeholder={form.type === 'issue' ? 'What is the issue?' : 'What might go wrong?'}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className={`${inputClass} h-20 resize-none`}
              placeholder="Detailed description..."
            />
          </div>

          {/* Row: Category + Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <select value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} className={inputClass}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Severity</label>
              <select value={form.severity} onChange={e => setForm(prev => ({ ...prev, severity: e.target.value }))} className={inputClass}>
                {SEVERITIES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Probability + Impact + Score */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Probability (1-5)</label>
              <select value={form.probability} onChange={e => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))} className={inputClass}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} — {['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'][n - 1]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Impact (1-5)</label>
              <select value={form.impact} onChange={e => setForm(prev => ({ ...prev, impact: Number(e.target.value) }))} className={inputClass}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} — {['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'][n - 1]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Risk Score</label>
              <div className={`flex items-center justify-center h-[38px] rounded-lg text-sm font-bold ${riskScore >= 16 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : riskScore >= 10 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : riskScore >= 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                {riskScore}
              </div>
            </div>
          </div>

          {/* Row: Status + Owner */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))} className={inputClass}>
                {statuses.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Owner</label>
              <select value={form.ownerId} onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value }))} className={inputClass}>
                <option value="">Unassigned</option>
                {members.map((m: any) => (
                  <option key={m.userId || m.id} value={m.userId || m.id}>
                    {m.userName || m.user?.name || m.name || m.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Trigger Condition */}
          <div>
            <label className={labelClass}>Trigger Condition</label>
            <textarea
              value={form.triggerCondition}
              onChange={e => setForm(prev => ({ ...prev, triggerCondition: e.target.value }))}
              className={`${inputClass} h-16 resize-none`}
              placeholder="What signals that this risk is materializing?"
            />
          </div>

          {/* Mitigation Plan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass + ' mb-0'}>Mitigation Plan</label>
              {editRisk?.id && (
                <button
                  type="button"
                  onClick={handleSuggestMitigation}
                  disabled={suggestingMitigation}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 disabled:opacity-50"
                >
                  {suggestingMitigation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Suggest with AI
                </button>
              )}
            </div>
            <textarea
              value={form.mitigationPlan}
              onChange={e => setForm(prev => ({ ...prev, mitigationPlan: e.target.value }))}
              className={`${inputClass} h-20 resize-none`}
              placeholder="Preventive actions to reduce likelihood or impact..."
            />
          </div>

          {/* Response Plan */}
          <div>
            <label className={labelClass}>Response Plan</label>
            <textarea
              value={form.responsePlan}
              onChange={e => setForm(prev => ({ ...prev, responsePlan: e.target.value }))}
              className={`${inputClass} h-20 resize-none`}
              placeholder="Contingency — what to do if the risk occurs..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : editRisk ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
