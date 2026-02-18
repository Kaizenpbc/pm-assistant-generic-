import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Shield, DollarSign, Clock, Users, Info, X, Check } from 'lucide-react';
import { useUIStore, Notification } from '../../stores/uiStore';
import { AlertActionButton } from './AlertActionButton';
import { apiService } from '../../services/api';

const typeIcons: Record<Notification['type'], React.ElementType> = {
  risk: Shield,
  budget: DollarSign,
  schedule: Clock,
  resource: Users,
  info: Info,
};

const severityColors: Record<Notification['severity'], string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const severityTextColors: Record<Notification['severity'], string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-blue-600',
};

const severityBadgeStyles: Record<Notification['severity'], string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateString).toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useUIStore((state) => state.notifications);
  const unreadCount = useUIStore((state) => state.unreadCount);
  const addNotification = useUIStore((state) => state.addNotification);
  const dismissNotification = useUIStore((state) => state.dismissNotification);
  const markAllRead = useUIStore((state) => state.markAllRead);

  const displayBadge = unreadCount > 0;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  // Fetch alerts on mount
  useEffect(() => {
    if (fetchedOnce) return;

    let cancelled = false;

    async function fetchAlerts() {
      try {
        const response = await apiService.getAlerts();
        if (cancelled) return;

        const alerts: Array<{
          id: string;
          type: string;
          severity: string;
          title: string;
          description: string;
          message?: string;
          projectId?: string;
          projectName?: string;
          taskId?: string;
          taskName?: string;
          suggestedAction?: { toolName: string; params: Record<string, any>; label: string };
        }> = response?.alerts ?? [];

        for (const alert of alerts) {
          const type = (['risk', 'budget', 'schedule', 'resource', 'info'].includes(alert.type)
            ? alert.type
            : 'info') as Notification['type'];

          const severity = (['critical', 'high', 'medium', 'low'].includes(alert.severity)
            ? alert.severity
            : 'medium') as Notification['severity'];

          // Map suggestedAction (singular from API) to suggestedActions array
          const suggestedActions = alert.suggestedAction
            ? [alert.suggestedAction]
            : undefined;

          addNotification({
            type,
            severity,
            title: alert.title,
            message: alert.description || alert.message || '',
            projectId: alert.projectId,
            projectName: alert.projectName,
            taskId: alert.taskId,
            taskName: alert.taskName,
            suggestedActions,
            read: false,
          });
        }

        setFetchedOnce(true);
      } catch {
        // Silently fail -- alerts are non-critical
      }
    }

    fetchAlerts();
    return () => {
      cancelled = true;
    };
  }, [fetchedOnce, addNotification]);

  // Close dropdown when clicking outside
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, handleClickOutside]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150"
        aria-label={`Notifications${displayBadge ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {displayBadge && (
          <span
            className="
              absolute -top-0.5 -right-0.5 flex items-center justify-center
              min-w-[18px] h-[18px] px-1
              text-[10px] font-bold text-white
              bg-red-500 rounded-full
              ring-2 ring-white
              animate-fade-in
            "
          >
            {badgeText}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="
            absolute right-0 mt-2 w-96 max-h-[480px] overflow-y-auto
            bg-white border border-gray-200 shadow-lg rounded-xl
            z-50 animate-fade-in
          "
          role="menu"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-medium text-gray-500">
                  ({unreadCount} unread)
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-150"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No notifications yet</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => {
                const IconComponent = typeIcons[notification.type] || Info;
                const severityColor = severityColors[notification.severity] || 'bg-gray-400';
                const severityText = severityTextColors[notification.severity] || 'text-gray-600';
                const badgeStyle = severityBadgeStyles[notification.severity] || severityBadgeStyles.medium;

                return (
                  <div
                    key={notification.id}
                    className={`
                      flex items-start gap-3 px-4 py-3 border-b border-gray-50
                      hover:bg-gray-50 transition-colors duration-150 relative
                      ${notification.read ? 'opacity-60' : ''}
                    `}
                  >
                    {/* Severity color bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${severityColor} rounded-l`}
                    />

                    {/* Type icon */}
                    <div className={`flex-shrink-0 mt-0.5 ${severityText}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p
                            className={`text-sm leading-tight truncate ${
                              notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'
                            }`}
                          >
                            {notification.title}
                          </p>
                          <span className={`flex-shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${badgeStyle}`}>
                            {notification.severity}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
                          aria-label="Dismiss notification"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Description with embedded metrics */}
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-3">
                        {notification.message}
                      </p>

                      {/* Task name if applicable */}
                      {notification.taskName && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Task: <span className="text-gray-600">{notification.taskName}</span>
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">
                          {timeAgo(notification.createdAt)}
                        </span>
                        {notification.projectName && (
                          <span className="text-[10px] text-indigo-500 truncate">
                            {notification.projectName}
                          </span>
                        )}
                      </div>

                      {/* Suggested Action Buttons */}
                      {notification.suggestedActions && notification.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {notification.suggestedActions.map((action, idx) => (
                            <AlertActionButton
                              key={idx}
                              toolName={action.toolName}
                              params={action.params}
                              label={action.label}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => {
                setOpen(false);
                // Navigate to alerts page if one exists; for now just close
              }}
              className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-150"
            >
              View all alerts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
