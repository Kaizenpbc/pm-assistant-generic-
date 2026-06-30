import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  Workflow,
  Dice5,
  MessageSquare,
  BookOpen,
  Search,
  CreditCard,
  HelpCircle,
  Clock,
  Plug,
  FileBarChart,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  Bot,
  GitPullRequest,
  Target,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../hooks/useTranslation';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  path: string;
  roles?: Array<'admin' | 'executive' | 'manager' | 'member'>;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: 'section.plan',
    items: [
      { labelKey: 'nav.dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { labelKey: 'nav.projects', icon: FolderKanban, path: '/projects' },
      { labelKey: 'nav.workflows', icon: Workflow, path: '/workflows' },
      { labelKey: 'nav.intake', icon: ClipboardList, path: '/intake' },
      { labelKey: 'nav.changeRequests', icon: GitPullRequest, path: '/change-requests' },
    ],
  },
  {
    titleKey: 'section.analyze',
    items: [
      { labelKey: 'nav.portfolio', icon: Layers, path: '/portfolio' },
      { labelKey: 'nav.analytics', icon: BarChart3, path: '/analytics' },
      { labelKey: 'nav.reports', icon: FileText, path: '/reports' },
      { labelKey: 'nav.reportBuilder', icon: FileBarChart, path: '/report-builder' },
      { labelKey: 'nav.simulation', icon: Dice5, path: '/monte-carlo' },
    ],
  },
  {
    titleKey: 'section.intelligence',
    items: [
      { labelKey: 'nav.scenarios', icon: Brain, path: '/scenarios' },
      { labelKey: 'nav.meetings', icon: MessageSquare, path: '/meetings' },
      { labelKey: 'nav.lessons', icon: BookOpen, path: '/lessons' },
      { labelKey: 'nav.askAi', icon: Search, path: '/query' },
      { labelKey: 'nav.agent', icon: Bot, path: '/agent', roles: ['admin', 'manager'] },
    ],
  },
  {
    titleKey: 'section.workspace',
    items: [
      { labelKey: 'nav.goals', icon: Target, path: '/goals' },
      { labelKey: 'nav.timesheets', icon: Clock, path: '/timesheet' },
      { labelKey: 'nav.integrations', icon: Plug, path: '/integrations' },
    ],
  },
  {
    titleKey: 'section.system',
    items: [
      { labelKey: 'nav.account', icon: CreditCard, path: '/account' },
      { labelKey: 'nav.settings', icon: Settings, path: '/settings', roles: ['admin', 'manager'] },
      { labelKey: 'nav.admin', icon: ShieldCheck, path: '/admin', roles: ['admin'] },
      { labelKey: 'nav.help', icon: HelpCircle, path: '/help' },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();

  // Close mobile sidebar on route change
  React.useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isActive = (path: string): boolean => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const isItemVisible = (item: NavItem): boolean => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  };

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <>
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen flex flex-col
          bg-sidebar-bg text-sidebar-text
          transition-all duration-300 ease-in-out
          ${collapsed ? 'md:w-sidebar-collapsed' : 'md:w-sidebar'}
          w-sidebar
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        aria-label="Main navigation"
      >
      {/* Logo / Branding */}
      <div className="flex items-center h-16 px-4 flex-shrink-0 border-b border-white/10">
        <div className="flex items-center min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-sm font-bold text-white tracking-tight">K</span>
          </div>
          <div
            className={`
              ml-3 overflow-hidden transition-all duration-300
              ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
            `}
          >
            <h1 className="text-lg font-bold text-white whitespace-nowrap tracking-tight">
              Kovarti PM
            </h1>
            <p className="text-xs text-sidebar-text/60 whitespace-nowrap leading-none mt-0.5">
              Project Management
            </p>
          </div>
        </div>
      </div>

      {/* Navigation — grouped with section labels */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Primary">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={t(section.titleKey)} className="mb-1">
              {/* Section label (hidden when collapsed) */}
              {!collapsed && (
                <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-text/40">
                  {t(section.titleKey)}
                </p>
              )}
              {collapsed && <div className="h-2" />}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={`
                      group flex items-center rounded-lg
                      transition-all duration-200 ease-in-out
                      ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}
                      ${
                        active
                          ? 'bg-sidebar-active text-sidebar-text-active shadow-lg shadow-primary-500/20'
                          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                      }
                    `}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon
                      className={`
                        flex-shrink-0 transition-colors duration-200
                        ${collapsed ? 'w-5 h-5' : 'w-4.5 h-4.5 w-[18px] h-[18px]'}
                        ${active ? 'text-white' : 'text-sidebar-text group-hover:text-white'}
                      `}
                    />
                    <span
                      className={`
                        ml-3 text-sm font-medium whitespace-nowrap
                        transition-all duration-300
                        ${collapsed ? 'sr-only' : 'block'}
                      `}
                    >
                      {t(item.labelKey)}
                    </span>

                    {/* Active indicator bar */}
                    {active && (
                      <span className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="flex-shrink-0 border-t border-white/10">
        <div
          className={`
            flex items-center px-3 py-3
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          {/* Avatar */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center ring-2 ring-primary-400/30"
            title={user?.fullName || 'User'}
          >
            <span className="text-xs font-semibold text-white">{userInitials}</span>
          </div>

          {/* User info (visible when expanded) */}
          <div
            className={`
              ml-3 min-w-0 overflow-hidden transition-all duration-300
              ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
            `}
          >
            <p className="text-sm font-medium text-white truncate">
              {user?.fullName || 'Unknown User'}
            </p>
            <p className="text-xs text-sidebar-text/60 truncate capitalize">
              {user?.role || 'No role'}
            </p>
          </div>
        </div>

        {/* Collapse Toggle (hidden on mobile) */}
        <button
          onClick={onToggle}
          className={`
            hidden md:flex w-full items-center justify-center
            py-3 text-sidebar-text/70 hover:text-white hover:bg-sidebar-hover
            transition-colors duration-200
            border-t border-white/5
          `}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs font-medium">Collapse</span>
            </div>
          )}
        </button>
      </div>
      </aside>
    </>
  );
};

export default Sidebar;
