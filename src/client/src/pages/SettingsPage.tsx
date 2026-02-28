import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Bell,
  Palette,
  AlertTriangle,
  Download,
  Trash2,
  Moon,
  Sun,
  Save,
  Key,
  Webhook,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  X,
  Send,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

type Tab = 'profile' | 'notifications' | 'display' | 'api-keys' | 'webhooks' | 'danger';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'display', label: 'Display', icon: <Palette className="w-4 h-4" /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" /> },
  { id: 'danger', label: 'Danger Zone', icon: <AlertTriangle className="w-4 h-4" /> },
];

interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  taskAssignments: boolean;
  statusChanges: boolean;
  mentions: boolean;
  deadlines: boolean;
  approvalRequests: boolean;
}

interface DisplayPreferences {
  theme: 'light' | 'dark';
  defaultView: 'gantt' | 'kanban' | 'table' | 'calendar';
  sidebarExpanded: boolean;
}

const NOTIFICATION_STORAGE_KEY = 'pm-settings-notifications';
const DISPLAY_STORAGE_KEY = 'pm-settings-display';

function loadNotificationPrefs(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    emailEnabled: true,
    inAppEnabled: true,
    taskAssignments: true,
    statusChanges: true,
    mentions: true,
    deadlines: true,
    approvalRequests: true,
  };
}

function loadDisplayPrefs(): DisplayPreferences {
  try {
    const stored = localStorage.getItem(DISPLAY_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    theme: 'light',
    defaultView: 'gantt',
    sidebarExpanded: true,
  };
}

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'display' && <DisplayTab />}
      {activeTab === 'api-keys' && <ApiKeysTab />}
      {activeTab === 'webhooks' && <WebhooksTab />}
      {activeTab === 'danger' && <DangerZoneTab />}
    </div>
  );
};

/* ─── Profile Tab ──────────────────────────────────────────────── */

const ProfileTab: React.FC = () => {
  const { user } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input type="text" value={user?.username ?? ''} readOnly className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <input type="text" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''} readOnly className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Created</label>
          <input type="text" value="—" readOnly className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
          {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        </div>
      </div>
    </div>
  );
};

/* ─── Notifications Tab ────────────────────────────────────────── */

const NotificationsTab: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(loadNotificationPrefs);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Toggle: React.FC<{ checked: boolean; onChange: () => void; label: string; description?: string }> = ({
    checked,
    onChange,
    label,
    description,
  }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Channels</h2>
        <div className="divide-y divide-gray-100">
          <Toggle checked={prefs.emailEnabled} onChange={() => toggle('emailEnabled')} label="Email Notifications" description="Receive notifications via email" />
          <Toggle checked={prefs.inAppEnabled} onChange={() => toggle('inAppEnabled')} label="In-App Notifications" description="Show notifications inside the application" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Types</h2>
        <div className="divide-y divide-gray-100">
          <SettingsCheckbox checked={prefs.taskAssignments} onChange={() => toggle('taskAssignments')} label="Task Assignments" />
          <SettingsCheckbox checked={prefs.statusChanges} onChange={() => toggle('statusChanges')} label="Status Changes" />
          <SettingsCheckbox checked={prefs.mentions} onChange={() => toggle('mentions')} label="Mentions" />
          <SettingsCheckbox checked={prefs.deadlines} onChange={() => toggle('deadlines')} label="Deadlines" />
          <SettingsCheckbox checked={prefs.approvalRequests} onChange={() => toggle('approvalRequests')} label="Approval Requests" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
          <Save className="w-4 h-4" />
          Save Preferences
        </button>
        {saved && <span className="text-sm text-green-600">Saved successfully</span>}
      </div>
    </div>
  );
};

const SettingsCheckbox: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 py-3 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
    <span className="text-sm text-gray-900">{label}</span>
  </label>
);

/* ─── Display Tab ──────────────────────────────────────────────── */

