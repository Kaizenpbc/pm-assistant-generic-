import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import { AdminPageWrapper } from './AdminPageWrapper';
import {
  CheckCircle,
  XCircle,
  Plug,
  ToggleLeft,
  ToggleRight,
  Server,
  Brain,
  Bot,
  HardDrive,
  RefreshCw,
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

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
      <Icon className="w-4 h-4" /> {title}
    </h2>
  );
}

function ConfigRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-medium text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export function AdminSystemPage() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<ConfigData>({
    queryKey: ['admin-config'],
    queryFn: () => apiService.getAdminConfig(),
    staleTime: 60_000,
  });

  return (
    <AdminPageWrapper title="System Configuration" subtitle="Feature flags, service connectivity, and environment settings">
      <div className="flex items-center justify-between mb-6">
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
        <div className="space-y-6">

          {/* Feature Flags */}
          <div>
            <SectionHeader icon={ToggleRight} title="Feature Flags" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.features.map(f => (
                <div
                  key={f.key}
                  className={`rounded-xl border p-4 shadow-sm transition-all ${
                    f.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{f.label}</span>
                    {f.enabled ? (
                      <div className="flex items-center gap-1.5">
                        <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">ON</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-400">OFF</span>
                      </div>
                    )}
                  </div>
                  {f.detail && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 font-mono">{f.detail}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">{f.key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Service Connectivity */}
          <div>
            <SectionHeader icon={Plug} title="Service Connectivity" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.services.map(s => (
                <div
                  key={s.key}
                  className={`rounded-xl border p-4 shadow-sm ${
                    s.connected
                      ? 'bg-white dark:bg-gray-800 border-l-4 border-l-emerald-500 border-gray-200 dark:border-gray-700'
                      : 'bg-white dark:bg-gray-800 border-l-4 border-l-gray-300 dark:border-l-gray-600 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {s.connected ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{s.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{s.detail}</p>
                </div>
              ))}

              {/* Database (special — always from environment) */}
              <div className={`rounded-xl border p-4 shadow-sm ${
                data.environment.dbConnected
                  ? 'bg-white dark:bg-gray-800 border-l-4 border-l-emerald-500 border-gray-200 dark:border-gray-700'
                  : 'bg-white dark:bg-gray-800 border-l-4 border-l-red-500 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center gap-2">
                  {data.environment.dbConnected ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Database (MariaDB)</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  {data.environment.dbConnected
                    ? `v${data.environment.dbVersion} — ${data.environment.dbName} (pool: ${data.environment.dbPoolSize})`
                    : 'Connection failed'}
                </p>
              </div>
            </div>
          </div>

          {/* Environment */}
          <div>
            <SectionHeader icon={Server} title="Environment" />
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <ConfigRow label="Node.js" value={data.environment.nodeVersion} mono />
              <ConfigRow label="Platform" value={data.environment.platform} mono />
              <ConfigRow label="Environment" value={data.environment.env} />
              <ConfigRow label="Port" value={data.environment.port} mono />
              <ConfigRow label="App URL" value={data.environment.appUrl} mono />
              <ConfigRow label="CORS Origin" value={data.environment.corsOrigin} mono />
              <ConfigRow label="Log Level" value={data.environment.logLevel} />
              <ConfigRow label="Migrations Applied" value={data.environment.migrationCount} />
            </div>
          </div>

          {/* AI Configuration */}
          <div>
            <SectionHeader icon={Brain} title="AI Configuration" />
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <ConfigRow label="Primary Model" value={data.aiConfig.model} mono />
              <ConfigRow label="Fallback Model" value={data.aiConfig.fallbackModel} mono />
              <ConfigRow label="Temperature" value={data.aiConfig.temperature} />
              <ConfigRow label="Max Tokens" value={data.aiConfig.maxTokens.toLocaleString()} />
              <ConfigRow label="Monthly Token Budget" value={data.aiConfig.monthlyTokenBudget.toLocaleString()} />
              <ConfigRow label="Input Pricing" value={`$${data.aiConfig.pricingInput}/M tokens`} />
              <ConfigRow label="Output Pricing" value={`$${data.aiConfig.pricingOutput}/M tokens`} />
            </div>
          </div>

          {/* Agent Configuration */}
          <div>
            <SectionHeader icon={Bot} title="Agent Configuration" />
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <ConfigRow label="Registered Agents" value={`${data.agentConfig.enabledAgents} enabled / ${data.agentConfig.totalAgents} total`} />
              <ConfigRow label="Cron Schedule" value={data.agentConfig.cronSchedule} mono />
              <ConfigRow label="Delay Threshold" value={`${data.agentConfig.delayThresholdDays} days`} />
              <ConfigRow label="Budget CPI Threshold" value={data.agentConfig.budgetCpiThreshold} />
              <ConfigRow label="Budget Overrun Threshold" value={`${data.agentConfig.budgetOverrunThreshold}%`} />
              <ConfigRow label="Monte Carlo Confidence" value={`${data.agentConfig.mcConfidenceLevel}%`} />
              <ConfigRow label="Overdue Scan Interval" value={`${data.agentConfig.overdueScanMinutes} min`} />
            </div>
          </div>

          {/* Storage */}
          <div>
            <SectionHeader icon={HardDrive} title="Storage & Uploads" />
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <ConfigRow label="Upload Directory" value={data.storageConfig.uploadDir} mono />
              <ConfigRow label="Max Upload Size" value={`${data.storageConfig.maxUploadSizeMB} MB`} />
            </div>
          </div>

        </div>
      )}
    </AdminPageWrapper>
  );
}
