import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { AdminPageWrapper } from './AdminPageWrapper';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface Feature {
  key: string; label: string; enabled: boolean; detail?: string;
}

interface ServiceStatus {
  key: string; label: string; connected: boolean; detail: string;
}

interface ConfigData {
  features: Feature[];
  services: ServiceStatus[];
  environment: {
    nodeVersion: string; platform: string; env: string; port: number;
    appUrl: string; corsOrigin: string; logLevel: string;
    dbHost: string; dbName: string; dbConnected: boolean; dbVersion: string;
    dbPoolSize: number; migrationCount: number;
  };
  aiConfig: {
    model: string; fallbackModel: string; temperature: number; maxTokens: number;
    monthlyTokenBudget: number; pricingInput: number; pricingOutput: number;
  };
  agentConfig: {
    cronSchedule: string; delayThresholdDays: number; budgetCpiThreshold: number;
    budgetOverrunThreshold: number; mcConfidenceLevel: number; overdueScanMinutes: number;
    totalAgents: number; enabledAgents: number;
  };
  storageConfig: {
    uploadDir: string; maxUploadSizeMB: number;
  };
}

const SECTIONS = [
  { id: 'features', label: 'Feature Flags' },
  { id: 'services', label: 'Services' },
  { id: 'environment', label: 'Environment' },
  { id: 'ai', label: 'AI' },
  { id: 'agents', label: 'Agents' },
  { id: 'storage', label: 'Storage' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

function KVRow({ label, value, even }: { label: string; value: React.ReactNode; even: boolean }) {
  return (
    <tr className={even ? 'bg-gray-50/50 dark:bg-gray-750/30' : ''}>
      <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{label}</td>
      <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white text-right">{value}</td>
    </tr>
  );
}

function KVTable({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <table className="w-full">
      <tbody>
        {rows.map((r, i) => (
          <KVRow key={r.label} label={r.label} value={r.value} even={i % 2 === 0} />
        ))}
      </tbody>
    </table>
  );
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
      on ? 'bg-emerald-500 shadow-sm shadow-emerald-400/50' : 'bg-gray-300 dark:bg-gray-600'
    }`} />
  );
}

export function AdminSystemPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('features');
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<ConfigData>({
    queryKey: ['admin-config'],
    queryFn: () => apiService.getAdminConfig(),
    staleTime: 60_000,
  });

  return (
    <AdminPageWrapper title="System Configuration" subtitle="Feature flags, service connectivity, and environment settings">
      <div className="flex items-center justify-between mb-5">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {dataUpdatedAt ? `Loaded: ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading configuration...</div>}
      {error && <div className="text-center py-12 text-red-500">Failed to load configuration.</div>}

      {data && (
        <div className="flex gap-6 min-h-[500px]">
          {/* Left sidebar nav */}
          <nav className="hidden md:block w-48 flex-shrink-0">
            <div className="sticky top-20 space-y-0.5">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeSection === s.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-l-2 border-indigo-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {s.label}
                  {activeSection === s.id && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </nav>

          {/* Mobile section picker */}
          <div className="md:hidden w-full mb-4">
            <select
              value={activeSection}
              onChange={e => setActiveSection(e.target.value as SectionId)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Feature Flags */}
            {activeSection === 'features' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Feature Flags</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Toggle state of platform capabilities</p>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
                  {data.features.map(f => (
                    <div key={f.key} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors">
                      <StatusDot on={f.enabled} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{f.label}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            f.enabled
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            {f.enabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        {f.detail && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{f.detail}</p>}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono hidden sm:block">{f.key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services */}
            {activeSection === 'services' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Service Connectivity</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">External dependencies and integration status</p>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
                  {[
                    ...data.services,
                    { key: 'database', label: 'Database (MariaDB)', connected: data.environment.dbConnected, detail: data.environment.dbConnected ? `v${data.environment.dbVersion} — ${data.environment.dbName} (pool: ${data.environment.dbPoolSize})` : 'Connection failed' },
                  ].map(s => (
                    <div key={s.key} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors">
                      {s.connected ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{s.label}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.detail}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.connected
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                        {s.connected ? 'Connected' : 'Not configured'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Environment */}
            {activeSection === 'environment' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Environment</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Runtime platform, network, and database details</p>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <KVTable rows={[
                    { label: 'Node.js', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.environment.nodeVersion}</code> },
                    { label: 'Platform', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.environment.platform}</code> },
                    { label: 'Environment', value: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.environment.env === 'production' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>{data.environment.env}</span> },
                    { label: 'Port', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.environment.port}</code> },
                    { label: 'App URL', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.environment.appUrl}</code> },
                    { label: 'CORS Origin', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.environment.corsOrigin}</code> },
                    { label: 'Log Level', value: data.environment.logLevel },
                    { label: 'Database Host', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.environment.dbHost}</code> },
                    { label: 'Database Name', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.environment.dbName}</code> },
                    { label: 'DB Version', value: data.environment.dbVersion || '--' },
                    { label: 'DB Pool Size', value: data.environment.dbPoolSize },
                    { label: 'Migrations Applied', value: <span className="inline-flex items-center gap-1"><span className="text-indigo-600 dark:text-indigo-400 font-bold">{data.environment.migrationCount}</span></span> },
                  ]} />
                </div>
              </div>
            )}

            {/* AI */}
            {activeSection === 'ai' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">AI Configuration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Claude model, pricing, and budget settings</p>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <KVTable rows={[
                    { label: 'Primary Model', value: <code className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">{data.aiConfig.model}</code> },
                    { label: 'Fallback Model', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.aiConfig.fallbackModel}</code> },
                    { label: 'Temperature', value: data.aiConfig.temperature },
                    { label: 'Max Tokens', value: data.aiConfig.maxTokens.toLocaleString() },
                    { label: 'Monthly Token Budget', value: data.aiConfig.monthlyTokenBudget.toLocaleString() },
                    { label: 'Input Pricing', value: `$${data.aiConfig.pricingInput} / M tokens` },
                    { label: 'Output Pricing', value: `$${data.aiConfig.pricingOutput} / M tokens` },
                  ]} />
                </div>
              </div>
            )}

            {/* Agents */}
            {activeSection === 'agents' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Agent Configuration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Autonomous agent thresholds and scheduling</p>

                {/* Agent summary pill */}
                <div className="flex gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-2">
                    <StatusDot on={data.agentConfig.enabledAgents > 0} />
                    <span className="text-sm text-indigo-800 dark:text-indigo-300">
                      <span className="font-bold">{data.agentConfig.enabledAgents}</span> of {data.agentConfig.totalAgents} agents enabled
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <KVTable rows={[
                    { label: 'Cron Schedule', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{data.agentConfig.cronSchedule}</code> },
                    { label: 'Delay Threshold', value: `${data.agentConfig.delayThresholdDays} days` },
                    { label: 'Budget CPI Threshold', value: data.agentConfig.budgetCpiThreshold },
                    { label: 'Budget Overrun Threshold', value: `${data.agentConfig.budgetOverrunThreshold}%` },
                    { label: 'Monte Carlo Confidence', value: `${data.agentConfig.mcConfidenceLevel}%` },
                    { label: 'Overdue Scan Interval', value: `${data.agentConfig.overdueScanMinutes} min` },
                  ]} />
                </div>
              </div>
            )}

            {/* Storage */}
            {activeSection === 'storage' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Storage & Uploads</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">File upload and storage configuration</p>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <KVTable rows={[
                    { label: 'Upload Directory', value: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded break-all">{data.storageConfig.uploadDir}</code> },
                    { label: 'Max Upload Size', value: `${data.storageConfig.maxUploadSizeMB} MB` },
                  ]} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
}
