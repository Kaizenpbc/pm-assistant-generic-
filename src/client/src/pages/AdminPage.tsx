import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import {
  Shield,
  Users,
  Briefcase,
  Plus,
  UserPlus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

type Tab = 'users' | 'portfolios';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500">Manage users, portfolios, and assignments</p>
        </div>
      </div>

      {/* Tabs (WCAG 1.3.1 - proper tablist/tab roles) */}
      <div className="flex gap-1 mb-6 border-b border-gray-200" role="tablist" aria-label="Administration sections">
        <button
          role="tab"
          id="tab-users"
          aria-selected={activeTab === 'users'}
          aria-controls="tabpanel-users"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-t ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
          Users
        </button>
        <button
          role="tab"
          id="tab-portfolios"
          aria-selected={activeTab === 'portfolios'}
          aria-controls="tabpanel-portfolios"
          onClick={() => setActiveTab('portfolios')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-t ${
            activeTab === 'portfolios'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Briefcase className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
          Portfolios
        </button>
      </div>

      <div
        role="tabpanel"
        id="tabpanel-users"
        aria-labelledby="tab-users"
        hidden={activeTab !== 'users'}
      >
        {activeTab === 'users' && <UsersTab />}
      </div>
      <div
        role="tabpanel"
        id="tabpanel-portfolios"
        aria-labelledby="tab-portfolios"
        hidden={activeTab !== 'portfolios'}
      >
        {activeTab === 'portfolios' && <PortfoliosTab />}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Users Tab
// ---------------------------------------------------------------------------

function UsersTab() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiService.getAdminUsers(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiService.updateAdminUser(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; email: string; password: string; fullName: string; role: string }) =>
      apiService.createAdminUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateForm(false);
    },
  });

  const users = data?.users || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8" role="status">
        <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <span className="sr-only">Loading users...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500" aria-live="polite">{users.length} users</span>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          aria-expanded={showCreateForm}
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" /> Add User
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && <CreateUserForm onSubmit={(d) => createMutation.mutate(d)} onCancel={() => setShowCreateForm(false)} />}

      {/* Users Table (WCAG 1.3.1 - scope attributes, caption) */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">User accounts table</caption>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th scope="col" className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
              <th scope="col" className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th scope="col" className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th scope="col" className="text-left px-4 py-3 font-medium text-gray-600">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-600">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <label htmlFor={`role-${u.id}`} className="sr-only">Role for {u.fullName}</label>
                  <select
                    id={`role-${u.id}`}
                    value={u.role}
                    onChange={(e) => updateMutation.mutate({ id: u.id, data: { role: e.target.value } })}
                    className="text-xs border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="pmo_manager">PMO Manager</option>
                    <option value="portfolio_manager">Portfolio Manager</option>
                    <option value="pm">PM</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                    className={`text-xs px-2 py-1 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                    aria-label={`${u.isActive ? 'Deactivate' : 'Activate'} ${u.fullName}`}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserForm({ onSubmit, onCancel }: {
  onSubmit: (data: { username: string; email: string; password: string; fullName: string; role: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ username: '', email: '', password: '', fullName: '', role: 'pm' });

  return (
    <fieldset className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
      <legend className="text-sm font-semibold text-gray-700 px-1">Create New User</legend>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="new-user-fullname" className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
          <input
            id="new-user-fullname"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="text-sm border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label htmlFor="new-user-username" className="block text-xs font-medium text-gray-600 mb-1">Username</label>
          <input
            id="new-user-username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="text-sm border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label htmlFor="new-user-email" className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input
            id="new-user-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="text-sm border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="new-user-password" className="block text-xs font-medium text-gray-600 mb-1">Password</label>
          <input
            id="new-user-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="text-sm border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="new-password"
            required
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label htmlFor="new-user-role" className="sr-only">Role</label>
          <select
            id="new-user-role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="pm">PM</option>
            <option value="portfolio_manager">Portfolio Manager</option>
            <option value="pmo_manager">PMO Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          onClick={() => onSubmit(form)}
          disabled={!form.username || !form.email || !form.password || !form.fullName}
          className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          Create
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-4 py-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Portfolios Tab
// ---------------------------------------------------------------------------

function PortfoliosTab() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedPortfolio, setExpandedPortfolio] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-portfolios'],
    queryFn: () => apiService.getAdminPortfolios(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiService.getAdminUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiService.createAdminPortfolio(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-portfolios'] });
      setShowCreateForm(false);
    },
  });

  const portfolios = data?.portfolios || [];
  const allUsers = usersData?.users || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8" role="status">
        <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <span className="sr-only">Loading portfolios...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500" aria-live="polite">{portfolios.length} portfolios</span>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          aria-expanded={showCreateForm}
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New Portfolio
        </button>
      </div>

      {showCreateForm && <CreatePortfolioForm onSubmit={(d) => createMutation.mutate(d)} onCancel={() => setShowCreateForm(false)} />}

      <div className="space-y-3" role="list" aria-label="Portfolios">
        {portfolios.map((p: any) => (
          <PortfolioRow
            key={p.id}
            portfolio={p}
            expanded={expandedPortfolio === p.id}
            onToggle={() => setExpandedPortfolio(expandedPortfolio === p.id ? null : p.id)}
            allUsers={allUsers}
          />
        ))}
      </div>
    </div>
  );
}

function CreatePortfolioForm({ onSubmit, onCancel }: {
  onSubmit: (data: { name: string; description?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <fieldset className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 flex items-end gap-3">
      <legend className="text-sm font-semibold text-gray-700 px-1">Create New Portfolio</legend>
      <div className="flex-1">
        <label htmlFor="new-portfolio-name" className="block text-xs font-medium text-gray-600 mb-1">Portfolio Name</label>
        <input
          id="new-portfolio-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="flex-1">
        <label htmlFor="new-portfolio-desc" className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
        <input
          id="new-portfolio-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <button
        onClick={() => onSubmit({ name, description: description || undefined })}
        disabled={!name}
        className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
      >
        Create
      </button>
      <button
        onClick={onCancel}
        className="text-sm px-4 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
      >
        Cancel
      </button>
    </fieldset>
  );
}

function PortfolioRow({ portfolio, expanded, onToggle, allUsers }: {
  portfolio: any;
  expanded: boolean;
  onToggle: () => void;
  allUsers: any[];
}) {
  const queryClient = useQueryClient();

  const { data: assignmentData } = useQuery({
    queryKey: ['portfolio-assignments', portfolio.id],
    queryFn: () => apiService.getPortfolioAssignments(portfolio.id),
    enabled: expanded,
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) => apiService.assignUserToPortfolio(portfolio.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-assignments', portfolio.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-portfolios'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => apiService.removeUserFromPortfolio(portfolio.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-assignments', portfolio.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-portfolios'] });
    },
  });

  const assignments = assignmentData?.assignments || [];
  const assignedUserIds = assignments.map((a: any) => a.userId);
  const unassignedUsers = allUsers.filter((u: any) => !assignedUserIds.includes(u.id) && (u.role === 'pm' || u.role === 'portfolio_manager'));

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" role="listitem">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
        aria-expanded={expanded}
        aria-controls={`portfolio-detail-${portfolio.id}`}
      >
        <div className="flex items-center gap-3">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
            : <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />}
          <Briefcase className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          <div>
            <span className="text-sm font-medium text-gray-900">{portfolio.name}</span>
            {portfolio.description && <span className="text-xs text-gray-500 ml-2">{portfolio.description}</span>}
          </div>
        </div>
        <span className="text-xs text-gray-500">{portfolio.isActive ? 'Active' : 'Inactive'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50" id={`portfolio-detail-${portfolio.id}`}>
          <div className="text-xs font-medium text-gray-600 mb-2" aria-live="polite">
            Assigned Users ({assignments.length})
          </div>
          <div className="space-y-1 mb-3" role="list" aria-label={`Users assigned to ${portfolio.name}`}>
            {assignments.map((a: any) => (
              <div key={a.userId} className="flex items-center justify-between text-sm py-1" role="listitem">
                <span className="text-gray-700">{a.fullName || a.userId} <span className="text-xs text-gray-400">({a.role})</span></span>
                <button
                  onClick={() => removeMutation.mutate(a.userId)}
                  className="text-red-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded p-0.5"
                  aria-label={`Remove ${a.fullName || a.userId} from ${portfolio.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            {assignments.length === 0 && <p className="text-xs text-gray-400">No users assigned.</p>}
          </div>

          {unassignedUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor={`assign-${portfolio.id}`} className="sr-only">Select user to assign to {portfolio.name}</label>
              <select
                id={`assign-${portfolio.id}`}
                className="text-xs border rounded px-2 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {unassignedUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const select = document.getElementById(`assign-${portfolio.id}`) as HTMLSelectElement;
                  if (select?.value) assignMutation.mutate(select.value);
                }}
                className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              >
                Assign
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