const DisplayTab: React.FC = () => {
  const [prefs, setPrefs] = useState<DisplayPreferences>(loadDisplayPrefs);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const viewOptions: { value: DisplayPreferences['defaultView']; label: string }[] = [
    { value: 'gantt', label: 'Gantt' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'table', label: 'Table' },
    { value: 'calendar', label: 'Calendar' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Theme</h2>
        <div className="flex gap-3">
          <button onClick={() => setPrefs((p) => ({ ...p, theme: 'light' }))} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${prefs.theme === 'light' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <Sun className="w-4 h-4" /> Light
          </button>
          <button onClick={() => setPrefs((p) => ({ ...p, theme: 'dark' }))} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${prefs.theme === 'dark' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <Moon className="w-4 h-4" /> Dark
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Default View</h2>
        <p className="text-sm text-gray-500 mb-3">Choose the default view when opening a project schedule.</p>
        <div className="flex flex-wrap gap-3">
          {viewOptions.map((opt) => (
            <button key={opt.value} onClick={() => setPrefs((p) => ({ ...p, defaultView: opt.value }))} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${prefs.defaultView === opt.value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sidebar</h2>
        <div className="flex gap-3">
          <button onClick={() => setPrefs((p) => ({ ...p, sidebarExpanded: true }))} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${prefs.sidebarExpanded ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>Expanded</button>
          <button onClick={() => setPrefs((p) => ({ ...p, sidebarExpanded: false }))} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${!prefs.sidebarExpanded ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>Collapsed</button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
          <Save className="w-4 h-4" /> Save Preferences
        </button>
        {saved && <span className="text-sm text-green-600">Saved successfully</span>}
      </div>
    </div>
  );
};

/* ─── API Keys Tab ─────────────────────────────────────────────── */

const ApiKeysTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read', 'write']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiService.listApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; scopes: string[] }) => apiService.createApiKey(data),
    onSuccess: (result: any) => {
      setCreatedKey(result.apiKey?.key || result.key);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiService.revokeApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    createMutation.mutate({ name: newKeyName.trim(), scopes: newKeyScopes });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const keys = data?.apiKeys || [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
            <p className="text-sm text-gray-500 mt-1">Create API keys to allow external AI agents and integrations to access your data.</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setCreatedKey(null); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Key
          </button>
        </div>

        {/* Create Key Form */}
        {showCreate && (
          <div className="mb-6 p-4 rounded-lg border border-indigo-200 bg-indigo-50">
            {createdKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-medium">API key created! Copy it now — it won't be shown again.</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-3 py-2 rounded-md border border-gray-300 text-sm font-mono break-all">{createdKey}</code>
                  <button onClick={() => handleCopy(createdKey)} className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => { setShowCreate(false); setCreatedKey(null); }} className="text-sm text-indigo-600 hover:text-indigo-700">Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., My AI Agent"
                    className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scopes</label>
                  <div className="flex gap-2">
                    {['read', 'write', 'admin'].map((scope) => (
                      <button
                        key={scope}
                        onClick={() => toggleScope(scope)}
                        className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                          newKeyScopes.includes(scope) ? 'border-indigo-600 bg-indigo-100 text-indigo-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={!newKeyName.trim() || createMutation.isPending} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keys List */}
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500">No API keys yet. Create one to get started.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {keys.map((key: any) => (
              <div key={key.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{key.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-xs text-gray-500 font-mono">{key.keyPrefix}...</code>
                    <span className="text-xs text-gray-400">
                      Scopes: {(key.scopes || []).join(', ')}
                    </span>
                    {key.lastUsedAt && (
                      <span className="text-xs text-gray-400">
                        Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Revoke this API key? Any agents using it will lose access.')) revokeMutation.mutate(key.id); }}
                  className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                    key.isActive ? 'text-red-600 hover:bg-red-50 border border-red-200' : 'text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!key.isActive}
                >
                  {key.isActive ? 'Revoke' : 'Revoked'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Using API Keys</h2>
        <p className="text-sm text-gray-500 mb-3">Include your API key in the <code className="bg-gray-100 px-1 rounded">Authorization</code> header:</p>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm font-mono">
          <span className="text-green-400">curl</span> -H <span className="text-yellow-300">"Authorization: Bearer kpm_your_key_here"</span> \<br />
          &nbsp;&nbsp;{window.location.origin}/api/v1/projects
        </div>
        <p className="text-xs text-gray-400 mt-3">Rate limit: 100 requests/minute per key. Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset</p>
      </div>
    </div>
  );
};

/* ─── Webhooks Tab ─────────────────────────────────────────────── */

const WEBHOOK_EVENTS = [
  'task.created', 'task.updated', 'task.deleted',
  'project.created', 'project.updated',
  'proposal.created', 'proposal.accepted',
  'agent.scan_completed',
];

const WebhooksTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiService.listWebhooks(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { url: string; events: string[] }) => apiService.createWebhook(data),
    onSuccess: (result: any) => {
      setCreatedSecret(result.webhook?.secret || null);
      setNewUrl('');
      setNewEvents([]);
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteWebhook(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiService.testWebhook(id),
  });

  const toggleEvent = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleCreate = () => {
    if (!newUrl.trim() || newEvents.length === 0) return;
    createMutation.mutate({ url: newUrl.trim(), events: newEvents });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const webhooks = data?.webhooks || [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
            <p className="text-sm text-gray-500 mt-1">Receive HTTP POST notifications when events occur in your projects.</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setCreatedSecret(null); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Webhook
          </button>
        </div>

        {/* Create Webhook Form */}
        {showCreate && (
          <div className="mb-6 p-4 rounded-lg border border-indigo-200 bg-indigo-50">
            {createdSecret ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-medium">Webhook created! Save the signing secret — it won't be shown again.</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-3 py-2 rounded-md border border-gray-300 text-sm font-mono break-all">{createdSecret}</code>
                  <button onClick={() => handleCopy(createdSecret)} className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={() => { setShowCreate(false); setCreatedSecret(null); }} className="text-sm text-indigo-600 hover:text-indigo-700">Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payload URL</label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Events</label>
                  <div className="flex flex-wrap gap-2">
                    {WEBHOOK_EVENTS.map((event) => (
                      <button
                        key={event}
                        onClick={() => toggleEvent(event)}
                        className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                          newEvents.includes(event) ? 'border-indigo-600 bg-indigo-100 text-indigo-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {event}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={!newUrl.trim() || newEvents.length === 0 || createMutation.isPending} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Webhooks List */}
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-gray-500">No webhooks configured.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {webhooks.map((wh: any) => (
              <div key={wh.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(wh.events || []).map((e: string) => (
                        <span key={e} className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">{e}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className={wh.isActive ? 'text-green-600' : 'text-red-500'}>{wh.isActive ? 'Active' : 'Inactive'}</span>
                      {wh.failureCount > 0 && <span className="text-amber-600">{wh.failureCount} failures</span>}
                      {wh.lastTriggeredAt && <span>Last triggered: {new Date(wh.lastTriggeredAt).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => testMutation.mutate(wh.id)} disabled={testMutation.isPending} className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50" title="Send test ping">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this webhook?')) deleteMutation.mutate(wh.id); }}
                      className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook Verification Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Verifying Webhooks</h2>
        <p className="text-sm text-gray-500 mb-3">Each webhook delivery includes an <code className="bg-gray-100 px-1 rounded">X-Webhook-Signature</code> header (HMAC-SHA256 of the request body using your secret).</p>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm font-mono">
          <span className="text-gray-500">// Verify signature (Node.js example)</span><br />
          <span className="text-blue-400">const</span> expected = crypto.createHmac(<span className="text-yellow-300">'sha256'</span>, secret)<br />
          &nbsp;&nbsp;.update(requestBody).digest(<span className="text-yellow-300">'hex'</span>);<br />
          <span className="text-blue-400">const</span> valid = signature === expected;
        </div>
      </div>
    </div>
  );
};

/* ─── Danger Zone Tab ──────────────────────────────────────────── */

const DangerZoneTab: React.FC = () => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      const data = { exportedAt: new Date().toISOString(), message: 'Export placeholder' };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pm-assistant-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 1000);
  };

  const handleDelete = () => {
    if (deleteInput !== 'DELETE') return;
    alert('Account deletion would be processed here.');
    setShowDeleteConfirm(false);
    setDeleteInput('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Export Data</h2>
        <p className="text-sm text-gray-500 mb-4">Download a copy of all your data including projects, tasks, and settings.</p>
        <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 transition-colors disabled:opacity-50">
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Export All Data'}
        </button>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Delete Account</h2>
        <p className="text-sm text-red-700 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors">
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-red-300 bg-white p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Are you absolutely sure?</p>
                  <p className="text-sm text-red-700 mt-1">This will permanently delete your account, all projects, tasks, and data. This action is irreversible.</p>
                  <p className="text-sm text-red-700 mt-2">Type <span className="font-mono font-bold">DELETE</span> to confirm:</p>
                  <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder="Type DELETE to confirm" className="mt-2 w-full max-w-xs rounded-md border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleteInput !== 'DELETE'} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Trash2 className="w-4 h-4" /> Permanently Delete
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
