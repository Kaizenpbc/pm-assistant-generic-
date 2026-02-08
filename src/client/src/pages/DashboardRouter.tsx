import { useAuthStore } from '../stores/authStore';
import { PMDashboard } from './PMDashboard';
import { ExecutiveDashboard } from './ExecutiveDashboard';

export function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
    case 'executive':
      return <ExecutiveDashboard />;
    case 'manager':
    case 'member':
    default:
      return <PMDashboard />;
  }
}
