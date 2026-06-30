import { lazy, Suspense } from 'react';
import { useAuthStore } from '../stores/authStore';
import { PMDashboard } from './PMDashboard';

const ExecutiveDashboard = lazy(() => import('./ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));

export function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
    case 'executive':
      return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>}>
          <ExecutiveDashboard />
        </Suspense>
      );
    case 'manager':
    case 'member':
    default:
      return <PMDashboard />;
  }
}
