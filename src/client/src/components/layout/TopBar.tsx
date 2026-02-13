import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ChevronRight, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { NotificationBell } from '../notifications/NotificationBell';

interface Breadcrumb {
  label: string;
  path: string;
}

const segmentLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  project: 'Project',
  reports: 'Reports',
  settings: 'Settings',
  schedule: 'Schedule',
};

function buildBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Breadcrumb[] = [{ label: 'Home', path: '/dashboard' }];

  // Skip adding "Dashboard" segment since Home already points to /dashboard
  if (segments.length === 1 && segments[0] === 'dashboard') {
    return crumbs;
  }

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label =
      segmentLabels[segment] ||
      (segment.length <= 6
        ? segment.toUpperCase()
        : segment.charAt(0).toUpperCase() + segment.slice(1));
    crumbs.push({ label, path: currentPath });
  }

  return crumbs;
}

const TopBar: React.FC = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(location.pathname), [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
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
    <header className="sticky top-0 z-30 flex items-center h-16 bg-white border-b border-gray-200 px-4 lg:px-6">
      {/* Left: Breadcrumbs */}
      <nav className="hidden sm:flex items-center min-w-0 flex-shrink" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-1 text-sm">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <li key={crumb.path} className="flex items-center min-w-0">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-1 flex-shrink-0" />
                )}
                {isLast ? (
                  <span className="font-medium text-gray-900 truncate" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-gray-500 hover:text-indigo-600 transition-colors duration-150 truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: Current page name only */}
      <div className="sm:hidden flex items-center min-w-0">
        <span className="text-sm font-medium text-gray-900 truncate">
          {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : 'Dashboard'}
        </span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center px-4 lg:px-8 max-w-xl mx-auto">
        <div className="w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="search"
            placeholder="Search projects, tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full h-9 pl-10 pr-4 text-sm
              bg-gray-50 border border-gray-200 rounded-lg
              placeholder-gray-400 text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
              transition-colors duration-200
            "
            aria-label="Search"
          />
        </div>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notification Bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-gray-200" />

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="
              flex items-center gap-2 p-1.5 rounded-lg
              hover:bg-gray-100 transition-colors duration-150
            "
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            aria-label="User menu"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">{userInitials}</span>
            </div>

            {/* Name + Role (hidden on small screens) */}
            <div className="hidden md:block text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                {user?.fullName || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate leading-tight capitalize">
                {user?.role || 'Member'}
              </p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              className="
                absolute right-0 mt-2 w-64 rounded-xl
                bg-white border border-gray-200 shadow-lg
                py-1 z-50 animate-fade-in
              "
              role="menu"
              aria-orientation="vertical"
              aria-label="User menu"
            >
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user?.fullName || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {user?.email || 'No email'}
                </p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                >
                  <User className="w-4 h-4 text-gray-400" />
                  <span>Profile & Settings</span>
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
