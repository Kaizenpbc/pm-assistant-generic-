import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Plus, Trash2, X, TrendingUp, AlertTriangle, PieChart } from 'lucide-react';
import { apiService } from '../../services/api';

const EXPENSE_CATEGORIES = [
  'labor', 'materials', 'software', 'hardware', 'travel',
  'contractors', 'training', 'consulting', 'licenses', 'other',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  labor: '#3b82f6',
  materials: '#f59e0b',
  software: '#8b5cf6',
  hardware: '#06b6d4',
  travel: '#ec4899',
  contractors: '#f97316',
  training: '#10b981',
  consulting: '#6366f1',
  licenses: '#14b8a6',
  other: '#6b7280',
};

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type SubTab = 'overview' | 'expenses';

export function BudgetTab({ projectId, project }: { projectId: string; project: any }) {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<string>('other');
  const [formVendor, setFormVendor] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const budgetAllocated = project?.budgetAllocated || project?.budget_allocated || 0;
  const budgetSpent = project?.budgetSpent || project?.budget_spent || 0;
  const currency = project?.currency || 'USD';

  // Expenses
  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', projectId],
    queryFn: () => apiService.getProjectExpenses(projectId),
    enabled: !!projectId,
  });
  const expenses: any[] = expensesData?.expenses || [];

  // Summary (category breakdown + monthly)
  const { data: summaryData } = useQuery({
    queryKey: ['expense-summary', projectId],
    queryFn: () => apiService.getExpenseSummary(projectId),
    enabled: !!projectId,
  });
  const categories: { category: string; total: number; count: number }[] = summaryData?.categories || [];
  const monthly: { month: string; total: number }[] = summaryData?.monthly || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => apiService.createExpense({
      projectId,
      date: formDate,
      amount: parseFloat(formAmount),
      category: formCategory,
      vendor: formVendor || undefined,
      description: formDescription || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary', projectId] });
      setShowForm(false);
      setFormAmount('');
      setFormVendor('');
      setFormDescription('');
      setFormCategory('other');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary', projectId] });
    },
  });

  // Computed
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSpend = budgetSpent + totalExpenses;
  const remaining = budgetAllocated - totalSpend;
  const usedPct = budgetAllocated > 0 ? Math.round((totalSpend / budgetAllocated) * 100) : 0;
  const burnStatus = usedPct > 100 ? 'over' : usedPct > 80 ? 'warning' : 'healthy';

  // Monthly spend chart
  const maxMonthly = Math.max(...monthly.map(m => m.total), 1);

  return (
    <div className="mt-6 space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex items-center justify-between">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-6">
            <button
              onClick={() => setSubTab('overview')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${subTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <PieChart className="w-4 h-4" /> Overview
            </button>
            <button
              onClick={() => setSubTab('expenses')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${subTab === 'expenses' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <DollarSign className="w-4 h-4" /> Expenses
            </button>
          </div>
        </div>
        {subTab === 'expenses' && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        )}
      </div>

      {/* ── Overview sub-tab ── */}
      {subTab === 'overview' && (
        <>
          {/* Budget summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs text-gray-500 mb-1">Budget Allocated</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(budgetAllocated, currency)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs text-gray-500 mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalSpend, currency)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs text-gray-500 mb-1">Remaining</p>
              <p className={`text-2xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(remaining, currency)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs text-gray-500 mb-1">Budget Used</p>
              <div className="flex items-center gap-3">
                <p className={`text-2xl font-bold ${burnStatus === 'over' ? 'text-red-600' : burnStatus === 'warning' ? 'text-amber-600' : 'text-green-600'}`}>
                  {usedPct}%
                </p>
                {burnStatus !== 'healthy' && <AlertTriangle className={`w-5 h-5 ${burnStatus === 'over' ? 'text-red-500' : 'text-amber-500'}`} />}
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all ${burnStatus === 'over' ? 'bg-red-500' : burnStatus === 'warning' ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Category breakdown + Monthly spend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary-500" /> Cost Breakdown by Category
              </h3>
              {categories.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No expenses recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {categories.map(cat => {
                    const pct = totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0;
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded" style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#6b7280' }} />
                            <span className="font-medium text-gray-700 dark:text-gray-300">{capitalize(cat.category)}</span>
                          </span>
                          <span className="text-gray-500">{formatCurrency(cat.total, currency)} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat.category] || '#6b7280' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly spend chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-500" /> Monthly Spend Trend
              </h3>
              {monthly.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No expense data to chart</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {monthly.map(m => {
                    const h = Math.max(4, (m.total / maxMonthly) * 100);
                    const label = new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-500 font-medium">{formatCurrency(m.total, currency)}</span>
                        <div
                          className="w-full rounded-t bg-primary-500 dark:bg-primary-400 transition-all"
                          style={{ height: `${h}%` }}
                          title={`${label}: ${formatCurrency(m.total, currency)}`}
                        />
                        <span className="text-[10px] text-gray-400">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Expenses sub-tab ── */}
      {subTab === 'expenses' && (
        <>
          {/* Add Expense form */}
          {showForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-primary-200 dark:border-primary-700 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">New Expense</h3>
                <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close expense form"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="input w-full text-sm dark:bg-gray-700 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount</label>
                  <input type="number" step="0.01" min="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="input w-full text-sm dark:bg-gray-700 dark:text-gray-100" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="input w-full text-sm dark:bg-gray-700 dark:text-gray-100">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{capitalize(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vendor</label>
                  <input type="text" value={formVendor} onChange={(e) => setFormVendor(e.target.value)} className="input w-full text-sm dark:bg-gray-700 dark:text-gray-100" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                  <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="input w-full text-sm dark:bg-gray-700 dark:text-gray-100" placeholder="Optional" />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!formAmount || createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </div>
          )}

          {/* Expense table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {expensesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No expenses recorded yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Vendor</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Description</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e: any) => (
                    <tr key={e.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: CATEGORY_COLORS[e.category] || '#6b7280' }} />
                          <span className="text-gray-700 dark:text-gray-300">{capitalize(e.category)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(e.amount, currency)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.vendor || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteMutation.mutate(e.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Delete expense"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(totalExpenses, currency)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
