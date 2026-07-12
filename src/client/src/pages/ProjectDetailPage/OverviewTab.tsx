import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  BarChart3,
  Kanban,
  Users,
  Activity,
  Target,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { CustomFieldsSection } from '../../components/customfields/CustomFieldsSection';
import { PortalLinkManager } from '../../components/portal/PortalLinkManager';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function OverviewTab({ project }: { project: any }) {
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['project-members', project.id],
    queryFn: () => apiService.getProjectMembers(project.id),
    enabled: !!project.id,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['project-analytics', project.id],
    queryFn: () => apiService.getProjectAnalyticsSummary(project.id),
    enabled: !!project.id,
  });

  const { data: schedulesData } = useQuery({
    queryKey: ['schedules', project.id],
    queryFn: () => apiService.getSchedules(project.id),
    enabled: !!project.id,
  });
  const schedules: any[] = schedulesData?.schedules || schedulesData?.data || [];
  const primaryScheduleId: string | null = schedules[0]?.id ?? null;

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['overview-tasks', primaryScheduleId],
    queryFn: () => apiService.getTasks(primaryScheduleId!),
    enabled: !!primaryScheduleId,
  });
  const allTasks: any[] = tasksData?.data || tasksData?.tasks || [];
  const milestones = allTasks
    .filter((t: any) => t.isMilestone === true || t.milestone === true || t.taskType === 'milestone')
    .sort((a: any, b: any) => {
      const da = a.startDate || a.start_date || a.endDate || a.end_date || '';
      const db = b.startDate || b.start_date || b.endDate || b.end_date || '';
      return da.localeCompare(db);
    });

  const { data: raidStatsData } = useQuery({
    queryKey: ['project-risks-stats', project.id],
    queryFn: () => apiService.getRiskStats(project.id),
    enabled: !!project.id,
    staleTime: 60_000,
  });
  const raidStats = raidStatsData?.data || raidStatsData;

  const { data: sprintsData } = useQuery({
    queryKey: ['sprints', project.id, 'overview'],
    queryFn: () => apiService.getSprints(project.id),
    enabled: !!project.id,
    staleTime: 120_000,
  });
  const sprints: any[] = sprintsData?.sprints || sprintsData?.data || (Array.isArray(sprintsData) ? sprintsData : []);
  const activeSprint = sprints.find((s: any) => s.status === 'active');

  const { data: auditData } = useQuery({
    queryKey: ['auditTrail', project.id, 'overview'],
    queryFn: () => apiService.getAuditTrail(project.id, 6),
    enabled: !!project.id,
    staleTime: 60_000,
  });
  const recentActivity: any[] = auditData?.activities || [];

  const members: any[] = membersData?.members || [];
  const summary = analyticsData?.summary || analyticsData;

  const formatDate = (d: string | undefined) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  const startDate = project.startDate || project.start_date;
  const endDate = project.endDate || project.end_date;

  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const elapsedPct = start && end && end > start
    ? Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100))
    : 0;
  const taskProgressPct = summary?.portfolio?.avgProgress ?? summary?.tasks?.completionRate ?? 0;
  const isOverdue = end ? now > end : false;
  const onTrack = isOverdue ? false : taskProgressPct >= elapsedPct - 10;

  const manager = members.find((m: any) => m.role === 'owner' || m.role === 'manager');
  const managerName = manager ? (manager.user?.name || manager.name || manager.email) : 'Not assigned';

  const maxVisibleMembers = 6;
  const visibleMembers = members.slice(0, maxVisibleMembers);
  const overflowCount = members.length - maxVisibleMembers;

  const taskStats = summary?.tasks;

  const cardClass = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';
  const headingClass = 'text-base font-semibold text-gray-900 dark:text-white mb-4';
  const skeletonPulse = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  return (
    <div className="space-y-6">
      {/* Row 1: Description + Project Details + Team Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 space-y-6`}>
          {project.description && (
            <div className={cardClass}>
              <h3 className={headingClass}>Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {project.description}
              </p>
            </div>
          )}

          <div className={cardClass}>
            <h3 className={headingClass}>Project Details</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {project.priority && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Priority</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[project.priority] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {project.priority}
                  </span>
                </span>
              )}
              {project.category && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Category</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{project.category}</span>
                </span>
              )}
              {project.type && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Type</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{project.type}</span>
                </span>
              )}
              {project.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{project.location}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="text-gray-500 dark:text-gray-400">PM</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {membersLoading ? <span className={`inline-block h-4 w-20 ${skeletonPulse}`} /> : managerName}
                </span>
              </span>
              {startDate && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Start</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(startDate)}</span>
                </span>
              )}
              {endDate && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">End</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(endDate)}</span>
                </span>
              )}
              {project.currency && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Currency</span>
                  <span className="font-medium text-gray-900 dark:text-white">{project.currency.toUpperCase()}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Team Members</span>
          </h3>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${skeletonPulse}`} />
                  <div className={`h-4 w-28 ${skeletonPulse}`} />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No team members assigned</p>
          ) : (
            <div className="space-y-3">
              {visibleMembers.map((m: any, idx: number) => {
                const name = m.user?.name || m.name || m.email || 'Unknown';
                const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                const colors = [
                  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
                ];
                return (
                  <div key={m.id || idx} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${colors[idx % colors.length]}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                      {m.role || 'member'}
                    </span>
                  </div>
                );
              })}
              {overflowCount > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">+{overflowCount} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Task Summary + Timeline Progress + Key Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Task Summary</span>
          </h3>
          {analyticsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-16 ${skeletonPulse}`} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Total Tasks" value={taskStats?.total ?? 0} />
                <StatBox label="Completed" value={taskStats?.byStatus?.completed ?? 0} color="text-green-600 dark:text-green-400" />
                <StatBox label="Overdue" value={taskStats?.overdue ?? 0} color={taskStats?.overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
                <StatBox label="In Progress" value={taskStats?.byStatus?.in_progress ?? 0} color="text-blue-600 dark:text-blue-400" />
              </div>
              {taskStats?.completedLast30Days != null && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Completed last 30 days: {taskStats.completedLast30Days}
                </p>
              )}
            </>
          )}
        </div>

        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline Progress</span>
          </h3>
          {!start || !end ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No start/end dates set.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Elapsed</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">{Math.round(elapsedPct)}%</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Complete</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">{Math.round(taskProgressPct)}%</span>
                </div>
              </div>
              <div className="relative">
                <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-500' : onTrack ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, elapsedPct)}%` }}
                  />
                </div>
                {elapsedPct > 0 && elapsedPct < 100 && (
                  <div className="absolute top-0 w-0.5 h-3 bg-gray-900 dark:bg-white" style={{ left: `${elapsedPct}%` }} title="Today" />
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(startDate)}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">Today</span>
                <span>{formatDate(endDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                {isOverdue ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                  </span>
                ) : onTrack ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> On track
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Behind schedule
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Key Milestones</span>
          </h3>
          {tasksLoading || (!primaryScheduleId && schedules.length === 0) ? (
            !primaryScheduleId && !tasksLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No schedule created yet.</p>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-10 ${skeletonPulse}`} />
                ))}
              </div>
            )
          ) : milestones.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No milestones defined. Mark tasks as milestones in the Schedule tab.</p>
          ) : (
            <div className="space-y-2.5">
              {milestones.map((m: any) => {
                const mDate = m.endDate || m.end_date || m.startDate || m.start_date;
                const mStatus = m.status || 'not_started';
                const isPast = mDate && new Date(mDate) < now;
                const isDone = mStatus === 'completed' || mStatus === 'done';
                return (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : isPast ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <div className="w-3 h-3 mt-0.5 rotate-45 border-2 border-primary-500 bg-transparent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isDone ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {m.name}
                      </p>
                      <p className={`text-xs ${isPast && !isDone ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {mDate ? formatDate(mDate) : 'No date'}
                        {isPast && !isDone && ' — overdue'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: RAID Summary + Current Sprint + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> RAID Summary</span>
          </h3>
          {!raidStats ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2.5 text-center">
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">{raidStats.openRisks || 0}</p>
                  <p className="text-[10px] text-red-500 dark:text-red-400">Open Risks</p>
                </div>
                <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-2.5 text-center">
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{raidStats.openIssues || 0}</p>
                  <p className="text-[10px] text-orange-500 dark:text-orange-400">Open Issues</p>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2.5 text-center">
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{raidStats.openActions || 0}</p>
                  <p className="text-[10px] text-blue-500 dark:text-blue-400">Open Actions</p>
                </div>
                <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-2.5 text-center">
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{raidStats.pendingDecisions || 0}</p>
                  <p className="text-[10px] text-purple-500 dark:text-purple-400">Pending Decisions</p>
                </div>
              </div>
              {(raidStats.critical > 0 || raidStats.triggered > 0) && (
                <div className="flex gap-2 flex-wrap">
                  {raidStats.critical > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> {raidStats.critical} critical
                    </span>
                  )}
                  {raidStats.triggered > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                      {raidStats.triggered} triggered
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Kanban className="w-4 h-4" /> Current Sprint</span>
          </h3>
          {!activeSprint ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No active sprint</p>
          ) : (() => {
            const total = activeSprint.totalTasks || 0;
            const done = activeSprint.completedTasks || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const sprintStart = new Date(activeSprint.startDate);
            const sprintEnd = new Date(activeSprint.endDate);
            const totalDays = Math.max(1, Math.ceil((sprintEnd.getTime() - sprintStart.getTime()) / 86400000));
            const elapsed = Math.max(0, Math.ceil((now.getTime() - sprintStart.getTime()) / 86400000));
            return (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{activeSprint.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Day {Math.min(elapsed, totalDays)} of {totalDays} &middot; {formatDate(activeSprint.startDate)} - {formatDate(activeSprint.endDate)}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Progress</span>
                    <span className="font-medium text-gray-900 dark:text-white">{done}/{total} tasks ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {activeSprint.goal && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sprint Goal</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{activeSprint.goal}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className={cardClass}>
          <h3 className={headingClass}>
            <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Recent Activity</span>
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
          ) : (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
              {recentActivity.map((a: any, i: number) => (
                <div key={a.id || i} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="w-3 h-3 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-800 dark:text-gray-200 truncate">
                      {a.action || a.description || a.summary || a.message || 'Activity'}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {a.userName || a.user || ''}{a.userName || a.user ? ' · ' : ''}
                      {new Date(a.createdAt || a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Custom Fields + Portal Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {project.id && (
          <div className={cardClass}>
            <CustomFieldsSection entityType="project" entityId={project.id} projectId={project.id} />
          </div>
        )}
        {project.id && (
          <div className={cardClass}>
            <PortalLinkManager projectId={project.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 text-center">
      <p className={`text-2xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}
