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
  Sparkles,
  Layers,
  Workflow,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles?: Array<'admin' | 'executive' | 'manager' | 'member'>;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    label: 'Projects',
    icon: FolderKanban,
    path: '/projects',
  },
  {
    label: 'Reports',
    icon: FileText,
    path: '/reports',
  },
  {
    label: 'Portfolio',
    icon: Layers,
    path: '/portfolio',
  },
  {
    label: 'Workflows',
    icon: Workflow,
    path: '/workflows',
  },
  {
    label: 'Intelligence',
    icon: Brain,
    path: '/scenarios',
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    roles: ['admin', 'manager'],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const isActive = (path: string): boolean => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-screen flex flex-col
        bg-sidebar-bg text-sidebar-text
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'}
      `}
      aria-label="Main navigation"
    >
      {/* Logo / Branding */}
      <div className="flex items-center h-16 px-4 flex-shrink-0 border-b border-white/10">
        <div className="flex items-center min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div
            className={`
              ml-3 overflow-hidden transition-all duration-300
              ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
            `}
          >
            <h1 className="text-base font-bold text-white whitespace-nowrap tracking-tight">
              PM Assistant
            </h1>
            <p className="text-[10px] text-sidebar-text/60 whitespace-nowrap leading-none mt-0.5">
              AI-Powered Project Management
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1" aria-label="Primary">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`
                group flex items-center rounded-lg
                transition-all duration-200 ease-in-out
                ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'}
                ${
                  active
                    ? 'bg-sidebar-active text-sidebar-text-active shadow-lg shadow-indigo-500/20'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`
                  flex-shrink-0 transition-colors duration-200
                  ${collapsed ? 'w-6 h-6' : 'w-5 h-5'}
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
                {item.label}
              </span>

              {/* Active indicator bar */}
              {active && (
                <span className="absolute left-0 w-1 h-8 bg-white rounded-r-full" />
              )}
            </Link>
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
            className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center ring-2 ring-indigo-400/30"
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

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={`
            w-full flex items-center justify-center
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
  );
};

export default Sidebar;
