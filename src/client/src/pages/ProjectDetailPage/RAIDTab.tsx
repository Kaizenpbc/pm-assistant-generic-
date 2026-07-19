import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Bot, Activity, ShieldAlert, Search } from 'lucide-react';
import { apiService } from '../../services/api';
import { RiskFormModal } from '../../components/risks/RiskFormModal';
import { AIScanReviewModal } from '../../components/risks/AIScanReviewModal';
import { RAIDDetailPanel } from '../../components/risks/RAIDDetailPanel';

export function RAIDTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editRisk, setEditRisk] = useState<any>(null);
  const [defaultType, setDefaultType] = useState<'risk' | 'issue' | 'action' | 'decision'>('risk');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedRaidId, setSelectedRaidId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanCandidates, setScanCandidates] = useState<any[] | null>(null);
  const [showScanReview, setShowScanReview] = useState(false);
  const [scanAiPowered, setScanAiPowered] = useState(true);
  const [importing, setImporting] = useState(false);

  const filters: Record<string, string> = {};
  if (filterType) filters.type = filterType;
  if (filterStatus) filters.status = filterStatus;
  if (filterSeverity) filters.severity = filterSeverity;
  if (filterSource) filters.source = filterSource;
  if (searchText.trim()) filters.search = searchText.trim();

  const { data: risksData, isLoading } = useQuery({
    queryKey: ['project-risks', projectId, filters],
    queryFn: () => apiService.getRiskItems(projectId, filters),
    enabled: !!projectId,
  });

  const { data: statsData } = useQuery({
    queryKey: ['project-risks-stats', projectId],
    queryFn: () => apiService.getRiskStats(projectId),
    enabled: !!projectId,
  });

  const { data: membersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => apiService.getProjectMembers(projectId),
    enabled: !!projectId,
  });

  const risks: any[] = risksData?.data || [];
  const stats = statsData?.data || {};
  const members: any[] = membersData?.members || [];

  const handleAiScan = async () => {
    setScanning(true);
    try {
      const result = await apiService.runAiRiskScan(projectId);
      setScanCandidates(result.data?.candidates || []);
      setScanAiPowered(result.aiPowered !== false);
      setShowScanReview(true);
    } catch {
      // silently fail
    } finally {
      setScanning(false);
    }
  };

  const handleImportSelected = async (items: Record<string, any>[]) => {
    setImporting(true);
    try {
      await apiService.batchImportRisks(projectId, items);
      queryClient.invalidateQueries({ queryKey: ['project-risks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-risks-stats', projectId] });
      setShowScanReview(false);
      setScanCandidates(null);
    } catch {
      // silently fail
    } finally {
      setImporting(false);
    }
  };

  const openAdd = (type: 'risk' | 'issue' | 'action' | 'decision') => {
    setEditRisk(null);
    setDefaultType(type);
    setShowForm(true);
  };

  const openEdit = (risk: any) => {
    setEditRisk(risk);
    setDefaultType(risk.type);
    setShowForm(true);
  };

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['project-risks', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-risks-stats', projectId] });
  };

  const severityColor = (s: string) => {
    if (s === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (s === 'high') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (s === 'medium') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  };

  const statusColor = (s: string) => {
    if (s === 'open') return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
    if (s === 'monitoring') return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
    if (s === 'mitigating' || s === 'in_progress') return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
    if (s === 'mitigated' || s === 'resolved' || s === 'completed' || s === 'decided') return 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400';
    if (s === 'pending_decision') return 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400';
    if (s === 'deferred') return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
    if (s === 'cancelled' || s === 'reversed') return 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500';
    return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  };

  const typeIndicatorColor = (t: string) => {
    if (t === 'risk') return 'bg-red-500';
    if (t === 'issue') return 'bg-orange-500';
    if (t === 'action') return 'bg-blue-500';
    if (t === 'decision') return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const scoreColor = (score: number) => {
    if (score >= 16) return 'text-red-600 dark:text-red-400';
    if (score >= 10) return 'text-orange-600 dark:text-orange-400';
    if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const formatDate = (d: string | undefined) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const memberName = (userId: string | null) => {
    if (!userId) return '';
    const m = members.find((m: any) => (m.userId || m.id) === userId);
    return m ? (m.userName || m.user?.name || m.name || m.email || '') : '';
  };

  const cardClass = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
  const selectClass = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Open Risks</span>
          <span className="text-sm font-bold text-red-600 dark:text-red-400">{stats.openRisks ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Open Issues</span>
          <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{stats.openIssues ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Open Actions</span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{stats.openActions ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Pending Decisions</span>
          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{stats.pendingDecisions ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Critical</span>
          <span className="text-sm font-bold text-red-700 dark:text-red-300">{stats.critical ?? 0}</span>
        </div>
        {(stats.triggered ?? 0) > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <span className="text-xs text-gray-500 dark:text-gray-400">Triggered</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{stats.triggered}</span>
          </div>
        )}
      </div>

      {/* Actions + Filters bar */}
      <div className={`${cardClass} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => openAdd('risk')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Risk
          </button>
          <button onClick={() => openAdd('issue')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Issue
          </button>
          <button onClick={() => openAdd('action')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Action
          </button>
          <button onClick={() => openAdd('decision')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Decision
          </button>
          <button
            onClick={handleAiScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors disabled:opacity-50"
          >
            {scanning ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            {scanning ? 'Scanning...' : 'AI Scan'}
          </button>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-40 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectClass}>
            <option value="">All Types</option>
            <option value="risk">Risks</option>
            <option value="issue">Issues</option>
            <option value="action">Actions</option>
            <option value="decision">Decisions</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="monitoring">Monitoring</option>
            <option value="mitigating">Mitigating</option>
            <option value="in_progress">In Progress</option>
            <option value="mitigated">Mitigated</option>
            <option value="resolved">Resolved</option>
            <option value="completed">Completed</option>
            <option value="pending_decision">Pending Decision</option>
            <option value="decided">Decided</option>
            <option value="deferred">Deferred</option>
            <option value="cancelled">Cancelled</option>
            <option value="reversed">Reversed</option>
            <option value="closed">Closed</option>
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className={selectClass}>
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={selectClass}>
            <option value="">All Sources</option>
            <option value="manual">Manual</option>
            <option value="ai_detected">AI Detected</option>
            <option value="agent">Agent</option>
          </select>
        </div>
      </div>

      {/* RAID table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : risks.length === 0 ? (
        <div className={`${cardClass} p-8 text-center`}>
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">No RAID Items</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add a Risk, Issue, Action, or Decision — or run AI Scan.
          </p>
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[60px_1fr_80px_72px_100px_100px_60px_80px] gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/30 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span>ID</span>
            <span>Title</span>
            <span>Type</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Owner</span>
            <span>Score</span>
            <span>Date</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {risks.map((risk: any) => {
              const isTerminal = ['cancelled', 'reversed'].includes(risk.status);
              return (
                <div
                  key={risk.id}
                  className={`grid grid-cols-1 md:grid-cols-[60px_1fr_80px_72px_100px_100px_60px_80px] gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors ${isTerminal ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedRaidId(risk.id)}
                >
                  {/* Record ID */}
                  <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400">
                    {risk.recordId || '—'}
                  </span>

                  {/* Title + type indicator */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-6 rounded-full flex-shrink-0 ${typeIndicatorColor(risk.type)}`} />
                    <p className={`text-sm font-medium text-gray-900 dark:text-white truncate ${isTerminal ? 'line-through' : ''}`}>
                      {risk.title}
                    </p>
                    {risk.triggered && <span className="text-amber-500 flex-shrink-0" title="Triggered">⚡</span>}
                  </div>

                  {/* Type badge */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize w-fit ${
                    risk.type === 'risk' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    risk.type === 'issue' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    risk.type === 'action' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}>
                    {risk.type}
                  </span>

                  {/* Severity */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize w-fit ${severityColor(risk.severity)}`}>
                    {risk.severity}
                  </span>

                  {/* Status */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize w-fit ${statusColor(risk.status)}`}>
                    {risk.status.replace('_', ' ')}
                  </span>

                  {/* Owner */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {memberName(risk.ownerId) || '—'}
                  </span>

                  {/* Score */}
                  <span className={`text-sm font-bold ${scoreColor(risk.riskScore)}`}>
                    {(risk.type === 'risk' || risk.type === 'issue') ? risk.riskScore : '—'}
                  </span>

                  {/* Date */}
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {formatDate(risk.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide-out detail panel */}
      {selectedRaidId && (
        <RAIDDetailPanel
          projectId={projectId}
          raidId={selectedRaidId}
          onClose={() => setSelectedRaidId(null)}
          onEdit={(item) => { setSelectedRaidId(null); openEdit(item); }}
          members={members}
        />
      )}

      {/* Form modal */}
      <RiskFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSaved={onSaved}
        projectId={projectId}
        editRisk={editRisk}
        defaultType={defaultType}
        members={members}
      />

      {/* AI Scan Review modal */}
      <AIScanReviewModal
        isOpen={showScanReview}
        onClose={() => { setShowScanReview(false); setScanCandidates(null); }}
        onImport={handleImportSelected}
        candidates={scanCandidates || []}
        importing={importing}
        aiPowered={scanAiPowered}
      />
    </div>
  );
}
