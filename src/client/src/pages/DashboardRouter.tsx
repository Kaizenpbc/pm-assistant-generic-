import React, { lazy, Suspense } from 'react';
import { useAuthStore } from '../stores/authStore';
import { PMDashboard } from './PMDashboard';

const ExecutiveDashboard = lazy(() => import('./ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));
const ScrumMasterDashboard = lazy(() => import('./dashboards/ScrumMasterDashboard').then(m => ({ default: m.ScrumMasterDashboard })));
const FinanceDashboard = lazy(() => import('./dashboards/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));

const DashboardSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>}>
    {children}
  </Suspense>
);

export function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
    case 'executive':
      return (
        <DashboardSuspense>
          <ExecutiveDashboard />
        </DashboardSuspense>
      );
    case 'scrum_master':
      return (
        <DashboardSuspense>
          <ScrumMasterDashboard />
        </DashboardSuspense>
      );
    case 'finance_officer':
      return (
        <DashboardSuspense>
          <FinanceDashboard />
        </DashboardSuspense>
      );
    case 'project_manager':
    case 'team_member':
    default:
      return <PMDashboard />;
  }
}
