import { useAuthStore } from '../stores/authStore';
import { PMDashboard } from './PMDashboard';
import { PMODashboard } from './PMODashboard';
import { PortfolioManagerDashboard } from './PortfolioManagerDashboard';

export function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
    case 'pmo_manager':
      return <PMODashboard />;
    case 'portfolio_manager':
      return <PortfolioManagerDashboard />;
    case 'pm':
    default:
      return <PMDashboard />;
  }
}
